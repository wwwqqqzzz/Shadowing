#!/usr/bin/env python3
"""
Batch pitch (F0 contour) computation for all sentences.
Loads each material's audio once, slices per-sentence segments,
computes pitch with librosa.pyin, and writes pitchData back to the DB.

Usage:
    python3 scripts/compute_pitch.py                     # all materials
    python3 scripts/compute_pitch.py --material <uuid>   # single material
    python3 scripts/compute_pitch.py --sentence <uuid>   # single sentence
    python3 scripts/compute_pitch.py --limit 5           # first N materials
"""

import argparse
import os
import sys
import json
import time
import urllib.request
import tempfile
from pathlib import Path

import numpy as np
import librosa
import psycopg2
import psycopg2.extras

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

DB_CONFIG = {
    "host": os.getenv("DATABASE_HOST", "localhost"),
    "port": int(os.getenv("DATABASE_PORT", "5432")),
    "user": os.getenv("DATABASE_USER", "wang"),
    "password": os.getenv("DATABASE_PASS", ""),
    "dbname": os.getenv("DATABASE_NAME", "shadowing_dev"),
}

BACKEND_BASE = os.getenv("BACKEND_BASE", "http://localhost:3000")

def resolve_audio_url(audio_path_or_url):
    """Resolve audio path: if it's a bare filename, prefix with backend audio URL."""
    if audio_path_or_url.startswith(("http://", "https://", "wxfile://", "/")):
        return audio_path_or_url
    return f"{BACKEND_BASE}/audio/{audio_path_or_url}"


def get_conn():
    return psycopg2.connect(**DB_CONFIG)


def compute_pitch_for_segment(audio_path_or_url: str, start_ms: float, end_ms: float, sr=16000):
    target_sr = sr
    audio_path_or_url = resolve_audio_url(audio_path_or_url)
    if audio_path_or_url.startswith(("http://", "https://")):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            urllib.request.urlretrieve(audio_path_or_url, tmp.name)
            audio_path = tmp.name
            must_cleanup = True
    else:
        audio_path = audio_path_or_url
        must_cleanup = False

    try:
        y, sr = librosa.load(audio_path, sr=target_sr, mono=True)

        start_sample = int(start_ms / 1000 * sr)
        end_sample = int(end_ms / 1000 * sr)
        y_seg = y[start_sample:end_sample]

        if len(y_seg) < 256:
            return [], int((end_ms - start_ms) if end_ms > start_ms else 0)

        hop_length = 256
        f0, voiced_flag, _ = librosa.pyin(
            y_seg,
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            sr=sr,
            hop_length=hop_length,
            pad_mode='constant',
        )

        times = librosa.frames_to_time(np.arange(len(f0)), sr=sr, hop_length=hop_length)
        pitch_data = []
        for t, freq, voiced in zip(times, f0, voiced_flag):
            if voiced and not np.isnan(freq):
                pitch_data.append({"time": round(t, 3), "frequency": round(float(freq), 1)})

        return pitch_data, int(len(y_seg) / sr * 1000)
    finally:
        if must_cleanup:
            os.unlink(audio_path)


def get_materials_with_sentences(conn, material_id=None, limit=None):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    if material_id:
        cur.execute(
            'SELECT id, title, "audioUrl", "audioOffsetMs" FROM material WHERE id = %s AND "audioUrl" IS NOT NULL',
            (material_id,),
        )
    else:
        query = 'SELECT id, title, "audioUrl", "audioOffsetMs" FROM material WHERE "audioUrl" IS NOT NULL'
        if limit:
            query += f" LIMIT {limit}"
        cur.execute(query)

    materials = cur.fetchall()
    for mat in materials:
        query = """
            SELECT id, "order", "startTime", "endTime", text
            FROM sentence
            WHERE "materialId" = %s
            ORDER BY "order" ASC
        """
        cur.execute(query, (mat["id"],))
        sentences = cur.fetchall()
        mat["sentences"] = sentences

    cur.close()
    return materials


def update_sentence_pitch(conn, sentence_id, pitch_data):
    cur = conn.cursor()
    data = json.dumps(pitch_data) if pitch_data else "[]"
    cur.execute(
        'UPDATE sentence SET "pitchData" = %s::jsonb WHERE id = %s',
        (data, sentence_id),
    )
    cur.close()
    conn.commit()


def compute_pitch_for_material(audio_path_or_url, sentences, offset_ms=0, sr=16000):
    """Load audio once, process all sentences, return list of (sentence_id, pitch_data)."""
    url = resolve_audio_url(audio_path_or_url)
    if url.startswith(("http://", "https://")):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
            urllib.request.urlretrieve(url, tmp.name)
            audio_path = tmp.name
        must_cleanup = True
    else:
        audio_path = url
        must_cleanup = False

    results = []
    try:
        y, sr = librosa.load(audio_path, sr=sr, mono=True)
        hop_length = 256

        for s in sentences:
            sid = s["id"]
            start_ms = s["startTime"] + offset_ms
            end_ms = s["endTime"] + offset_ms
            start_sample = int(start_ms / 1000 * sr)
            end_sample = int(end_ms / 1000 * sr)
            y_seg = y[start_sample:end_sample]

            if len(y_seg) < 256:
                results.append((sid, [], int((end_ms - start_ms) if end_ms > start_ms else 0)))
                continue

            f0, voiced_flag, _ = librosa.pyin(
                y_seg,
                fmin=librosa.note_to_hz('C2'),
                fmax=librosa.note_to_hz('C7'),
                sr=sr,
                hop_length=hop_length,
                pad_mode='constant',
            )

            times = librosa.frames_to_time(np.arange(len(f0)), sr=sr, hop_length=hop_length)
            pitch_data = []
            for t, freq, voiced in zip(times, f0, voiced_flag):
                if voiced and not np.isnan(freq):
                    pitch_data.append({"time": round(t, 3), "frequency": round(float(freq), 1)})

            results.append((sid, pitch_data, int(len(y_seg) / sr * 1000)))
    finally:
        if must_cleanup:
            os.unlink(audio_path)

    return results


def main():
    parser = argparse.ArgumentParser(description="Batch compute pitch data for sentences")
    parser.add_argument("--material", help="Compute for a single material (UUID)")
    parser.add_argument("--sentence", help="Compute for a single sentence (UUID)")
    parser.add_argument("--limit", type=int, help="Limit number of materials to process")
    args = parser.parse_args()

    conn = get_conn()

    if args.sentence:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """SELECT s.id, s."startTime", s."endTime", s.text, m."audioUrl", m."audioOffsetMs"
               FROM sentence s JOIN material m ON s."materialId" = m.id
               WHERE s.id = %s""",
            (args.sentence,),
        )
        sentence = cur.fetchone()
        cur.close()
        if not sentence:
            print(f"Sentence {args.sentence} not found")
            sys.exit(1)
        print(f"Processing sentence {sentence['id']}: {sentence['text'][:50]}...")
        offset = sentence["audioOffsetMs"] or 0
        pitch, dur = compute_pitch_for_segment(
            sentence["audioUrl"],
            sentence["startTime"] + offset,
            sentence["endTime"] + offset,
        )
        update_sentence_pitch(conn, sentence["id"], pitch)
        print(f"  -> {len(pitch)} pitch points, duration={dur}ms")
        conn.close()
        return

    materials = get_materials_with_sentences(conn, args.material, args.limit)
    print(f"Found {len(materials)} material(s) to process")

    total_pitch_count = 0
    total_sentence_count = 0
    start_time = time.time()

    for mat in materials:
        offset = mat.get("audioOffsetMs") or 0
        print(f"\nMaterial {mat['id']}: \"{mat['title']}\" ({len(mat['sentences'])} sentences)")

        mat_start = time.time()
        batch = compute_pitch_for_material(
            mat["audioUrl"],
            mat["sentences"],
            offset,
        )
        for sid, pitch, dur in batch:
            update_sentence_pitch(conn, sid, pitch)
            total_pitch_count += len(pitch)
            total_sentence_count += 1

        elapsed = time.time() - mat_start
        print(f"  done in {elapsed:.1f}s")

    elapsed = time.time() - start_time
    print(f"\nDone: {total_sentence_count} sentences, {total_pitch_count} pitch points in {elapsed:.1f}s")
    conn.close()


if __name__ == "__main__":
    main()

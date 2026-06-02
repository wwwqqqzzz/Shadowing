#!/usr/bin/env python3
"""
Sentence Alignment Pipeline
===========================
Uses Whisper ASR + fuzzy text matching to align VTT sentences
with audio timestamps. Produces accurate startTime/endTime per sentence.

Usage:
    python3 scripts/align_sentences.py --audio tmp/<file>.mp3 --vtt tmp/<file>.vtt [--offset N]

Output: JSON with aligned sentences, or --update-db to write directly.
"""

import argparse
import json
import os
import sys
import re
import difflib
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

import whisper


def parse_vtt(vtt_path: str) -> list[dict]:
    """
    Parse a VTT file into a list of raw cues with start/end times in ms.
    Also returns merged sentences (short cues combined).
    """
    with open(vtt_path, 'r', encoding='utf-8') as f:
        content = f.read()

    lines = content.strip().split('\n')
    cues = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if '-->' in line:
            parts = line.split('-->')
            start_str = parts[0].strip()
            end_str = parts[1].strip()

            def ts_to_ms(ts):
                h, m, s = ts.split(':')
                s_ms = s.split('.')
                sec = int(s_ms[0])
                ms = int(s_ms[1]) if len(s_ms) > 1 else 0
                return int(h) * 3600000 + int(m) * 60000 + sec * 1000 + ms

            start_ms = ts_to_ms(start_str)
            end_ms = ts_to_ms(end_str)

            # Collect text lines until next blank line or EOF
            i += 1
            text_parts = []
            while i < len(lines) and lines[i].strip():
                text_parts.append(lines[i].strip())
                i += 1

            text = ' '.join(text_parts)
            cues.append({
                'startTime': start_ms,
                'endTime': end_ms,
                'text': text,
            })
        i += 1

    return cues


def should_drop(text: str) -> bool:
    """Filter out non-content lines like BBC intro jingle."""
    t = text.strip().lower()
    patterns = [
        r'^hello\.?\s*$',
        r'^hello\.?\s*this is',
        r'^this is \d+ minute english',
        r'^this is a download from',
        r'^you\'re? listening to',
        r'^\d+ minute english',
        r'^bbclearningenglish',
        r'^greetings followers',
        r'^and settle in',
        r'^wow,? it\'?d be a job',
        r'^right\.?\s*$',
        r'^ok(ay)?,?\s*sam',
        r'^was i right',
        r'^i said',
    ]
    for p in patterns:
        if re.search(p, t):
            return True
    return False


def word_count(text: str) -> int:
    return len(text.strip().split())


def merge_cues(cues: list[dict], min_duration_ms: int = 2500, max_duration_ms: int = 15000) -> list[dict]:
    filtered = [c for c in cues if not should_drop(c['text'])]
    if not filtered:
        return []

    pass1 = []
    i = 0
    while i < len(filtered):
        cue = filtered[i]
        dur = cue['endTime'] - cue['startTime']
        wc = word_count(cue['text'])
        if dur < 1000 and wc < 3 and i + 1 < len(filtered):
            nxt = filtered[i + 1].copy()
            nxt['text'] = cue['text'] + ' ' + nxt['text']
            nxt['startTime'] = cue['startTime']
            pass1.append(nxt)
            i += 2
        else:
            pass1.append(cue)
            i += 1

    pass2 = []
    i = 0
    while i < len(pass1):
        group = pass1[i]
        wc = word_count(group['text'])
        dur = group['endTime'] - group['startTime']
        while i + 1 < len(pass1):
            nxt = pass1[i + 1]
            nxt_wc = word_count(nxt['text'])
            nxt_dur = nxt['endTime'] - nxt['startTime']
            if (dur < min_duration_ms and wc < 5) or (nxt_dur < min_duration_ms and nxt_wc < 5):
                if (nxt['endTime'] - group['startTime']) <= max_duration_ms:
                    group['endTime'] = nxt['endTime']
                    group['text'] = group['text'] + ' ' + nxt['text']
                    wc = word_count(group['text'])
                    dur = group['endTime'] - group['startTime']
                    i += 1
                    continue
            break

        if dur < min_duration_ms and wc < 5 and i + 1 < len(pass1):
            nxt = pass1[i + 1]
            if (nxt['endTime'] - group['startTime']) <= max_duration_ms:
                group['endTime'] = nxt['endTime']
                group['text'] = group['text'] + ' ' + nxt['text']
                i += 1

        pass2.append(group)
        i += 1

    return pass2


def normalize(s: str) -> str:
    """Normalize text for fuzzy matching."""
    s = s.lower()
    s = re.sub(r'[^\w\s\']', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def word_overlap(words_a: list[str], words_b: list[str]) -> float:
    """Calculate word overlap ratio between two word lists."""
    if not words_a or not words_b:
        return 0.0
    set_a = set(words_a)
    set_b = set(words_b)
    overlap = len(set_a & set_b)
    return overlap / max(len(set_a), len(set_b))


def flatten_words(segments):
    words = []
    for seg in segments:
        for w in seg.get('words', []):
            words.append({
                'word': w['word'].strip(),
                'start': w['start'],
                'end': w['end'],
                'segment_idx': seg.get('id', 0),
            })
    return words


def find_word_range(words, target_words, start_word_idx, max_span=50):
    best_start = start_word_idx
    best_end = min(start_word_idx + 1, len(words))
    best_ratio = 0.0

    for s in range(start_word_idx, min(start_word_idx + max_span, len(words))):
        for e in range(s + 1, min(s + max_span + 1, len(words) + 1)):
            combined = [w['word'].lower() for w in words[s:e]]
            combined = [re.sub(r'[^\w\s\']', '', w) for w in combined]
            combined = [w for w in combined if w]
            ratio = word_overlap(target_words, combined)
            if ratio > best_ratio:
                best_ratio = ratio
                best_start = s
                best_end = e

    return best_start, best_end, best_ratio


def align_sentences(segments, target_sentences):
    if not segments or not target_sentences:
        return []

    all_words = flatten_words(segments)
    target_data = []
    for s in target_sentences:
        wl = [w for w in normalize(s['text']).split() if w]
        target_data.append({'text': s['text'], 'words': wl})

    aligned = []
    w_idx = 0

    for t_idx in range(len(target_sentences)):
        target = target_data[t_idx]
        if not target['words']:
            continue
        if w_idx >= len(all_words):
            break

        best_start, best_end, best_ratio = find_word_range(
            all_words, target['words'], w_idx, max_span=50
        )

        if best_ratio >= 0.3:
            start_time = round(all_words[best_start]['start'] * 1000)
            end_time = round(all_words[best_end - 1]['end'] * 1000)
            word_timings = []
            for w in all_words[best_start:best_end]:
                word_timings.append({
                    'word': w['word'],
                    'start': round(w['start'] * 1000 - start_time),
                    'end': round(w['end'] * 1000 - start_time),
                })
            aligned.append({
                'order': len(aligned) + 1,
                'text': target['text'],
                'startTime': start_time,
                'endTime': end_time,
                'wordTimings': word_timings,
                'confidence': round(best_ratio, 3),
            })
            w_idx = best_end
        else:
            aligned.append({
                'order': len(aligned) + 1,
                'text': target['text'],
                'startTime': target_sentences[t_idx]['startTime'],
                'endTime': target_sentences[t_idx]['endTime'],
                'wordTimings': None,
                'confidence': round(best_ratio, 3),
            })

    return aligned


def update_wordtimings_only(material_id: str, sentences: list[dict], conn_params: dict):
    """Update only wordTimings for existing sentences (no delete/reinsert)."""
    import psycopg2

    conn = psycopg2.connect(**conn_params)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Fetch existing sentences for this material
        cur.execute(
            'SELECT id, "order", text FROM sentence WHERE "materialId" = %s ORDER BY "order"',
            (material_id,),
        )
        existing = cur.fetchall()
        if not existing:
            print(f'  No existing sentences found for material {material_id}', file=sys.stderr)
            return

        print(f'  Found {len(existing)} existing sentences in DB')
        print(f'  Have {len(sentences)} aligned sentences from Whisper')

        # Match by order (1-indexed) and update wordTimings
        # aligned sentences have order starting from 1
        aligned_by_order = {s['order']: s for s in sentences}
        updated = 0
        for row_id, row_order, row_text in existing:
            if row_order in aligned_by_order:
                wt = aligned_by_order[row_order].get('wordTimings')
                wt_json = json.dumps(wt) if wt else None
                cur.execute(
                    'UPDATE sentence SET "wordTimings" = %s WHERE id = %s',
                    (wt_json, row_id),
                )
                updated += 1
            else:
                # Mark as NULL if no alignment found
                cur.execute(
                    'UPDATE sentence SET "wordTimings" = NULL WHERE id = %s',
                    (row_id,),
                )

        print(f'  Updated wordTimings for {updated}/{len(existing)} sentences')

        # Also update material durationMs if provided
        cur.execute(
            'UPDATE material SET "audioOffsetMs" = 0 WHERE id = %s',
            (material_id,),
        )

        conn.commit()
        print('  Committed to database.')
    except Exception as e:
        conn.rollback()
        print(f'Error updating wordTimings: {e}', file=sys.stderr)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description='Align sentences to audio using Whisper ASR')
    parser.add_argument('--audio', required=True, help='Path to audio file (mp3/wav)')
    parser.add_argument('--vtt', required=True, help='Path to VTT subtitle file')
    parser.add_argument('--model', default='base', help='Whisper model size (tiny/base/small/medium/large)')
    parser.add_argument('--offset', type=float, default=0, help='Audio offset in seconds (e.g., -1.5 or 3.0)')
    parser.add_argument('--min-duration', type=int, default=2500, help='Min sentence duration in ms (default: 2500)')
    parser.add_argument('--max-duration', type=int, default=15000, help='Max sentence duration in ms (default: 15000)')
    parser.add_argument('--output', help='Output JSON file path (default: stdout)')
    parser.add_argument('--update-db', action='store_true', help='Full update: delete + reinsert sentences (DANGEROUS - loses translations)')
    parser.add_argument('--update-wordtimings', action='store_true', help='Safe update: only update wordTimings column (preserves existing data)')
    parser.add_argument('--material-id', help='Material ID to update (required with --update-db or --update-wordtimings)')

    args = parser.parse_args()

    # Validate
    if not os.path.exists(args.audio):
        print(f'Error: audio file not found: {args.audio}', file=sys.stderr)
        sys.exit(1)
    if not os.path.exists(args.vtt):
        print(f'Error: VTT file not found: {args.vtt}', file=sys.stderr)
        sys.exit(1)

    # Step 1: Parse VTT to get target sentences
    print(f'[1/4] Parsing VTT: {args.vtt}')
    raw_cues = parse_vtt(args.vtt)
    print(f'  Raw cues: {len(raw_cues)}')

    target_sentences = merge_cues(raw_cues, min_duration_ms=args.min_duration, max_duration_ms=args.max_duration)
    print(f'  Merged sentences: {len(target_sentences)}')

    # Print target sentences for reference
    for i, s in enumerate(target_sentences[:5]):
        dur = (s['endTime'] - s['startTime']) / 1000
        text_short = s['text'][:60] + '...' if len(s['text']) > 60 else s['text']
        print(f'  Target {i+1}: [{s["startTime"]}ms-{s["endTime"]}ms] ({dur:.1f}s) {text_short}')
    if len(target_sentences) > 5:
        print(f'  ... and {len(target_sentences) - 5} more')

    # Step 2: Run Whisper ASR with word-level timestamps
    print(f'\n[2/4] Running Whisper ({args.model}) on: {args.audio}')
    model = whisper.load_model(args.model)
    result = model.transcribe(
        args.audio,
        language='en',
        word_timestamps=True,
        verbose=False,
    )

    whisper_segments = result.get('segments', [])
    print(f'  Whisper segments: {len(whisper_segments)}')

    if args.offset:
        print(f'  Applying offset: {args.offset}s')
        for seg in whisper_segments:
            seg['start'] = max(0, seg['start'] + args.offset)
            seg['end'] = max(0, seg['end'] + args.offset)

    for i, seg in enumerate(whisper_segments[:5]):
        text_short = seg['text'][:60] + '...' if len(seg['text']) > 60 else seg['text']
        print(f'  Whisper {i+1}: [{seg["start"]:.3f}s-{seg["end"]:.3f}s] {text_short}')

    # Step 3: Align sentences via fuzzy matching
    print(f'\n[3/4] Aligning {len(target_sentences)} sentences to {len(whisper_segments)} whisper segments...')
    aligned = align_sentences(whisper_segments, target_sentences)
    print(f'  Aligned: {len(aligned)} sentences')

    # Print alignment results
    for i, s in enumerate(aligned):
        dur = (s['endTime'] - s['startTime']) / 1000
        text_short = s['text'][:60] + '...' if len(s['text']) > 60 else s['text']
        print(f'  {s["order"]}. [{s["startTime"]}ms-{s["endTime"]}ms] ({dur:.1f}s) [{s["confidence"]}] {text_short}')

    # Step 4: Output
    print(f'\n[4/4] Output...')
    output = {
        'material': {
            'audioUrl': os.path.basename(args.audio),
            'durationMs': round(result.get('duration', 0) * 1000),
        },
        'sentences': aligned,
    }

    if args.update_db:
        if not args.material_id:
            print('Error: --material-id required with --update-db', file=sys.stderr)
            sys.exit(1)
        update_database(args.material_id, aligned, output['material'])
    elif args.update_wordtimings:
        if not args.material_id:
            print('Error: --material-id required with --update-wordtimings', file=sys.stderr)
            sys.exit(1)
        conn_params = {
            'host': os.environ.get('DATABASE_HOST', 'localhost'),
            'port': int(os.environ.get('DATABASE_PORT', '5432')),
            'user': os.environ.get('DATABASE_USER', 'wang'),
            'password': os.environ.get('DATABASE_PASS', ''),
            'dbname': os.environ.get('DATABASE_NAME', 'shadowing_dev'),
        }
        update_wordtimings_only(args.material_id, aligned, conn_params)
    elif args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f'  Written to: {args.output}')
    else:
        print(json.dumps(output, indent=2, ensure_ascii=False))

    print('\nDone.')


def update_database(material_id: str, sentences: list[dict], material_info: dict):
    """Write aligned sentences to PostgreSQL database."""
    import psycopg2

    conn = psycopg2.connect(
        host=os.environ.get('DATABASE_HOST', 'localhost'),
        port=int(os.environ.get('DATABASE_PORT', '5432')),
        user=os.environ.get('DATABASE_USER', 'wang'),
        password=os.environ.get('DATABASE_PASS', ''),
        dbname=os.environ.get('DATABASE_NAME', 'shadowing_dev'),
    )
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # Delete old sentences
        cur.execute('DELETE FROM sentence WHERE "materialId" = %s', (material_id,))
        print(f'  Deleted existing sentences for material {material_id}')

        # Insert new sentences
        for s in sentences:
            wt_json = json.dumps(s.get('wordTimings')) if s.get('wordTimings') else None
            cur.execute(
                '''INSERT INTO sentence ("order", "startTime", "endTime", "text", "materialId", "wordTimings")
                   VALUES (%s, %s, %s, %s, %s, %s)''',
                (s['order'], s['startTime'], s['endTime'], s['text'], material_id, wt_json),
            )
        print(f'  Inserted {len(sentences)} sentences')

        cur.execute(
            'UPDATE material SET "durationMs" = %s, "audioOffsetMs" = 0 WHERE id = %s',
            (material_info['durationMs'], material_id),
        )
        print(f'  Updated material durationMs = {material_info["durationMs"]}, audioOffsetMs = 0')

        conn.commit()
        print('  Committed to database.')
    except Exception as e:
        conn.rollback()
        print(f'Error updating database: {e}', file=sys.stderr)
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Post-process aligned sentences in DB: clean HTML entities, merge short
sentences (<3s), split long sentences (>=15s), update material durationMs.

Usage:
    python3 scripts/postprocess_alignment.py --material-id <ID>
"""
import argparse
import os
import re
import html

import psycopg2

MIN_DURATION_MS = 3000
MAX_DURATION_MS = 15000


def connect():
    return psycopg2.connect(
        host=os.environ.get('DATABASE_HOST', 'localhost'),
        port=int(os.environ.get('DATABASE_PORT', '5432')),
        user=os.environ.get('DATABASE_USER', 'wang'),
        password=os.environ.get('DATABASE_PASS', ''),
        dbname=os.environ.get('DATABASE_NAME', 'shadowing_dev'),
    )


def fetch_sentences(conn):
    cur = conn.cursor()
    cur.execute(
        'SELECT id, "order", "startTime", "endTime", text '
        'FROM sentence WHERE "materialId" = %s ORDER BY "order"',
        (MATERIAL_ID,)
    )
    rows = cur.fetchall()
    cur.close()
    return rows


def clean_text(text):
    text = html.unescape(text)
    text = text.replace('\u00a0', ' ')
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def delete_all_sentences(conn):
    cur = conn.cursor()
    cur.execute('DELETE FROM practice_record WHERE "sentenceId" IN '
                '(SELECT id FROM sentence WHERE "materialId" = %s)', (MATERIAL_ID,))
    print(f'  Deleted {cur.rowcount} practice records')
    cur.execute('DELETE FROM sentence WHERE "materialId" = %s', (MATERIAL_ID,))
    print(f'  Deleted {cur.rowcount} sentences')
    cur.close()


def insert_sentence(conn, order, start_time, end_time, text):
    cur = conn.cursor()
    cur.execute(
        '''INSERT INTO sentence ("order", "startTime", "endTime", "text", "materialId")
           VALUES (%s, %s, %s, %s, %s)''',
        (order, start_time, end_time, text, MATERIAL_ID),
    )
    cur.close()


def update_material(conn):
    cur = conn.cursor()
    cur.execute(
        'UPDATE material SET "durationMs" = %s WHERE id = %s',
        (AUDIO_DURATION_MS, MATERIAL_ID),
    )
    cur.close()


def split_sentence(sid, order, start, end, text):
    dur = end - start
    if dur < MAX_DURATION_MS:
        return [(sid, order, start, end, text)]

    boundaries = list(re.finditer(r'(?<=[.!?])\s+(?=[A-Z])', text))
    if boundaries:
        mid_char = len(text) // 2
        best = min(boundaries, key=lambda sp: abs(sp.start() - mid_char))
        bp = best.start()
        p1, p2 = text[:bp].strip(), text[bp:].strip()
        if p1 and p2:
            ratio = len(p1) / len(text)
            mt = start + int(dur * ratio)
            if mt - start >= MIN_DURATION_MS and end - mt >= MIN_DURATION_MS:
                return [(sid, order, start, mt, p1), (sid, order + 0.5, mt, end, p2)]

    sa = text.find(' ', len(text) // 2)
    if sa > 0:
        p1, p2 = text[:sa].strip(), text[sa:].strip()
        if p1 and p2:
            ratio = len(p1) / len(text)
            mt = start + int(dur * ratio)
            if mt - start >= MIN_DURATION_MS and end - mt >= MIN_DURATION_MS:
                return [(sid, order, start, mt, p1), (sid, order + 0.5, mt, end, p2)]

    print(f'  WARNING: could not split #{order} ({dur}ms)')
    return [(sid, order, start, end, text)]


def tighten_boundaries(sentences, audio_duration_ms, lead_ms=150, trail_ms=100):
    """Tighten sentence boundaries to reduce leading/trailing silence.

    For each sentence:
    - startTime: push forward by lead_ms, but not past the midpoint of the gap to the previous sentence
    - endTime: pull back by trail_ms, but not past the midpoint of the gap to the next sentence

    This ensures sentences start at the actual speech, not in the middle of silence.
    """
    if not sentences:
        return sentences

    result = []
    for i, (sid, order, start, end, text) in enumerate(sentences):
        new_start = start
        new_end = end

        # Tighten start: push forward by lead_ms, but respect gap to previous sentence
        if i == 0:
            # First sentence: can push forward, but not more than 50% of the gap from 0
            gap_from_zero = start
            max_push = min(lead_ms, gap_from_zero // 2)
            new_start = start + max(0, max_push)
        else:
            prev_end = sentences[i - 1][3]
            gap = start - prev_end
            if gap > 0:
                # Push forward, but leave at least half the gap
                max_push = min(lead_ms, gap // 2)
                new_start = start + max(0, max_push)
            elif gap > -500:
                # Small overlap (<500ms): keep start, but nudge forward slightly
                new_start = start + 50
            else:
                # Large overlap: use previous end as start
                new_start = prev_end + 50

        # Tighten end: pull back by trail_ms, but respect gap to next sentence
        if i == len(sentences) - 1:
            # Last sentence: pull back, but don't go past start
            new_end = max(new_start + 500, end - trail_ms)
        else:
            next_start = sentences[i + 1][2]
            gap = next_start - end
            if gap > 0:
                # Pull back, but leave at least half the gap
                max_pull = min(trail_ms, gap // 2)
                new_end = max(new_start + 500, end - max(0, max_pull))
            elif gap > -500:
                # Small overlap: pull back slightly
                new_end = max(new_start + 500, end - 50)
            else:
                # Large overlap: end before next start
                new_end = next_start - 50

        # Ensure minimum duration of 500ms
        if new_end - new_start < 500:
            new_end = new_start + 500

        result.append((sid, order, new_start, new_end, text))

    return result


def main():
    parser = argparse.ArgumentParser(description='Post-process aligned sentences')
    parser.add_argument('--material-id', required=True, help='Material ID to process')
    parser.add_argument('--duration-ms', type=int, help='Audio duration in ms (auto-detected if omitted)')
    parser.add_argument('--no-tighten', action='store_true', help='Skip boundary tightening step')
    args = parser.parse_args()

    global MATERIAL_ID
    MATERIAL_ID = args.material_id

    conn = connect()
    conn.autocommit = False

    # Auto-detect audio duration if not provided
    audio_duration_ms = args.duration_ms
    if not audio_duration_ms:
        cur = conn.cursor()
        cur.execute('SELECT "durationMs" FROM material WHERE id = %s', (MATERIAL_ID,))
        row = cur.fetchone()
        cur.close()
        if row and row[0]:
            audio_duration_ms = row[0]
        else:
            # Calculate from last sentence end time
            cur = conn.cursor()
            cur.execute('SELECT MAX("endTime") FROM sentence WHERE "materialId" = %s', (MATERIAL_ID,))
            row = cur.fetchone()
            cur.close()
            audio_duration_ms = row[0] if row and row[0] else 0

    global AUDIO_DURATION_MS
    AUDIO_DURATION_MS = audio_duration_ms

    try:
        rows = fetch_sentences(conn)
        print(f'Fetched {len(rows)} sentences')

        cleaned = [(sid, order, start, end, clean_text(text))
                   for sid, order, start, end, text in rows]

        def is_complete_sentence(text):
            wc = len(text.split())
            return wc >= 5 and text.strip()[-1:] in '.!?'

        merged = []
        i = 0
        while i < len(cleaned):
            sid, order, start, end, text = cleaned[i]
            dur = end - start
            if dur < MIN_DURATION_MS and not is_complete_sentence(text) and i + 1 < len(cleaned):
                _, n_order, _, n_end, n_text = cleaned[i + 1]
                merged.append((sid, order, start, n_end, text + ' ' + n_text))
                print(f'  Merged #{order} ({dur}ms) + #{n_order}')
                i += 2
            else:
                merged.append((sid, order, start, end, text))
                i += 1

        final = []
        for item in merged:
            parts = split_sentence(*item)
            if len(parts) > 1:
                print(f'  Split #{item[1]} ({item[3] - item[2]}ms)')
            final.extend(parts)

        if not args.no_tighten:
            before_tighten = len(final)
            final = tighten_boundaries(final, AUDIO_DURATION_MS)
            print(f'  Tightened {before_tighten} sentence boundaries')

        final = [(sid, order, start, end, clean_text(text))
                 for (sid, order, start, end, text) in final]

        delete_all_sentences(conn)
        print(f'Deleted old sentences')

        for i, (_, _, start, end, text) in enumerate(final, 1):
            insert_sentence(conn, i, start, end, text)
        print(f'Inserted {len(final)} sentences')

        update_material(conn)
        print(f'Updated material durationMs = {AUDIO_DURATION_MS}')

        conn.commit()
        print('Committed.')

        durations = [end - start for (_, _, start, end, _) in final]
        print(f'\nSentences: {len(final)} | min {min(durations)/1000:.1f}s | '
              f'max {max(durations)/1000:.1f}s | avg {sum(durations)/len(durations)/1000:.1f}s | '
              f'<3s: {sum(1 for d in durations if d < 3000)} | '
              f'>=15s: {sum(1 for d in durations if d >= 15000)} | '
              f'sweet(5-12s): {sum(1 for d in durations if 5000 <= d <= 12000)}')

    except Exception as e:
        conn.rollback()
        print(f'Error: {e}', file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()


if __name__ == '__main__':
    main()

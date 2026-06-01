#!/usr/bin/env python3
"""Batch translate sentences from English to Chinese using MyMemory API.

Usage:
    python3 scripts/translate_sentences.py [--material-id ID] [--dry-run] [--concurrency N]

Options:
    --material-id ID   Only translate sentences for this material
    --dry-run          Show what would be translated without making DB changes
    --concurrency N    Number of parallel API calls (default: 5)
"""

import argparse
import os
import sys
import time
import json
import signal
import urllib.request
import urllib.parse
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

import psycopg2

PROXY_HOST = '127.0.0.1'
PROXY_PORT = 7897
API_URL = 'https://api.mymemory.translated.net/get'
RATE_LIMIT_DELAY = 1.0  # 1s between calls per thread


def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get('DATABASE_HOST', 'localhost'),
        port=int(os.environ.get('DATABASE_PORT', '5432')),
        user=os.environ.get('DATABASE_USER', 'wang'),
        password=os.environ.get('DATABASE_PASS', ''),
        dbname=os.environ.get('DATABASE_NAME', 'shadowing_dev'),
    )


def translate_text(text, proxy_handler=None):
    """Translate a single English text to Chinese using MyMemory API."""
    if not text or not text.strip():
        return ''
    
    # MyMemory has a 500 char limit per request
    if len(text) > 500:
        # Split at sentence boundary
        mid = len(text) // 2
        split_pos = text.rfind(' ', 0, mid)
        if split_pos == -1:
            split_pos = mid
        part1 = translate_text(text[:split_pos], proxy_handler)
        part2 = translate_text(text[split_pos:], proxy_handler)
        return part1 + part2
    
    encoded = urllib.parse.urlencode({
        'q': text,
        'langpair': 'en|zh-CN',
    })
    url = f'{API_URL}?{encoded}'
    
    req = urllib.request.Request(url)
    
    tries = 0
    while tries < 5:
        try:
            if proxy_handler:
                opener = urllib.request.build_opener(urllib.request.ProxyHandler({
                    'http': f'http://{PROXY_HOST}:{PROXY_PORT}',
                    'https': f'http://{PROXY_HOST}:{PROXY_PORT}',
                }))
                response = opener.open(req, timeout=15)
            else:
                response = urllib.request.urlopen(req, timeout=15)
            
            data = json.loads(response.read().decode('utf-8'))
            translated = data.get('responseData', {}).get('translatedText', '')
            
            if translated and translated.lower() != text.lower():
                return translated
            
            matches = data.get('matches', [])
            if matches:
                best = matches[0].get('translation', '')
                if best and best.lower() != text.lower():
                    return best
            
            return translated if translated else text
        
        except urllib.error.HTTPError as e:
            if e.code == 429:
                tries += 1
                wait = min(30, 2 ** tries)
                print(f'  429 rate limited, retrying in {wait}s... (attempt {tries}/5)', file=sys.stderr)
                time.sleep(wait)
                continue
            print(f'  HTTP error: {e}', file=sys.stderr)
            return ''
        except (urllib.error.URLError, TimeoutError) as e:
            tries += 1
            if tries >= 5:
                print(f'  ERROR translating after 5 retries: {e}', file=sys.stderr)
                return ''
            time.sleep(2 ** tries)
        except Exception as e:
            print(f'  ERROR: {e}', file=sys.stderr)
            return ''
    
    return ''


def main():
    parser = argparse.ArgumentParser(description='Batch translate sentences en→zh-CN')
    parser.add_argument('--material-id', help='Only translate for this material ID')
    parser.add_argument('--dry-run', action='store_true', help='Show translations without saving')
    parser.add_argument('--concurrency', type=int, default=5, help='Parallel API calls (default: 5)')
    parser.add_argument('--limit', type=int, help='Only process N sentences (for testing)')
    args = parser.parse_args()

    conn = get_db_connection()
    conn.autocommit = False
    cur = conn.cursor()

    # Fetch sentences without translations
    if args.material_id:
        cur.execute(
            'SELECT s.id, s.text, s."materialId", m.title '
            'FROM sentence s JOIN material m ON m.id = s."materialId" '
            'WHERE m.id = %s AND (s.translation IS NULL OR s.translation = \'\') '
            'ORDER BY s."order"',
            (args.material_id,)
        )
    else:
        cur.execute(
            'SELECT s.id, s.text, s."materialId", m.title '
            'FROM sentence s JOIN material m ON m.id = s."materialId" '
            'WHERE s.translation IS NULL OR s.translation = \'\' '
            'ORDER BY s."materialId", s."order"'
        )

    rows = cur.fetchall()

    if args.limit:
        rows = rows[:args.limit]

    print(f'Found {len(rows)} sentences to translate')

    if not rows:
        print('Nothing to translate!')
        cur.close()
        conn.close()
        return

    proxy_handler = urllib.request.ProxyHandler({
        'http': f'http://{PROXY_HOST}:{PROXY_PORT}',
        'https': f'http://{PROXY_HOST}:{PROXY_PORT}',
    })
    print(f'Using proxy {PROXY_HOST}:{PROXY_PORT}')

    # Translate
    translated_count = 0
    errors = 0

    def translate_row(row):
        sid, text, mid, title = row
        translation = translate_text(text, proxy_handler)
        time.sleep(RATE_LIMIT_DELAY)
        return (sid, text, translation, mid, title)

    start_time = time.time()

    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = {executor.submit(translate_row, row): row for row in rows}
        
        for future in as_completed(futures):
            row = futures[future]
            try:
                sid, text, translation, mid, title = future.result()
                
                if translation and translation.lower() != text.lower():
                    translated_count += 1
                    text_preview = text[:50] + '...' if len(text) > 50 else text
                    trans_preview = translation[:50] + '...' if len(translation) > 50 else translation
                    
                    if args.dry_run:
                        print(f'  [{title[:30]}] {text_preview}')
                        print(f'    → {trans_preview}')
                    else:
                        cur.execute(
                            'UPDATE sentence SET translation = %s WHERE id = %s',
                            (translation, sid)
                        )
                else:
                    errors += 1
                    print(f'  SKIP (no translation): {text[:60]}', file=sys.stderr)
                
                # Commit every 50 sentences
                if translated_count % 50 == 0 and not args.dry_run:
                    conn.commit()
                    print(f'  Committed {translated_count} translations...')
                    
            except Exception as e:
                errors += 1
                print(f'  ERROR: {e}', file=sys.stderr)

    # Final commit
    if not args.dry_run:
        conn.commit()
        print(f'\nSaved {translated_count} translations to database')
    else:
        print(f'\nDry run: would translate {translated_count} sentences')

    if errors:
        print(f'Errors: {errors}')

    elapsed = time.time() - start_time
    print(f'Time: {elapsed:.1f}s ({elapsed/len(rows):.1f}s per sentence)')

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
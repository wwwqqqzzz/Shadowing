#!/bin/bash
# Batch update wordTimings for published materials
# Prereq: Whisper base model downloaded, PostgreSQL running
# Usage: bash scripts/batch_update_wordtimings.sh

set -e

MATERIALS=(
  # material_id|audio_file|vtt_file
  # BBC 6 Minute English (VTT mapped by content)
  "adc697bc-f8bc-4c21-a91c-5df04b182889|1780134448106-ep-211230.mp3|ep-211230.vtt"
  "30db4230-b5c5-4a32-9de5-8cc12021a10a|30db4230-trimmed.mp3|ep-211223.vtt"
  "1e4b8a2f-8b37-4fd2-a43e-9ebf4f1a53ae|1e4b8a2f-trimmed.mp3|ep-211209.vtt"
  "b58f8a36-46c4-4f6d-bcce-722e7aacbe2a|b58f8a36-trimmed.mp3|ep-211216.vtt"
  "b2692299-d5d0-4fc9-8b91-c55d306ec0ba|b2692299-trimmed.mp3|ep-211125.vtt"
  "ca4edf10-bb99-46b7-9d7a-7d74e41b0db2|ca4edf10-trimmed.mp3|ep-211202.vtt"
  # BBC Learning English from the News
  "4e8558fa-182f-4a14-ac47-7e3959622e74|yt-bbcnews-solarenergy.mp3|yt-bbcnews-solarenergy.vtt"
  # BBC 6 Minute English (YouTube)
  "3b488dec-dfc6-4107-9762-7e1f73668770|yt-bbc6me-livingwithdebt.mp3|yt-bbc6me-livingwithdebt.vtt"
  # TED-Ed
  "e69d125e-7bca-4d18-8c09-25789bd1683c|yt-teded-badideas.mp3|yt-teded-badideas.vtt"
  # English Unleashed
  "032f1376-88ee-4f35-97cd-0819f2fbd9d2|yt-unleashed-shadowing.mp3|yt-unleashed-shadowing.vtt"
  # English with Lucy
  "4bfe5e76-f8a8-47f6-9b50-94d18834c1d2|yt-lucy-5tenses.mp3|yt-lucy-5tenses.vtt"
)

TOTAL=${#MATERIALS[@]}
SUCCESS=0
FAIL=0
SKIP=0

echo "=== Batch wordTimings update: $TOTAL materials ==="
echo ""

for entry in "${MATERIALS[@]}"; do
  IFS='|' read -r ID AUDIO VTT <<< "$entry"

  echo "--- [$((SUCCESS+FAIL+SKIP+1))/$TOTAL] $AUDIO ---"

  if [ ! -f "tmp/$AUDIO" ]; then
    echo "  SKIP: tmp/$AUDIO not found"
    SKIP=$((SKIP+1))
    continue
  fi

  if [ ! -f "tmp/$VTT" ]; then
    echo "  SKIP: tmp/$VTT not found"
    SKIP=$((SKIP+1))
    continue
  fi

  python3 scripts/align_sentences.py \
    --audio "tmp/$AUDIO" \
    --vtt "tmp/$VTT" \
    --update-wordtimings \
    --material-id "$ID" \
    --model base

  if [ $? -eq 0 ]; then
    echo "  OK"
    SUCCESS=$((SUCCESS+1))
  else
    echo "  FAILED"
    FAIL=$((FAIL+1))
  fi
  echo ""
done

echo "=== Done: $SUCCESS OK, $FAIL failed, $SKIP skipped out of $TOTAL ==="
echo ""
echo "Skipped (no VTT):"
echo "  f012c4d9 (Rachel's English) - rachel-quick.mp3 has no VTT"
echo "  78587efb (Vanessa) - yt-vanessa-daily.mp3 has no VTT"
echo "These need Whisper-only transcription."
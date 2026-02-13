#!/bin/bash
# Run all test files sequentially (each in its own Bun process)
# Avoids shared module cache issues with SQLite DB paths

set -e

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_ASSERT=0
FILE_COUNT=0

for f in tests/*.test.ts; do
  FILE_COUNT=$((FILE_COUNT + 1))
  echo "━━━ $f ━━━"
  output=$(bun test "$f" 2>&1)
  exit_code=$?
  
  # Extract counts (macOS-compatible grep with -o and sed)
  pass=$(echo "$output" | grep -o '[0-9]* pass' | sed 's/ pass//' || echo "0")
  fail=$(echo "$output" | grep -o '[0-9]* fail' | sed 's/ fail//' || echo "0")
  asserts=$(echo "$output" | grep -o '[0-9]* expect' | sed 's/ expect.*//' || echo "0")
  
  # Default to 0 if empty
  pass=${pass:-0}
  fail=${fail:-0}
  asserts=${asserts:-0}
  
  TOTAL_PASS=$((TOTAL_PASS + pass))
  TOTAL_FAIL=$((TOTAL_FAIL + fail))
  TOTAL_ASSERT=$((TOTAL_ASSERT + asserts))
  
  if [ $exit_code -ne 0 ]; then
    echo "$output"
    echo ""
    echo "❌ FAILED: $f ($fail failures)"
    exit 1
  else
    echo "  ✅ $pass pass, $asserts assertions"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $TOTAL_FAIL -eq 0 ]; then
  echo "✅ ALL PASSING: $TOTAL_PASS tests, $TOTAL_ASSERT assertions across $FILE_COUNT files"
else
  echo "❌ $TOTAL_FAIL FAILURES out of $((TOTAL_PASS + TOTAL_FAIL)) tests across $FILE_COUNT files"
  exit 1
fi

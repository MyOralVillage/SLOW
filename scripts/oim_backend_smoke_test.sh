#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001/api}"
API_KEY="${API_KEY:-change-me}"

echo "BASE_URL=$BASE_URL"

tmp_json="$(mktemp)"
tmp_file="$(mktemp --suffix=.pdf)"
echo "%PDF-1.4\n% SLOW test\n" > "$tmp_file"

echo "1) Create resource"
curl -sS -X POST "$BASE_URL/resources" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "title":"Withdrawal slip",
    "description":"Template and examples for customer withdrawal slips",
    "country":"Sierra Leone",
    "category":"savings",
    "type":"template",
    "productDetail":"group",
    "keywords":["withdrawal","slip"],
    "originalFilename":"Cash-Withdrawal-Slip.pdf"
  }' > "$tmp_json"

id="$(python3 - <<'PY'
import json,sys
print(json.load(open(sys.argv[1]))["id"])
PY
"$tmp_json")"

echo "   id=$id"

echo "2) Upload file"
curl -sS -X POST "$BASE_URL/resources/$id/file" \
  -H "X-API-Key: $API_KEY" \
  -F "file=@$tmp_file;type=application/pdf" > /dev/null

echo "3) List resources"
curl -sS "$BASE_URL/resources?limit=5&offset=0" | head -c 200 && echo

echo "4) Search resources"
curl -sS "$BASE_URL/resources/search?country=Sierra%20Leone&category=savings&type=template&keywords=withdrawal" | head -c 200 && echo

echo "5) Download file"
curl -sS -o /dev/null -w "   status=%{http_code}\n" "$BASE_URL/resources/$id/file"

echo "OK"


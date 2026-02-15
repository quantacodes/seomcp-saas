#!/bin/bash
# Test with real properties

SA_PATH="/Users/saura/Downloads/seoonly-ca9fda957857.json"
TEST_API_KEY="sk_live_REDACTED"

# Decode URL-encoded values
GSC_PROPS="sc-domain:happeningnownext.com,sc-domain:visatravelguides.com"
GA4_PROPS="properties/522355930,properties/522274134"

echo "=== Testing with Real Properties ==="
echo ""
echo "GSC Properties: $GSC_PROPS"
echo "GA4 Properties: $GA4_PROPS"
echo ""

# Read SA JSON
SA_JSON=$(cat "$SA_PATH")

# Test 1: gsc_list_sites
echo "=== Test 1: gsc_list_sites ==="
curl -s -X POST http://localhost:3456/v1/tools/call \
  -H "Authorization: Bearer $TEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"gsc_list_sites\",
    \"arguments\": {},
    \"credentials\": {
      \"google_service_account\": $SA_JSON,
      \"gsc_properties\": \"$GSC_PROPS\",
      \"ga4_properties\": \"$GA4_PROPS\"
    }
  }" | jq .

echo ""
echo "=== Test 2: ga4_list_properties (Admin API - may fail if not enabled) ==="
curl -s -X POST http://localhost:3456/v1/tools/call \
  -H "Authorization: Bearer $TEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"ga4_list_properties\",
    \"arguments\": {},
    \"credentials\": {
      \"google_service_account\": $SA_JSON,
      \"gsc_properties\": \"$GSC_PROPS\",
      \"ga4_properties\": \"$GA4_PROPS\"
    }
  }" | jq .

echo ""
echo "=== Test 3: gsc_performance for happeningnownext.com ==="
curl -s -X POST http://localhost:3456/v1/tools/call \
  -H "Authorization: Bearer $TEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"gsc_performance\",
    \"arguments\": {
      \"site_url\": \"sc-domain:happeningnownext.com\",
      \"start_date\": \"30daysAgo\",
      \"end_date\": \"today\",
      \"dimensions\": [\"date\"],
      \"row_limit\": 5
    },
    \"credentials\": {
      \"google_service_account\": $SA_JSON,
      \"gsc_properties\": \"$GSC_PROPS\",
      \"ga4_properties\": \"$GA4_PROPS\"
    }
  }" | jq .

echo ""
echo "=== Test 4: ga4_overview for visatravelguides.com ==="
curl -s -X POST http://localhost:3456/v1/tools/call \
  -H "Authorization: Bearer $TEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"tool\": \"ga4_overview\",
    \"arguments\": {
      \"property_id\": \"522274134\",
      \"start_date\": \"30daysAgo\",
      \"end_date\": \"today\"
    },
    \"credentials\": {
      \"google_service_account\": $SA_JSON,
      \"gsc_properties\": \"$GSC_PROPS\",
      \"ga4_properties\": \"$GA4_PROPS\"
    }
  }" | jq .

echo ""
echo "=== All Tests Complete ==="

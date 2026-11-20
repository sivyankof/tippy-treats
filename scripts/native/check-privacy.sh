#!/usr/bin/env bash
# Checks the privacy manifests of an exported iPhone app (macOS: plutil, jq) before it goes to Apple
# (docs/11a-device-build.md, section 2.1):
#   bash scripts/native/check-privacy.sh <App.ipa> <ios/App/App/PrivacyInfo.xcprivacy>
# Lists every .xcprivacy inside the .app (the root one and those of the bundles and frameworks)
# with its NSPrivacyTracking and number of NSPrivacyTrackingDomains, prints them all, and fails when
#  - any of them has NSPrivacyTracking false while NSPrivacyTrackingDomains is not empty
#    (App Store Connect refuses the build: ITMS-91064), or
#  - the one at the root of the .app is missing or is not the app's own manifest.
set -euo pipefail

ipa="${1:?usage: check-privacy.sh <App.ipa> <PrivacyInfo.xcprivacy of the app>}"
ours="${2:?usage: check-privacy.sh <App.ipa> <PrivacyInfo.xcprivacy of the app>}"

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
unzip -q "$ipa" -d "$work"
app="$(find "$work/Payload" -maxdepth 1 -name '*.app' -type d | head -n 1)"
if [ -z "$app" ]; then echo "::error::No .app inside $ipa"; exit 1; fi

# A plist (XML or binary) as sorted JSON, so two manifests compare by content, not by layout.
as_json() { plutil -convert json -o - "$1" | jq -S .; }

fail=0
echo "Privacy manifests in $(basename "$app"):"
while IFS= read -r file; do
  rel="${file#"$app"/}"
  if ! json="$(as_json "$file" 2> /dev/null)"; then
    echo "  $rel  (not a valid plist)"
    echo "::error::$rel is not a valid property list"
    fail=1
    continue
  fi
  tracking="$(jq -r '.NSPrivacyTracking // false' <<< "$json")"
  domains="$(jq -r '(.NSPrivacyTrackingDomains // []) | length' <<< "$json")"
  echo "  $rel  NSPrivacyTracking=$tracking  NSPrivacyTrackingDomains=$domains"
  if [ "$tracking" != "true" ] && [ "$domains" -gt 0 ]; then
    echo "::error::$rel: NSPrivacyTracking must be true when NSPrivacyTrackingDomains is not empty (ITMS-91064)"
    fail=1
  fi
done < <(find "$app" -name '*.xcprivacy' | sort)

root="$app/PrivacyInfo.xcprivacy"
if [ ! -f "$root" ]; then
  echo "::error::No PrivacyInfo.xcprivacy at the root of the app"
  fail=1
else
  echo "::group::Root PrivacyInfo.xcprivacy"
  plutil -p "$root"
  echo "::endgroup::"
  if ! diff <(as_json "$root") <(as_json "$ours") > /dev/null; then
    echo "::error::The PrivacyInfo.xcprivacy at the root of the app is not $ours"
    fail=1
  fi
fi

while IFS= read -r file; do
  rel="${file#"$app"/}"
  [ "$rel" = "PrivacyInfo.xcprivacy" ] && continue
  echo "::group::$rel"
  plutil -p "$file" || true
  echo "::endgroup::"
done < <(find "$app" -name '*.xcprivacy' | sort)

if [ "$fail" -eq 0 ]; then echo "privacy manifests: ok"; fi
exit "$fail"

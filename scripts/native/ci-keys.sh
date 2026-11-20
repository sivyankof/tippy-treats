#!/usr/bin/env bash
# GitHub Actions: puts the optional keys of the build into place before `npm run app:sync`
# (docs/11a-device-build.md, "Ключи рекламы, покупок и Firebase"). Each comes from a repository
# secret passed in the environment; a missing secret leaves that part on Google's sample ad ids or
# on its stub, exactly as on a computer without the key. Values are never printed, only which
# keys were there.
#   bash scripts/native/ci-keys.sh ios|android
set -euo pipefail

platform="${1:-}"
case "$platform" in ios | android) ;; *) echo "Usage: ci-keys.sh ios|android" >&2; exit 1 ;; esac

repo="$(cd "$(dirname "$0")/../.." && pwd)"
env_file="$repo/.env"
umask 077
[ -f "$env_file" ] || cp "$repo/.env.example" "$env_file"

found=""
missing=""
# name in .env <- environment variable holding the secret
put() {
  local key="$1" var="$2" value="${!2:-}"
  if [ -z "$value" ]; then missing="$missing $var"; return; fi
  # The template has the key with an empty value: drop it, then write the secret's value.
  grep -v "^$key=" "$env_file" > "$env_file.tmp" || true
  mv "$env_file.tmp" "$env_file"
  printf '%s=%s\n' "$key" "$value" >> "$env_file"
  found="$found $var"
}

if [ "$platform" = "ios" ]; then
  put VITE_ADMOB_APP_ID_IOS ADMOB_APP_ID_IOS
  put VITE_ADMOB_REWARDED_ID_IOS ADMOB_REWARDED_ID_IOS
  put VITE_ADMOB_INTERSTITIAL_ID_IOS ADMOB_INTERSTITIAL_ID_IOS
  put VITE_REVENUECAT_API_KEY_IOS REVENUECAT_API_KEY_IOS
  if [ -n "${FIREBASE_IOS_PLIST:-}" ]; then
    printf '%s' "$FIREBASE_IOS_PLIST" | base64 --decode > "$repo/ios/App/App/GoogleService-Info.plist"
    found="$found FIREBASE_IOS_PLIST"
  else
    missing="$missing FIREBASE_IOS_PLIST"
  fi
else
  put VITE_ADMOB_APP_ID_ANDROID ADMOB_APP_ID_ANDROID
  put VITE_ADMOB_REWARDED_ID_ANDROID ADMOB_REWARDED_ID_ANDROID
  put VITE_ADMOB_INTERSTITIAL_ID_ANDROID ADMOB_INTERSTITIAL_ID_ANDROID
  put VITE_REVENUECAT_API_KEY_ANDROID REVENUECAT_API_KEY_ANDROID
  if [ -n "${FIREBASE_ANDROID_JSON:-}" ]; then
    printf '%s' "$FIREBASE_ANDROID_JSON" | base64 --decode > "$repo/android/app/google-services.json"
    found="$found FIREBASE_ANDROID_JSON"
  else
    missing="$missing FIREBASE_ANDROID_JSON"
  fi
fi

echo "Keys of this build:${found:- none}"
echo "Not set (sample ad ids or the stub instead):${missing:- none}"

#!/usr/bin/env bash
# Builds the signed Android App Bundle for Google Play on this computer and checks its signature
# (docs/11a-device-build.md, section 3.3). Needs android/keystore.properties (make-upload-key.sh)
# and a JDK 21 plus the Android SDK; by default the portable copies in ~/android-tools:
#   bash scripts/native/build-aab.sh <build number> [--store]
# Without --store the bundle is the internal build (debug menu in the settings). The bundle is
# copied to ../tippy-treats-store-assets/builds/tippy-treats-<version>-<build>-<kind>.aab.
set -euo pipefail

build="${1:-}"
case "$build" in '' | *[!0-9]*) echo "Usage: build-aab.sh <build number> [--store]" >&2; exit 1 ;; esac
kind="internal"
if [ "${2:-}" = "--store" ]; then kind="store"; fi

repo="$(cd "$(dirname "$0")/../.." && pwd)"
tools="${TIPPY_ANDROID_TOOLS:-$HOME/android-tools}"
if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(ls -d "$tools"/jdk-21* 2>/dev/null | head -n 1 || true)"
fi
export JAVA_HOME
export ANDROID_HOME="${ANDROID_HOME:-$tools/sdk}"
export PATH="$JAVA_HOME/bin:$PATH"
if [ ! -x "$JAVA_HOME/bin/java" ] && [ ! -x "$JAVA_HOME/bin/java.exe" ]; then
  echo "No JDK 21 found (JAVA_HOME or $tools/jdk-21*)." >&2; exit 1
fi
if [ ! -d "$ANDROID_HOME/platforms" ]; then echo "No Android SDK in $ANDROID_HOME." >&2; exit 1; fi
if [ ! -f "$repo/android/keystore.properties" ]; then
  echo "No android/keystore.properties: the bundle would be unsigned." >&2; exit 1
fi

cd "$repo"
if [ "$kind" = "store" ]; then npm run app:sync; else npm run app:sync:internal; fi
(cd android && ./gradlew --no-daemon bundleRelease -PbuildNumber="$build")

version="$(node scripts/native/app-version.cjs)"
out_dir="$repo/../tippy-treats-store-assets/builds"
out="$out_dir/tippy-treats-$version-$build-$kind.aab"
mkdir -p "$out_dir"
cp android/app/build/outputs/bundle/release/app-release.aab "$out"

# The bundle must be signed by the upload key and nothing else.
verify="$(jarsigner -verify -verbose:summary -certs "$out" 2>&1)"
if ! grep -q "jar verified" <<<"$verify"; then echo "$verify" >&2; echo "Signature check failed." >&2; exit 1; fi
echo "Bundle: $out ($(wc -c <"$out") bytes)"
echo "Signer: $(grep -m 1 -o 'CN=[^,]*' <<<"$verify")"
cert="$(unzip -Z1 "$out" 'META-INF/*.RSA' 'META-INF/*.EC' 2>/dev/null | head -n 1 || true)"
if [ -n "$cert" ]; then
  echo "Signer SHA-256: $(unzip -p "$out" "$cert" | keytool -printcert 2>/dev/null | grep -m 1 'SHA256:' | sed 's/.*SHA256: //')"
fi

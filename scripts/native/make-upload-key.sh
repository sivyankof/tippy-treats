#!/usr/bin/env bash
# Creates the Android upload key (PKCS12, alias "upload", RSA 4096, valid 30 years) outside the
# repository and the local android/keystore.properties that points the release build at it.
# Needs only openssl (Git Bash has it); no JDK. The password comes from the environment and is
# never printed:
#   TIPPY_KEY_PASSWORD='...' bash scripts/native/make-upload-key.sh [<folder>]
# Default folder: ../tippy-treats-store-assets/android-signing next to the repository.
# An existing key is never overwritten: losing or replacing it locks the app out of updates.
set -euo pipefail
# Git Bash on Windows would turn "/CN=..." into a file path.
export MSYS2_ARG_CONV_EXCL="/CN="

repo="$(cd "$(dirname "$0")/../.." && pwd)"
dir="${1:-$repo/../tippy-treats-store-assets/android-signing}"
key="$dir/tippy-upload.p12"
props="$repo/android/keystore.properties"

if [ -z "${TIPPY_KEY_PASSWORD:-}" ]; then echo "Set TIPPY_KEY_PASSWORD first." >&2; exit 1; fi
if [ "${#TIPPY_KEY_PASSWORD}" -lt 8 ]; then echo "The password needs at least 8 characters." >&2; exit 1; fi
# Java (Gradle, jarsigner) refuses a PKCS12 password outside ASCII, and openssl on Windows reads a
# non-ASCII one in the local code page: such a key opens only in openssl.
if LC_ALL=C grep -q '[^ -~]' <<<"$TIPPY_KEY_PASSWORD"; then
  echo "Use only Latin letters, digits and ASCII symbols in the password." >&2; exit 1
fi
if [ -e "$key" ]; then echo "A key already exists: $key (not overwritten)." >&2; exit 1; fi

mkdir -p "$dir"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
umask 077
openssl req -x509 -newkey rsa:4096 -sha256 -days 10950 -nodes \
  -subj "/CN=Tippy Treats/O=Tippy Treats" \
  -keyout "$work/key.pem" -out "$work/cert.pem"
openssl pkcs12 -export -name upload \
  -inkey "$work/key.pem" -in "$work/cert.pem" \
  -out "$key" -passout env:TIPPY_KEY_PASSWORD
# The certificate alone (no secret) for the owner's records; Google Play shows its fingerprint too.
cp "$work/cert.pem" "$dir/tippy-upload-certificate.pem"

# Forward slashes: Gradle reads the path the same on Windows and elsewhere.
key_path="$(cd "$dir" && pwd -W 2>/dev/null || pwd)/tippy-upload.p12"
# A properties file reads a backslash as an escape: double it.
prop_password="${TIPPY_KEY_PASSWORD//\\/\\\\}"
cat > "$props" <<PROPS
# Local release signing (docs/11a-device-build.md). Never commit this file.
storeFile=$key_path
storeType=pkcs12
storePassword=$prop_password
keyAlias=upload
keyPassword=$prop_password
PROPS
echo "Key: $key"
echo "SHA-256 fingerprint: $(openssl x509 -in "$work/cert.pem" -noout -fingerprint -sha256 | cut -d= -f2)"
echo "Signing settings: $props (git-ignored)"

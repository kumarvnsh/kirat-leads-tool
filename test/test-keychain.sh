#!/bin/zsh
set -eu
ROOT="${0:A:h:h}"
BUILD="$(mktemp -d /tmp/kirat-keychain-test.XXXXXX)"
trap 'rm -rf "$BUILD"' EXIT
/usr/bin/xcrun swiftc "$ROOT/mac/KiratKeychain.swift" -o "$BUILD/kirat-keychain" -framework Security
/usr/bin/codesign --force --sign - "$BUILD/kirat-keychain"
RESULT="$("$BUILD/kirat-keychain" --self-test)"
[[ "$RESULT" == '{"ok":true}' ]]
print 'Keychain isolated write/read/delete self-test passed'

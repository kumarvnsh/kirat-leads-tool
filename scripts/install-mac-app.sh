#!/bin/zsh
set -eu
ROOT="${0:A:h:h}"
APP="$HOME/Applications/Kirat Lead Desk.app"
mkdir -p "$HOME/Applications"
if [[ -e "$APP" && ! -f "$APP/Contents/Resources/kirat-launcher.txt" ]]; then
  print -u2 "An unrelated app already exists at $APP; move it before installing."
  exit 1
fi
BUILD="$(mktemp -d /tmp/kirat-app.XXXXXX)"
trap 'rm -rf "$BUILD"' EXIT
KEYCHAIN_DIR="$ROOT/.local/bin"
mkdir -p "$KEYCHAIN_DIR"
/usr/bin/xcrun swiftc "$ROOT/mac/KiratKeychain.swift" -o "$BUILD/kirat-keychain" -framework Security -target "$(uname -m)-apple-macosx13.0"
/usr/bin/codesign --force --sign - --identifier com.kiratcreations.leaddesk.keychain "$BUILD/kirat-keychain"
mv "$BUILD/kirat-keychain" "$KEYCHAIN_DIR/kirat-keychain"
chmod 700 "$KEYCHAIN_DIR/kirat-keychain"
BUNDLE="$BUILD/Kirat Lead Desk.app"
mkdir -p "$BUNDLE/Contents/MacOS" "$BUNDLE/Contents/Resources"
/usr/bin/xcrun swiftc "$ROOT/mac/KiratApp.swift" -o "$BUNDLE/Contents/MacOS/KiratLeadDesk" -framework Cocoa -framework WebKit -target "$(uname -m)-apple-macosx13.0"
cp "$ROOT/assets/Kirat.icns" "$BUNDLE/Contents/Resources/Kirat.icns"
print -r -- "$ROOT" >"$BUNDLE/Contents/Resources/project-path.txt"
print 'Kirat-owned launcher' >"$BUNDLE/Contents/Resources/kirat-launcher.txt"
cat >"$BUNDLE/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>KiratLeadDesk</string>
<key>CFBundleIdentifier</key><string>com.kiratcreations.leaddesk</string>
<key>CFBundleName</key><string>Kirat Lead Desk</string>
<key>CFBundleDisplayName</key><string>Kirat Lead Desk</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.4</string>
<key>CFBundleVersion</key><string>5</string>
<key>CFBundleIconFile</key><string>Kirat</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>
</dict></plist>
PLIST
/usr/bin/codesign --force --sign - "$BUNDLE"
if [[ -d "$APP" ]]; then rm -rf "$APP"; fi
mv "$BUNDLE" "$APP"
print "Installed native Mac app: $APP"

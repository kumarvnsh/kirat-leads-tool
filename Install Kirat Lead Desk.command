#!/bin/zsh
set -eu
ROOT="${0:A:h}"
/bin/zsh "$ROOT/scripts/install-mac-app.sh"
/usr/bin/open "$HOME/Applications/Kirat Lead Desk.app"

#!/bin/bash
# Installa la copia di sicurezza settimanale con launchd (una volta sola; rilanciarlo aggiorna lo script).
# launchd la fa partire all'accensione/accesso e poi ogni ora; lo script lavora solo se manca la copia
# della domenica più recente. Log: ~/Backup/app-verifiche/copia.log
#   bash scripts/installa-copia.sh            installa o aggiorna
#   bash scripts/installa-copia.sh --togli    disinstalla (le copie restano)
set -euo pipefail
NOME="app-verifiche.copia-sicurezza"
DEST="$HOME/Backup/app-verifiche"
PLIST="$HOME/Library/LaunchAgents/$NOME.plist"
launchctl bootout "gui/$(id -u)/$NOME" 2>/dev/null || true
if [[ "${1:-}" == "--togli" ]]; then rm -f "$PLIST"; echo "tolta (le copie in $DEST restano)"; exit 0; fi

mkdir -p "$DEST/.bin" "$HOME/Library/LaunchAgents"
# Lo script vive fuori dal repo: la copia continua anche se la cartella del repo cambia.
cp "$(dirname "$0")/copia-sicurezza.sh" "$DEST/.bin/copia-sicurezza.sh"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$NOME</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$DEST/.bin/copia-sicurezza.sh</string></array>
  <key>RunAtLoad</key><true/>
  <key>StartInterval</key><integer>3600</integer>
  <key>StandardOutPath</key><string>$DEST/copia.log</string>
  <key>StandardErrorPath</key><string>$DEST/copia.log</string>
  <key>ProcessType</key><string>Background</string>
</dict>
</plist>
PLIST
plutil -lint "$PLIST" > /dev/null
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "installata: $PLIST"
launchctl print "gui/$(id -u)/$NOME" | grep -E "state|run interval|last exit" || true

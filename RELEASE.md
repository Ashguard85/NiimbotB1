# Release v3

Kompatibel mit Docker v3.

## Änderungen
- Shortcut-API aus v2 bleibt vollständig erhalten (`#qr=...`, `text`, `copies`, `density`, `offset`, `ecc`, `size`, `autoprint=1`).
- ZIP-Importer schützt jetzt den gesamten Ordner `.github/workflows/`; automatische Imports ändern niemals Workflow-Dateien.
- Zusätzlicher Safety-Check bricht ab, falls dennoch ein Workflow im Commit landen würde.
- Alte Top-Level-Release-ZIPs werden nach erfolgreichem Import entfernt.
- `workflow_dispatch` wird unterstützt.
- `actions/checkout@v5` und `actions/upload-pages-artifact@v5` für aktuellen Node-24-kompatiblen Workflow-Pfad.
- Service-Worker-Cache auf `qr-label-pwa-v3` erhöht.

## Einmalige Migration von v2-Repositorys
Der v2-Importer schützt nur seine eigene Datei und kann sich deshalb absichtlich nicht selbst aktualisieren. In einem bereits bestehenden v2-Repository muss `.github/workflows/import-zip.yml` einmal manuell angepasst werden: beim `rsync` den Ausschluss auf `.github/workflows/` erweitern. Danach können zukünftige ZIP-Releases ohne Workflow-Schreibrechte importiert werden.

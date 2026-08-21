# QR Label v33

## v33 – Subcaption / zweite Textzeile

Zusätzlich zur bestehenden `caption` unterstützt v33 eine zweite, kleinere Zeile **`subcaption`**, z. B. für eine Raumbezeichnung.

Beispiel:

`#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D12345&caption=IAM-12345&subcaption=Raum%202.14&quiet=2`

- `caption` = primäre Beschriftung, z. B. Asset-ID
- `subcaption` = zweite kleinere Zeile, z. B. Raum / Standort
- Offline-Renderer berechnet QR, Caption und Subcaption gemeinsam, damit nichts überlappt.
- Im QuickChart-Modus bleibt die normale Caption Bestandteil des QuickChart-Bildes; die Subcaption wird anschließend lokal unterhalb ergänzt.
- PNG, PDF und NIIMBOT-Druck verwenden immer das fertig gerenderte Canvas und enthalten daher beide Textzeilen.
- Vorlagen speichern und laden `subcaption` mit.
- B1/B1 Pro/M2-H sowie die v32-Ruheraum-Steuerung bleiben erhalten.


## v33 – steuerbarer QR-Ruheraum im lokalen Renderer

Der Offline-Renderer hatte bisher fest **4 QR-Module Weißraum pro Seite** reserviert. Das ist standardkonform, kann auf flachen Labels wie 50×30 mm aber dazu führen, dass die eigentliche schwarze QR-Matrix deutlich kleiner wird als erwartet.

v33 macht diesen Wert sichtbar und steuerbar:

- **QR-Ruheraum: 0–8 Module**
- Standard: **4 Module** (QR-Standard / beste Scan-Reserve)
- kleinere Werte: größere QR-Matrix, aber weniger Scan-Reserve
- gilt **nur für Offline (lokal)**
- QuickChart bleibt unverändert und verwendet seine eigene `margin`-Logik
- URL-Parameter: `quiet=`, alternativ `qrspace=` oder `quietzone=`

Beispiel:

`#url=https%3A%2F%2FmeineURL.com%2Fasset%3Fid%3D12345&label=50x30&quiet=2`

Bei einem 25×25-QR kann ein reduzierter Ruheraum sichtbar mehr schwarze Matrixfläche freigeben. Für produktive Etiketten sollte der kleinste zuverlässig scanbare Wert mit den realen Scannern getestet werden.


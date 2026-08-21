# QR Label v41
## v41 – direkter Designer

Texterfassung steht als erster einklappbarer Bereich ganz oben. Im Designer selektiert ein Tap QR, Caption oder Subcaption direkt auf der Vorschau; Drag verschiebt. Bearbeiten/Sperren schützt vor Fehlbedienung. Elemente können in 0/90/180/270° gedreht werden; „Gesamtes Design 90°“ dreht Positionen und Elemente gemeinsam. Der manuelle QR bleibt ohne automatische Quiet Zone und nutzt seine quadratische Fläche maximal.


## v41 – Tablet-first Label Designer

v41 ist der größere UI-Sprung: Die Vorschau steht jetzt im Mittelpunkt und der Label-Designer liegt **zwingend direkt darunter**. Inhalt, Renderer und Druckoptionen sind in einklappbare Bereiche gegliedert, damit die Oberfläche auf Tablets schlank bleibt.

Wichtig: Sobald die manuelle Designer-Platzierung aktiv ist, zeichnet der lokale Renderer **keinen automatischen QR-Ruheraum**. Die QR-Box entspricht der tatsächlichen QR-Matrix. Abstand zu Etikettrand und Text bestimmt der Benutzer vollständig über Position und Größe. Außerhalb des manuellen Designers bleibt `quiet=` wie bisher wirksam.

Alle bisherigen Eingaben bleiben erhalten: Schnell erfassen, Kamera-QR, Foto/Bild, Zwischenablage, QR-Ziel, automatische Jira-/Assets-Caption samt Prefix, Subcaption, Caption-Größe, Labelgröße, ECC, Offline/QuickChart, Druckerautomatik, PNG/PDF, Vorlagen und Return-Shortcut.


## v41 – visueller Label-Designer

v41 ergänzt einen lokalen Designer direkt in der Labelvorschau. Es gibt bewusst **noch kein Layout-Preset-System** und keinen `layout=`-URL-Parameter.

- Designer pro Labelgröße aktivieren/deaktivieren
- Element auswählen: **QR**, **Caption**, **Subcaption**
- Element direkt in der Vorschau mit Touch/Maus verschieben
- X/Y zusätzlich über Slider fein einstellen
- Größe jedes Elements separat skalieren
- Element zentrieren oder einzeln zurücksetzen
- kompletten Designer für die aktuelle Labelgröße zurücksetzen
- Einstellungen werden lokal pro Labelgröße gespeichert
- Druck, PNG und PDF verwenden genau das Designer-Canvas

Der Designer arbeitet ausschließlich mit **Offline (lokal)**. Beim Aktivieren wechselt die App deshalb automatisch auf den lokalen Renderer. QuickChart bleibt als separater, unveränderter Renderweg verfügbar.


## v41 – Subcaption / zweite Textzeile

Zusätzlich zur bestehenden `caption` unterstützt v41 eine zweite, kleinere Zeile **`subcaption`**, z. B. für eine Raumbezeichnung.

Beispiel:

`#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D12345&caption=IAM-12345&subcaption=Raum%202.14&quiet=2`

- `caption` = primäre Beschriftung, z. B. Asset-ID
- `subcaption` = zweite kleinere Zeile, z. B. Raum / Standort
- Offline-Renderer berechnet QR, Caption und Subcaption gemeinsam, damit nichts überlappt.
- Im QuickChart-Modus bleibt die normale Caption Bestandteil des QuickChart-Bildes; die Subcaption wird anschließend lokal unterhalb ergänzt.
- PNG, PDF und NIIMBOT-Druck verwenden immer das fertig gerenderte Canvas und enthalten daher beide Textzeilen.
- Vorlagen speichern und laden `subcaption` mit.
- B1/B1 Pro/M2-H sowie die v32-Ruheraum-Steuerung bleiben erhalten.


## v41 – steuerbarer QR-Ruheraum im lokalen Renderer

Der Offline-Renderer hatte bisher fest **4 QR-Module Weißraum pro Seite** reserviert. Das ist standardkonform, kann auf flachen Labels wie 50×30 mm aber dazu führen, dass die eigentliche schwarze QR-Matrix deutlich kleiner wird als erwartet.

v41 macht diesen Wert sichtbar und steuerbar:

- **QR-Ruheraum: 0–8 Module**
- Standard: **4 Module** (QR-Standard / beste Scan-Reserve)
- kleinere Werte: größere QR-Matrix, aber weniger Scan-Reserve
- gilt **nur für Offline (lokal)**
- QuickChart bleibt unverändert und verwendet seine eigene `margin`-Logik
- URL-Parameter: `quiet=`, alternativ `qrspace=` oder `quietzone=`

Beispiel:

`#url=https%3A%2F%2FmeineURL.com%2Fasset%3Fid%3D12345&label=50x30&quiet=2`

Bei einem 25×25-QR kann ein reduzierter Ruheraum sichtbar mehr schwarze Matrixfläche freigeben. Für produktive Etiketten sollte der kleinste zuverlässig scanbare Wert mit den realen Scannern getestet werden.


# Release v5

Kompatibel mit Docker v5.

## Neu
- Labelformate `50x30` und `40x40` auswählbar.
- `50x30` nutzt die hardwarevalidierten Geometrien des NIIMBOT-Webtreibers: B1 `384×240`, B1 Pro `584×354`.
- `40x40` nutzt abgeleitete Geometrien: B1 `320×320`, B1 Pro `472×472`; der Vertikal-Offset kann pro Gerät/Rolle feinjustiert werden.
- Ein QuickChart-QR-Link kann direkt in das QR-Feld eingefügt werden. Die App übernimmt `text`, `caption`, `ecLevel` und das Verhältnis `captionFontSize / size` lokal, ohne das QuickChart-Bild laden zu müssen.
- Das QuickChart-Feld `size` ist nur die Pixel-Referenz des QR-Bilds und ändert nicht das physische Labelformat.
- Shortcut-API unterstützt zusätzlich `quickchart=`/`source=`, `label=40x40` und `captionpct=`.
- Vorlagen und Druckhistorie speichern das Labelformat; Vorlagen speichern zusätzlich die Caption-Skalierung.
- Backup-Format v2; Restore akzeptiert v1 und v2.
- SQLite-Schema v2 migriert bestehende Daten automatisch um `label_size` und `caption_scale`.
- Service-Worker-Cache `qr-label-pwa-v5`.

## Hardware-Hinweis
`40x40` ist in diesem Projekt eine berechnete Geometrie und wurde in dieser Umgebung nicht auf echter B1/B1-Pro-Hardware kalibriert. Vor produktiver Nutzung einen Testdruck machen und bei Bedarf den vertikalen Offset korrigieren.


## Änderungen v5
- **40×40 mm ist ab v5 der Standard** für neue Labels und wird beim ersten Start von v5 einmalig als aktive Standardgröße gesetzt. Gespeicherte Vorlagen behalten ihr eigenes Labelformat.
- Neuer **PDF-Export**. Die PDF-Seite besitzt exakt die physische Größe des aktuell gewählten Labels (standardmäßig 40×40 mm), nicht A4/Letter.
- Lokale Frontend-Assets tragen `?v=5`, damit ein alter Service Worker nach einem Deployment nicht weiter unbemerkt v3/v4-JavaScript ausliefert.

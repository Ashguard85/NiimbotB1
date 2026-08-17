# Release v8

Kompatibel mit Docker v8.

## Änderungen v8

- Tablet-first Zweispalten-UI: Einstellungen links, große Vorschau rechts; iPhone automatisch einspaltig.
- Quelle/QuickChart-Link und tatsächliches QR-Ziel sind getrennt, damit der Original-Link erhalten bleibt.
- QuickChart-Importstatus mit Parameteranzeige.
- Caption-Größe als Slider; QuickChart `captionFontSize / size` wird automatisch übernommen.
- 40×40 mm bleibt Standard; 50×30 mm als zweite Formatkarte.
- Zwei klare Renderwege: Offline lokal oder QuickChart API.
- QuickChart API verwendet das von QuickChart gerenderte Bild inkl. Caption-Layout.
- Offline-Renderer mit engerer Caption-Positionierung.
- Vorschauwerkzeuge: Zoom, Gitter, Sicherheitsrand und Invert.
- Parameter-Tabelle zeigt QR-Ziel, Caption, Caption-Größe, QuickChart-Größe, Fehlerkorrektur und aktiven Renderer.
- Drucken, PNG und PDF verwenden weiterhin exakt den aktuell gerenderten Canvas.
- Service-Worker-Cache und Asset-Version auf v8 erhöht.

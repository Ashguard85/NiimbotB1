# Release v9

Kompatibel mit Docker v9.

## Änderungen v9

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
- Service-Worker-Cache und Asset-Version auf v9 erhöht.


## v9 – Jira/Assets Schnellworkflow

- Live-Kamera-QR-Scanner via getUserMedia + jsQR-Fallbackdecoder.
- QR-Auslesen aus Foto/Bild; auf iOS kann der Dateidialog direkt die Kamera anbieten.
- Zwischenablage-Button für Jira-/Assets-Links.
- Automatische Asset-Caption für Jira-artige URLs, z. B. ShowObject.jspa?id=43322 → IAM-43322; Prefix konfigurierbar.
- PNG auf iPhone/iPad bevorzugt über Web Share als echte Datei; Fallback öffnet das PNG zum Sichern.
- Shortcut-Parameter `url=` wird zusätzlich zu `source=`/`qr=` unterstützt.
- Scanner-Bibliothek jsQR 1.4.0 wird vom Service Worker nach erfolgreichem Laden gecacht.

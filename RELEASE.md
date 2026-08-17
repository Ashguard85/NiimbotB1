# Release v7

Kompatibel mit Docker v7.

## Änderungen v7

- Zwei Renderwege: **QuickChart API** und **Offline lokal**.
- Beim Einfügen eines QuickChart-QR-Links wird automatisch der QuickChart-API-Modus gewählt.
- QuickChart rendert das Originalbild inklusive `caption`, `captionFontSize`, `margin`, Fehlerkorrektur und unterstützten Stilparametern; das fertige Bild wird auf das aktuelle Label skaliert.
- Bei Netzwerk-/CORS-/Timeout-Fehlern fällt die App automatisch auf den lokalen Renderer zurück.
- Lokaler Renderer positioniert die Caption deutlich näher am QR-Code und bleibt vollständig offline nutzbar.
- Drucken, PNG und PDF warten auf den aktuellen Renderer und verwenden exakt die sichtbare Vorschau.
- QuickChart-Requests haben Timeout und einen kleinen In-Memory-Cache, um unnötige Wiederholungen zu vermeiden.
- Service-Worker-Cache `qr-label-pwa-v7`, lokale Assets mit `?v=7`.
- 40×40 mm bleibt Standard.

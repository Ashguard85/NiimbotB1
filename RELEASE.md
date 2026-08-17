# Release v6

Kompatibel mit Docker v6.

## Änderungen v6
- QuickChart-Import für Bluefy/iOS gehärtet: vollständige QuickChart-URL, URL ohne `https://` und reiner Query-Text wie `text=...&size=...&caption=...&captionFontSize=...` werden erkannt.
- Erkennung zusätzlich über `input`, da Bluefy/iOS beim Einfügen nicht immer zuverlässig `paste` meldet.
- `caption` wird sofort in „Text unter QR“ übernommen und neu gerendert.
- Vorschau hält das reale Seitenverhältnis: 40×40 ist sichtbar quadratisch, 50×30 entsprechend rechteckig.
- Service-Worker-Cache `qr-label-pwa-v6`, Assets mit `?v=6`.
- 40×40 mm bleibt Standard; PDF übernimmt aktive Labelgröße und Caption.

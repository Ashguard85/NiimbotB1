# Release v10

Kompatibel mit Docker v10.

## Änderungen v10

- iPhone/iPad/Bluefy-Druck stabilisiert: Das Canvas wird nicht mehr als `data:`-URL an den NIIMBOT-Treiber übergeben, sondern als kurzlebige `blob:`-URL. Damit wird der in Bluefy beobachtete Fehler `Load failed` beim internen `fetch(data:...)` vermieden.
- Für NIIMBOT B1 auf iOS/Bluefy wird der BLE-Transport konservativ gesetzt: `WRITE_MODE=paced` und `BUNDLE_MAX=180`.
- Druckfehler werden genauer erklärt.
- Service-Worker-Cache und Asset-Version auf v10 erhöht.
- Alle Funktionen aus v9 bleiben erhalten: Jira/Asset-Erkennung, Kamera-/Bild-QR-Scanner, QuickChart-/Offline-Renderer, 40×40-Standard, PNG/PDF, Vorlagen und Shortcut-Parameter.

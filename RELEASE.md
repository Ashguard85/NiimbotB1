# Release v11

Kompatibel mit Docker/Pages v11.

## Änderungen v11

- Bluefy-Druckpfad grundlegend geändert: Das bereits gerenderte Label-Canvas wird direkt an den NIIMBOT-Treiber übergeben.
- Der vom Upstream-Treiber intern verwendete Pfad `fetch(url) -> blob() -> createImageBitmap()` wird für Druckaufträge vollständig überbrückt; weder `data:`- noch `blob:`-URLs müssen von Bluefy für den Druck dekodiert werden.
- Der Adapter greift nur für die eine synthetische Druck-URL und stellt `window.fetch` / `window.createImageBitmap` danach sofort wieder her. Andere Requests bleiben unverändert.
- Für NIIMBOT B1 auf iOS/Bluefy bleiben `WRITE_MODE=paced` und `BUNDLE_MAX=180` aktiv.
- Fehlermeldungen unterscheiden jetzt einen verbleibenden `Load failed` vom früheren Bild-Ladeproblem.
- Service-Worker-Cache und Asset-Version auf v11 erhöht.
- Alle Funktionen aus v10 bleiben erhalten: Jira/Asset-Erkennung, Kamera-/Bild-QR-Scanner, QuickChart-/Offline-Renderer, 40×40-Standard, PNG/PDF, Vorlagen und Shortcut-Parameter.

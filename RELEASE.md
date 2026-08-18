# v22

- Safari/beacio: nur der tatsächlich verbundene Drucktab besitzt den Fensternamen `niimbot-print`.
- Neue Safari-Tabs mit `#url=`, `#qr=` oder QuickChart-Parametern übergeben automatisch an einen vorhandenen verbundenen Primary-Tab.
- Dadurch wird das Befüllen unabhängig von `handoff.html`/`handoff=1`, sobald bereits ein verbundener Drucktab existiert.
- Fokuswechsel bleibt browserabhängig; der Benutzer-gestützte Wechsel adressiert nun eindeutig den verbundenen Tab.

# Release v22

- Safari + beacio: neutraler Bluetooth-Gerätewähler für den Verbindungsaufbau.
- Unter iPhone/Safari+beacio wird der enge NIIMBOT-Chooser-Filter temporär durch `acceptAllDevices: true` ersetzt; die vom NIIMBOT-Treiber angeforderten `optionalServices` bleiben erhalten.
- Nach der Gerätewahl übernimmt wieder der unveränderte NIIMBOT-Treiber und prüft Modell/GATT/Protokoll. Unterstützt bleiben B1 und B1 Pro.
- Verbindungsstatus unterscheidet jetzt: Treiber vorbereiten → beacio-Geräteauswahl → Gerät gewählt → NIIMBOT erkannt → verbunden bzw. konkrete Fehlermeldung.
- Bluefy nutzt weiterhin den bisherigen NIIMBOT-Chooser und bleibt als Fallback verfügbar.
- B1 nutzt auf iOS weiterhin konservative CoreBluetooth-Transportwerte.
- Versions-/Cache-Korrektur: UI, Asset-Query und Service-Worker-Cache sind konsistent v22 / `qr-label-pwa-v22`.


## v22
- Stabilisiert den Safari+beacio-Gerätewähler: während `requestDevice()` wird die schwere App-Oberfläche temporär ausgeblendet und Live-Rendering pausiert.
- Der tatsächlich verbundene Drucktab wird als Primary Printer Tab registriert und bei Handoffs exakt priorisiert.
- Bluefy/Safari-Handoff bleibt ohne Server-Endpunkt.


## v25 Handoff-Handler
- Transaktionale Handoff-Requests mit eindeutiger Request-ID und ACK des Ziel-Tabs.
- Kurzer Lock pro Primary-Drucktab verhindert überlappende Übergaben.
- Persistente per-Tab Inbox bleibt die Quelle der Wahrheit; BroadcastChannel/localStorage beschleunigen nur.
- Rückkehr-/Close-Handler probiert Fokus und alle sicheren browserseitigen Close-Varianten erst nach bestätigter Übernahme.
- Wenn Bluefy das Schließen verweigert, bleibt der Hilfstab inert; Drucktab und BLE-Verbindung bleiben unangetastet.

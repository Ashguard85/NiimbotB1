# Release v28

- Option „Nach URL-Aufruf automatisch drucken“ (Default: aus).
- Auto-Print startet erst nach erfolgreicher Wiederverbindung des bekannten NIIMBOT.
- `autoprint=1` bleibt als expliziter URL-Override erhalten.
- Bestehende Option „Nach erfolgreichem Druck trennen“ kann anschließend BLE freigeben.
- Keine automatische Ausgabe nur aufgrund eines gespeicherten alten Entwurfs.

# v28 – Known-device Reconnect Test

- `navigator.bluetooth.getDevices()` wird genutzt, um einen bereits freigegebenen NIIMBOT in einem neuen Tab wiederzufinden.
- Der bekannte Drucker wird anhand Geräte-ID, ersatzweise Name, ausgewählt und ohne erneuten Chooser an den NIIMBOT-Treiber übergeben.
- Der normale Verbinden-Button versucht zuerst den bekannten Drucker; „Alle Bluetooth-Geräte anzeigen“ erzwingt weiterhin den manuellen Chooser.
- Bei URL-/Shortcut-Start mit QR-Inhalt wird ein bekannter Drucker automatisch wiederverbunden, wenn die Option aktiviert ist.
- Neue Optionen: „Bekannten Drucker automatisch verbinden“ und „Nach erfolgreichem Druck trennen“, beide standardmäßig aktiv.
- Nach bestätigtem Druck wartet die App 800 ms und trennt anschließend GATT, damit ein neuer Tab den Drucker übernehmen kann.
- UI-/Asset-/Service-Worker-Version auf v28 angehoben.

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


## v26 Handoff-Handler
- Transaktionale Handoff-Requests mit eindeutiger Request-ID und ACK des Ziel-Tabs.
- Kurzer Lock pro Primary-Drucktab verhindert überlappende Übergaben.
- Persistente per-Tab Inbox bleibt die Quelle der Wahrheit; BroadcastChannel/localStorage beschleunigen nur.
- Rückkehr-/Close-Handler probiert Fokus und alle sicheren browserseitigen Close-Varianten erst nach bestätigter Übernahme.
- Wenn Bluefy das Schließen verweigert, bleibt der Hilfstab inert; Drucktab und BLE-Verbindung bleiben unangetastet.


## v26 Handoff-Abschluss
Nach bestätigter Übergabe entfernt der Bluefy-Hilfstab alle Label-/Asset-Daten aus URL und Oberfläche und zeigt nur noch „Label übernommen – zurück zum Drucktab“. Automatische Close-/Focus-Versuche laufen still weiter; es werden keine weiteren Controls eingeblendet.

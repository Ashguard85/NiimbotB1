# Release v20

- Safari + beacio: neutraler Bluetooth-Gerätewähler für den Verbindungsaufbau.
- Unter iPhone/Safari+beacio wird der enge NIIMBOT-Chooser-Filter temporär durch `acceptAllDevices: true` ersetzt; die vom NIIMBOT-Treiber angeforderten `optionalServices` bleiben erhalten.
- Nach der Gerätewahl übernimmt wieder der unveränderte NIIMBOT-Treiber und prüft Modell/GATT/Protokoll. Unterstützt bleiben B1 und B1 Pro.
- Verbindungsstatus unterscheidet jetzt: Treiber vorbereiten → beacio-Geräteauswahl → Gerät gewählt → NIIMBOT erkannt → verbunden bzw. konkrete Fehlermeldung.
- Bluefy nutzt weiterhin den bisherigen NIIMBOT-Chooser und bleibt als Fallback verfügbar.
- B1 nutzt auf iOS weiterhin konservative CoreBluetooth-Transportwerte.
- Versions-/Cache-Korrektur: UI, Asset-Query und Service-Worker-Cache sind konsistent v20 / `qr-label-pwa-v20`.

# QR Label – Pages v1

Statische GitHub-Pages-PWA zum Erzeugen und direkten Drucken von QR-Labels auf NIIMBOT B1/B1 Pro via Web Bluetooth.

## Kurzarchitektur

- Gemeinsame Frontend-Codebasis mit Docker v1.
- Druckpfad ist immer lokal: Browser → Web Bluetooth → NIIMBOT.
- `Lokal`: Vorlagen/Verlauf in IndexedDB.
- `Server`: Vorlagen/Verlauf per HTTPS-API an Docker v1; Druck bleibt trotzdem lokal.
- Keine automatische Synchronisation zwischen Lokal und Server.
- Vollständige lokale App-Shell via Service Worker.
- Zwei gepinnte Laufzeitbibliotheken werden in v1 von unpkg geladen und nach erfolgreichem Online-Start opportunistisch gecacht. Details: `THIRD_PARTY_NOTICES.md`.

## iPhone / iPad

Safari und Chrome auf iOS/iPadOS stellen Web Bluetooth nicht bereit. Zum direkten BLE-Druck:

1. Bluefy aus dem App Store installieren.
2. Bluetooth für Bluefy erlauben.
3. GitHub-Pages-URL **in Bluefy** öffnen.
4. NIIMBOT B1 einschalten.
5. `B1 verbinden` antippen.
6. Im Geräteauswahldialog den B1 wählen.
7. QR-Inhalt eingeben und `Drucken` antippen.

Der verwendete Open-Source-Treiber dokumentiert einen erfolgreichen iPhone/Bluefy-Test mit B1 Pro. Der normale B1 ist als Drucker offiziell unterstützt, die spezielle Kombination B1 + Bluefy sollte mit deiner Hardware einmal praktisch verifiziert werden.

Eine über Safari zum Home-Bildschirm installierte PWA erhält dadurch nicht automatisch Web Bluetooth. Für den Druck auf iOS die Seite in Bluefy öffnen.

## Android

Chrome/Edge/Samsung Internet:
- Bluetooth einschalten.
- Standortdienste einschalten (Android kann BLE-Scanning daran koppeln).
- Seite über HTTPS öffnen.
- `B1 verbinden` → Drucker wählen → drucken.

## GitHub Pages

1. Inhalt dieses ZIPs ins Root eines Pages-Repositories legen.
2. Repository → Settings → Pages → Source: GitHub Actions.
3. Push auf `main`; `deploy-pages.yml` veröffentlicht automatisch.
4. Für Updates kann ein neues `*.zip` ins Repository-Root hochgeladen werden; `import-zip.yml` importiert genau ein geändertes ZIP.

## Server-Modus

Optional im Setup:
- Backend URL, z. B. `https://api.example.com`
- Cloudflare Access Client ID
- Cloudflare Access Client Secret

Die Werte liegen nur in IndexedDB des Geräts und werden nicht exportiert. Ein Service Token in einer Browser-PWA ist kein Keychain-Geheimnis; pro Gerät eng begrenzen und widerrufbar halten.

## Backup

Lokaler und Server-Modus verwenden:
```json
{
  "format": "qr-label-backup",
  "version": 1,
  "data": {}
}
```

## Update-Lifecycle

Service Worker Cache: `qr-label-pwa-v1`.
Neue Versionen werden installiert und warten. Ein Update wird nicht mitten in einer laufenden Aktion erzwungen. Der Button `Jetzt aktualisieren` aktiviert einen wartenden Worker; es gibt maximal einen kontrollierten Reload.

## Bekannte Grenzen v1

- B1/B1 Pro, 50×30-mm-Label.
- iOS: Web-BLE-Browser erforderlich; Safari/Chrome allein reichen nicht.
- B1 + Bluefy wurde in diesem Build nicht mit realer Hardware getestet.
- Die beiden Drittanbieter-JS-Dateien liegen v1 noch nicht im Repository selbst, sondern sind gepinnt und werden gecacht.

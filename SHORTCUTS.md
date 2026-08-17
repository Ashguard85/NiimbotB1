# Apple Kurzbefehle / Shortcut-API – v3

## Empfohlene URL

Die PWA übernimmt Parameter bevorzugt aus dem URL-Fragment. Beispiel:

```text
https://USER.github.io/REPO/#qr=https%3A%2F%2Fexample.com%2Fkunde%2F123&text=Kunde%20123&copies=1&density=3&autoprint=1
```

Parameter:

- `qr` – QR-Inhalt
- `text` oder `caption` – Beschriftung
- `copies` – 1 bis 20
- `density` – 1 bis 5
- `offset` – -40 bis +40 Pixel
- `ecc` – L, M, Q oder H
- `size` – derzeit `50x30`
- `autoprint=1` – nach erfolgreicher Bluetooth-Auswahl direkt drucken

`?qr=...` wird ebenfalls unterstützt. Für QR-Inhalte wird `#qr=...` bevorzugt, da der Fragmentinhalt nicht Teil des HTTP-Requests an den Webhost ist.

## Kurzbefehl auf iPhone/iPad

Ein einfacher Kurzbefehl kann:

1. die Eingabe/Adresse übernehmen,
2. den Text URL-codieren,
3. die PWA-URL mit `#qr=<codierter Inhalt>&autoprint=1` zusammensetzen,
4. diese URL öffnen.

Für den B1-Druck muss die Seite auf iOS in einem Web-Bluetooth-fähigen Browser wie Bluefy laufen. Das community-dokumentierte Bluefy-Schema lautet:

```text
bluefy://open?url=<VOLLSTÄNDIG-URL-CODIERTE-PWA-URL>
```

Dieses Bluefy-Schema ist nicht in der öffentlichen App-Store-Beschreibung dokumentiert und sollte deshalb einmal auf deinem Gerät getestet werden. Falls es nicht funktioniert, die erzeugte PWA-URL manuell in Bluefy öffnen.

## Autoprint

Browser dürfen die erstmalige Bluetooth-Geräteauswahl nicht ohne Benutzeraktion öffnen. Darum bedeutet `autoprint=1`:

- Vorschau sofort erzeugen,
- falls noch nicht verbunden: `B1 verbinden` antippen und B1 auswählen,
- unmittelbar danach Druck automatisch starten.

Wenn eine bereits laufende Seite eine neue Fragment-URL erhält und der B1 noch verbunden ist, startet `autoprint=1` ohne zusätzlichen Druck-Button.

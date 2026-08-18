# Apple Kurzbefehle / Jira / Bluefy – v15

## Empfohlen: `handoff.html` für bestehenden Drucktab

Bluefy kann über `bluefy://open?url=...` eine URL öffnen. Ein dokumentierter Schalter für „bestehenden Tab ersetzen“ ist nicht bekannt. v15 verwendet deshalb einen kleinen Übergabe-Endpunkt.

1. NIIMBOT-App einmal normal in Bluefy öffnen und B1 verbinden.
2. Jira/Shortcut öffnet **nicht** erneut die komplette App, sondern:

```text
https://USER.github.io/REPO/handoff.html#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D43322
```

3. Diese URL vollständig URL-codieren und an Bluefy geben:

```text
bluefy://open?url=ENCODED_HANDOFF_URL
```

Der Service Worker sucht den bereits offenen App-Tab, bevorzugt einen als verbunden registrierten Tab, übergibt QR/Caption dort ohne Reload und versucht anschließend, genau diesen Tab wieder zu fokussieren. Falls Bluefy/WebKit das Fokussieren verweigert, bleibt nur der kleine Hilfstab vorne; das Label ist trotzdem im alten Tab angekommen und dessen BLE-Dokument wurde nicht neu geladen.

Die ältere Form `#handoff=1&url=...` bleibt als Kompatibilitätsweg erhalten.

---


## Wichtig: bestehenden Bluefy-Drucktab wiederverwenden

Bluefy unterstützt nach einer von PNN Soft genannten Entwicklerauskunft das Schema:

```text
bluefy://open?url=...
```

Ein dokumentierter Parameter wie `sameTab=1` oder `newTab=0` ist dafür nicht bekannt. Seit v12 löst die App das deshalb auf App-Ebene: Mit `handoff=1` übergibt ein von Bluefy neu geöffneter Hilfstab den Jira-/QR-Inhalt an einen **bereits offenen NIIMBOT-Tab derselben GitHub-Pages-Origin**. Dieser bestehende Tab wird nicht neu geladen; dadurch kann eine aktive B1-Web-Bluetooth-Verbindung erhalten bleiben.

Ablauf:

```text
Jira / Kurzbefehl
  → bluefy://open?url=<PWA-URL mit handoff=1>
  → Bluefy öffnet ggf. einen Hilfstab
  → Hilfstab sendet Parameter an bestehenden NIIMBOT-Tab
  → bestehender Tab aktualisiert QR + Caption ohne Reload
  → B1-Verbindung bleibt bestehen
  → Hilfstab versucht sich zu schließen
```

Wenn iOS/Bluefy das automatische Schließen verhindert, den Hilfstab einfach schließen und zum bereits offenen NIIMBOT-Tab wechseln. Ein erneutes Verbinden ist dann nicht nötig, solange Bluefy die BLE-Verbindung beim App-/Tabwechsel nicht selbst getrennt hat.

## Jira-Beispiel

Ziel-Asset:

```text
https://meineURL.com/secure/ShowObject.jspa?id=43322
```

PWA-Handoff-URL:

```text
https://USER.github.io/REPO/#handoff=1&url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D43322
```

Diese komplette PWA-URL anschließend noch einmal URL-codieren und an Bluefy übergeben:

```text
bluefy://open?url=ENCODED_PWA_URL
```

In Apple Kurzbefehle ist das robusteste Vorgehen:

1. Jira-URL als Eingabe übernehmen.
2. Jira-URL URL-codieren.
3. `https://USER.github.io/REPO/#handoff=1&url=` + codierte Jira-URL zusammensetzen.
4. Die komplette PWA-URL erneut URL-codieren.
5. `bluefy://open?url=` + codierte PWA-URL zusammensetzen.
6. „URLs öffnen“ ausführen.

## Direkter QR-Inhalt

```text
https://USER.github.io/REPO/#qr=https%3A%2F%2Fexample.com%2Fkunde%2F123&caption=IAM-43322&label=40x40&autoprint=1
```

Unterstützt:
- `url` – Jira-/Asset-URL; automatische Asset-Caption kann daraus z. B. `IAM-43322` bilden
- `qr` – QR-Inhalt
- `caption` oder `text` – Beschriftung
- `quickchart` / `source` – vollständiger QuickChart-QR-Link
- `label` oder `size` – `50x30` oder `40x40`
- `copies` – 1 bis 20
- `density` – 1 bis 5
- `offset` – -60 bis +60 Pixel
- `ecc` – L, M, Q oder H
- `captionpct` – Caption-Größe in Prozent der Labelbreite; `0` = Auto
- `autoprint=1` – bei bestehender Verbindung direkt drucken; sonst nach der notwendigen Bluetooth-Auswahl
- `handoff=1` – an einen bereits offenen NIIMBOT-Tab weiterreichen, statt dort die Seite neu zu laden

## QuickChart-Link

```text
https://USER.github.io/REPO/#quickchart=QUICKCHART_URL_ENCODED&label=40x40&handoff=1
```

Beispielquelle:

```text
https://quickchart.io/qr?text=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D43322&size=500&caption=IAM-43322&captionFontSize=40
```

## Datenschutz

Für QR-/Jira-Inhalte wird das URL-Fragment (`#...`) bevorzugt. Fragmente werden beim normalen HTTP-Abruf nicht an GitHub Pages übertragen. Beim Bluefy-Deep-Link liegt der Inhalt allerdings in der lokal an iOS/Bluefy übergebenen Deep-Link-URL.
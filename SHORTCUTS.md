# Apple Kurzbefehle / Jira / Safari + beacio / Bluefy – v21


## Bevorzugter iPhone-Weg: Safari + beacio

Mit beacio muss die Druckseite nicht mehr über `bluefy://` geöffnet werden. Für einen Asset-Link kann direkt die normale HTTPS-Adresse verwendet werden:

```text
https://Ashguard85.github.io/NiimbotB1/#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D12345
```

Die App übernimmt beim Öffnen `url=...`, erzeugt den QR-Code und leitet bei passender Asset-URL die Caption ab. Der Druck läuft anschließend über `navigator.bluetooth`, das beacio in Safari bereitstellt.

**Apple-Kurzbefehl (Safari/beacio):** Asset-URL übernehmen → URL-codieren → an `https://Ashguard85.github.io/NiimbotB1/#url=` anhängen → URL öffnen.

Der folgende Bluefy-Handoff bleibt nur als Fallback erhalten.

## Bluefy-Fallback: Handoff-Link

Den NIIMBOT-Drucktab einmal normal in Bluefy öffnen und den B1 verbinden. Danach externe Jira-/Asset-Links über die kleine `handoff.html` öffnen:

```text
https://USER.github.io/REPO/handoff.html#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D43322
```

Die komplette Handoff-URL anschließend URL-codieren und über Bluefy öffnen:

```text
bluefy://open?url=ENCODED_HANDOFF_URL
```

v21 benötigt für die Übergabe **keinen Service Worker**. `handoff.html` versucht in dieser Reihenfolge:

1. vorhandenen benannten Drucktab `niimbot-print` direkt finden → `postMessage` → `focus()`;
2. Same-Origin `BroadcastChannel`;
3. `localStorage`/`storage`-Event als Fallback.

Der Drucktab veröffentlicht lokal einen Heartbeat. Falls mehrere NIIMBOT-Tabs offen sind, wird ein frischer, verbundener B1-Tab bevorzugt. Der Drucktab wird nicht neu geladen.

## Apple-Kurzbefehl

1. Jira-/Asset-URL als Eingabe übernehmen.
2. URL-codieren.
3. `https://USER.github.io/REPO/handoff.html#url=` + codierte Asset-URL bilden.
4. Diese komplette Handoff-URL erneut URL-codieren.
5. `bluefy://open?url=` + codierte Handoff-URL bilden.
6. „URLs öffnen“ ausführen.

## Beispiel

Asset:

```text
https://meineURL.com/secure/ShowObject.jspa?id=43322
```

Handoff:

```text
https://USER.github.io/REPO/handoff.html#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D43322
```

Die App kann daraus weiterhin automatisch eine Caption wie `IAM-43322` ableiten.

## Kompatibilitätsweg

Die ältere Form bleibt erhalten:

```text
https://USER.github.io/REPO/#handoff=1&url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D43322
```

`handoff.html` ist vorzuziehen, weil dabei nicht die komplette Druck-App in einem Hilfstab initialisiert wird.

## Weitere Parameter

- `url` – Jira-/Asset-URL
- `qr` – QR-Inhalt
- `caption` oder `text` – Beschriftung
- `quickchart` / `source` – vollständiger QuickChart-QR-Link
- `label` oder `size` – `50x30` oder `40x40`
- `copies` – 1 bis 20
- `density` – 1 bis 5
- `offset` – -60 bis +60 Pixel
- `ecc` – L, M, Q oder H
- `captionpct` – Caption-Größe in Prozent; `0` = Auto
- `autoprint=1` – bei bestehender Verbindung direkt drucken
- `handoff=1` – Parameter an einen bestehenden Drucktab übergeben

## Tab-Schließen

Bluefy dokumentiert keinen Parameter wie `sameTab=1`, `newTab=0` oder `closeAfterOpen=1`. v21 versucht nach erfolgreicher Übergabe `window.close()`, den `_self`-Close-Weg sowie exakt benannte native Close-/Dismiss-Bridges, falls Bluefy sie tatsächlich exponiert. Bei einer Benutzeraktion wird zusätzlich `history.back()` als letzter Standard-Web-Fallback versucht.

Wenn Bluefy den Hilfstab trotzdem nicht entfernt, ist dies eine Host-App-/WKWebView-Grenze. Der Handoff selbst und die B1-Verbindung im alten Drucktab bleiben davon unabhängig.

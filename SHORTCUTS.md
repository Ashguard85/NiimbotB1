# Apple Kurzbefehle / Jira / Safari + beacio / Bluefy – v22


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

v22 benötigt für die Übergabe **keinen Service Worker**. `handoff.html` versucht in dieser Reihenfolge:

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

Bluefy dokumentiert keinen Parameter wie `sameTab=1`, `newTab=0` oder `closeAfterOpen=1`. v22 versucht nach erfolgreicher Übergabe `window.close()`, den `_self`-Close-Weg sowie exakt benannte native Close-/Dismiss-Bridges, falls Bluefy sie tatsächlich exponiert. Bei einer Benutzeraktion wird zusätzlich `history.back()` als letzter Standard-Web-Fallback versucht.

Wenn Bluefy den Hilfstab trotzdem nicht entfernt, ist dies eine Host-App-/WKWebView-Grenze. Der Handoff selbst und die B1-Verbindung im alten Drucktab bleiben davon unabhängig.


## Safari + beacio ab v22

Wenn bereits ein verbundener Drucktab offen ist, genügt auch direkt:

```text
https://USER.github.io/REPO/#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D12345
```

v22 erkennt den verbundenen Primary-Tab und übergibt die URL automatisch dorthin.


## Auto-Druck in v31

Wenn **Nach URL-Aufruf automatisch drucken** in der App aktiviert ist, reicht z. B.:

```text
https://Ashguard85.github.io/NiimbotB1/#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D12345
```

Die App übernimmt die Nutzlast, versucht den bekannten Drucker automatisch wiederzuverbinden und druckt nach erfolgreicher Verbindung. Alternativ erzwingt `&autoprint=1` den Auto-Druck nur für den jeweiligen Aufruf, unabhängig von der gespeicherten Option.


## v31: Rückkehr nach dem Druck

Zusätzlicher Parameter:

- `return=<URL>` – Ziel, das nach erfolgreichem Druck geöffnet werden soll.
- In der App zusätzlich **„Nach dem Druck zur Ursprungs-App zurück“** aktivieren.
- `autoprint=1` kann mit `return=` kombiniert werden.

Beispiel der inneren GitHub-Pages-URL:

`https://Ashguard85.github.io/NiimbotB1/#url=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D12345&autoprint=1&return=https%3A%2F%2FmeineURL.com%2Fsecure%2FShowObject.jspa%3Fid%3D12345`

Für Bluefy muss diese komplette innere URL anschließend als Wert von `bluefy://open?url=` nochmals URL-codiert werden.


## v31 – Rückkehrvarianten

Direkt: `&return=https%3A%2F%2Fwww.google.com%2F`

Kurzbefehl: `&return=shortcut&shortcut=Zur%C3%BCck`

Direktes Shortcuts-Scheme bleibt ebenfalls unterstützt. Für Bluefy wird die komplette innere URL nochmals als Wert von `bluefy://open?url=` URL-codiert.


## v31 – M2-H
Shortcut- und Bluefy-URLs ändern sich nicht. Nach dem Verbinden erkennt die App B1/B1 Pro/M2-H automatisch und wählt die passende DPI/Geometrie.

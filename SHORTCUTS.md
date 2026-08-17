# Apple Kurzbefehle / URL-API – v5

## Direkter QR-Inhalt

Bevorzugt als URL-Fragment:

```text
https://USER.github.io/REPO/#qr=https%3A%2F%2Fexample.com%2Fkunde%2F123&caption=IAM-43322&label=40x40&autoprint=1
```

Unterstützt:
- `qr` – QR-Inhalt
- `caption` oder aus Kompatibilitätsgründen `text` – Beschriftung
- `label` oder `size` – `50x30` oder `40x40`
- `copies` – 1 bis 20
- `density` – 1 bis 5
- `offset` – -60 bis +60 Pixel
- `ecc` – L, M, Q oder H
- `captionpct` – Caption-Schriftgröße in Prozent der Labelbreite; `0` = Auto
- `autoprint=1` – nach erfolgreicher Bluetooth-Auswahl direkt drucken

## QuickChart-Link übergeben

Der vollständige QuickChart-Link wird URL-codiert in `quickchart=` oder `source=` übergeben:

```text
https://USER.github.io/REPO/#quickchart=QUICKCHART_URL_ENCODED&label=40x40&autoprint=1
```

Beispiel-QuickChart-Quelle:

```text
https://quickchart.io/qr?text=https%3A%2F%2Fsupport.braendi.ch%2Fsecure%2FShowObject.jspa%3Fid%3D43322&size=500&caption=IAM-43322&captionFontSize=40
```

Die Web-App liest den Link lokal aus. `text` wird zum QR-Inhalt, `caption` zur Beschriftung, `ecLevel` zur Fehlerkorrektur. Wenn sowohl `size` als auch `captionFontSize` vorhanden sind, wird deren Verhältnis als Caption-Größe übernommen. Das physische Label wird ausschließlich durch `label=50x30` bzw. `label=40x40` festgelegt.

Sonderzeichen in der inneren `text=`-URL sollten wie von QuickChart empfohlen URL-codiert sein. Insbesondere bei inneren URLs mit eigenen `&`-Parametern ist Encoding nötig, damit QuickChart-Optionen und Ziel-URL eindeutig bleiben.

## iPhone / iPad

Für den direkten B1-Druck muss die Seite in einem Web-Bluetooth-fähigen Browser wie Bluefy laufen. Safari/Chrome auf iOS stellen Web Bluetooth nicht bereit. Ein offizielles, von Bluefy dokumentiertes Deep-Link-Schema wird in diesem Projekt nicht vorausgesetzt; die Druckseite kann dauerhaft als Tab/Favorit in Bluefy genutzt werden.

## Autoprint

Browser dürfen die erstmalige Bluetooth-Geräteauswahl nicht ohne Benutzeraktion öffnen. `autoprint=1` bedeutet daher:
1. Vorschau sofort erzeugen,
2. `B1 verbinden` antippen und Drucker auswählen, falls noch nicht verbunden,
3. direkt danach automatisch drucken.

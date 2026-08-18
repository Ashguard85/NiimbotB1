# QR Label – Pages v18

Statische GitHub-Pages-Web-App zum Erzeugen und direkten Drucken von QR-Labels auf NIIMBOT B1/B1 Pro via Web Bluetooth. Für den Druck ist kein Backend notwendig.

## Kernfunktionen
- QR-Inhalt oder kompletter QuickChart-QR-Link in **ein einziges Feld** einfügen.
- QuickChart-Parameter `text`, `caption`, `ecLevel`, `size` und `captionFontSize` automatisch übernehmen.
- Labelformate `50×30 mm` und `40×40 mm`.
- B1/B1-Pro-Autoerkennung.
- Direktdruck über Web Bluetooth, Dichte/Kopien/Offset, PNG/Share-Fallback.
- Vorlagen und Verlauf lokal in IndexedDB oder optional über den Docker-v18-Server-Provider.
- Offline-App-Shell und kontrollierte Service-Worker-Updates.

## QuickChart-Beispiel

Einfach diesen Typ URL in das Feld einfügen:

```text
https://quickchart.io/qr?text=https://meineURL.com/secure/ShowObject.jspa?id=43322&size=500&caption=IAM-43322&captionFontSize=40
```

Die App ersetzt die Eingabe automatisch durch das eigentliche QR-Ziel und übernimmt `IAM-43322` als Caption. `captionFontSize=40` wird relativ zu `size=500` als 8 % der Labelbreite interpretiert. Es wird **kein QuickChart-Bild heruntergeladen**; QR und Caption werden lokal gerendert.

Für verschachtelte Ziel-URLs mit eigenen `&`-Parametern sollte `text=` URL-codiert sein.

## Labelformate
- `50×30`: B1 `384×240 px`, B1 Pro `584×354 px`; vom verwendeten Treiber hardwarevalidiert.
- `40×40`: B1 `320×320 px`, B1 Pro `472×472 px`; aus der jeweiligen dpi-Geometrie abgeleitet und deshalb mit Testdruck/Offset zu kalibrieren.

## iPhone / iPad
Safari und Chrome auf iOS/iPadOS stellen Web Bluetooth nicht bereit. Für direkten BLE-Druck:
1. Bluefy installieren und Bluetooth erlauben.
2. Diese HTTPS-Seite in Bluefy öffnen und dort als Tab/Favorit behalten.
3. B1 einschalten → `B1 verbinden` → B1 auswählen.
4. QR/QuickChart-Link einfügen → Vorschau → `Drucken`.

Eine PWA-Installation ist für diesen Bluefy-Druckweg nicht erforderlich.

## Android
In Chrome/Edge die HTTPS-Seite öffnen, Bluetooth erlauben, B1 verbinden und drucken. Optional kann die Seite als PWA installiert werden.

## GitHub Pages
1. Inhalt dieses ZIPs ins Repository-Root legen.
2. Einmalig `Settings → Pages → Build and deployment → Source: GitHub Actions`.
3. Push auf `main` deployt die Seite.
4. Danach verarbeitet der geschützte ZIP-Importer genau ein neu hochgeladenes `*.zip`; `.github/workflows/` wird dabei nie überschrieben.

## Datenmodi
- **Lokal:** IndexedDB, kein Backend erforderlich.
- **Server:** HTTPS-API zu Docker v18; Druck bleibt trotzdem lokal Endgerät → Bluetooth → B1.
- Kein Fake-Sync. Ein Moduswechsel wechselt nur den aktiven Datenspeicher.

## Backup
```json
{
  "format": "qr-label-backup",
  "version": 2,
  "data": {}
}
```
Restore akzeptiert v1 und v2. Cloudflare-Zugangsdaten werden nie exportiert.

## Shortcut-API
Siehe `SHORTCUTS.md`. Neu: `quickchart=`/`source=`, `label=40x40` und `captionpct=`.

## Update-Lifecycle
Service-Worker-Cache: `qr-label-pwa-v18`. Neue Versionen werden vorbereitet und nicht mitten in laufenden Aktionen erzwungen. Kein unkontrollierter `controllerchange`-Reload-Loop.

## Bekannte Grenzen
- Direkter iOS-Druck braucht Bluefy oder einen anderen Web-BLE-Browser.
- B1 + Bluefy sowie `40×40` konnten in dieser Build-Umgebung nicht mit echter Hardware getestet werden.
- Die gepinnten QR-/NIIMBOT-JS-Bibliotheken werden weiterhin von UNPKG geladen und nach erfolgreichem Online-Start gecacht; sie sind noch nicht physisch vendort.


## Standardformat und PDF
Ab v7 startet die App mit **40×40 mm**. Der Button **PDF** erzeugt eine einseitige PDF mit exakt der aktuell gewählten Labelgröße; bei der Standardeinstellung also 40×40 mm. Beim Wechsel auf 50×30 wird entsprechend eine 50×30-mm-PDF erzeugt.

## Render-Modi v7

**QuickChart API** erzeugt das QR-Bild über `https://quickchart.io/qr`. Bei importierten QuickChart-Links übernimmt die App insbesondere `text`, `caption`, `captionFontSize`, `size`, `ecLevel`, `margin` sowie unterstützte Farb-/Stilparameter. Das fertige PNG wird anschließend auf das gewählte physische Label skaliert und genau dieser Canvas wird gedruckt bzw. als PNG/PDF exportiert.

**Offline lokal** benötigt keinen QuickChart-Zugriff. QR und Caption werden vollständig im Browser erzeugt. Die Caption sitzt in v7 näher am QR-Code. Im Modus **Auto** wird ein erkannter QuickChart-Link online über QuickChart gerendert; offline fällt die App lokal zurück. Auch im expliziten QuickChart-Modus erfolgt bei Timeout, Netzwerk- oder CORS-Fehler ein lokaler Fallback statt eines leeren Labels.


## iOS/Bluefy Drucktransport (v12)

Der Upstream-Treiber `niimbot-web-bluetooth` lädt Bild-URLs intern über `fetch(url) -> blob() -> createImageBitmap()`. Bluefy kann genau an dieser Lade-/Decodierstufe mit `Load failed` abbrechen. v12 übergibt deshalb keine Bild-URL mehr: Die App hält das fertige Label bereits als Canvas vor und verwendet beim Druck einen eng begrenzten Kompatibilitätsadapter, der genau den internen Bildabruf des Treibers auf dieses Canvas zurückführt. Dadurch gibt es für den eigentlichen Druck weder einen `data:`-/`blob:`-Fetch noch eine Bilddecodierung. Nach dem Druck werden die temporären Global-Overrides sofort wiederhergestellt.

Beim B1 werden auf iOS zusätzlich `WRITE_MODE=paced` und `BUNDLE_MAX=180` gesetzt. Der tatsächliche BLE-Druck muss weiterhin mit realer B1-Hardware geprüft werden.


## Bluefy-Handoff (v18)

Für Jira-/Kurzbefehle wird `handoff.html#url=...` empfohlen. Die Übergabe an einen bereits offenen Bluefy-Drucktab läuft ohne Service Worker über Named Window/`postMessage`, `BroadcastChannel` und `localStorage`-Fallback. Ein verbundener, frischer Drucktab wird bevorzugt. Der Drucktab wird nicht neu geladen, damit eine aktive B1-Verbindung erhalten bleiben kann. Details siehe `SHORTCUTS.md`.

## v18 Handoff-Empfängerwahl
- Drucktabs senden jetzt alle 1,5 Sekunden einen lokalen Heartbeat.
- `connected`, `visible` und `focused` werden getrennt erfasst; ein verbundener Tab hat immer Vorrang vor einem bloß sichtbaren Hilfstab.
- Veraltete Registry-Einträge werden nach 90 Sekunden entfernt.
- Der Connected-Status gilt nur für das aktuelle Browserdokument und wird nicht über Reloads hinweg erfunden.
- Weiterhin kein Server-/Handoff-Endpunkt erforderlich.

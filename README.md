# QR Label – Pages v22

Statische GitHub-Pages-Web-App zum Erzeugen und direkten Drucken von QR-Labels auf NIIMBOT B1/B1 Pro via Web Bluetooth. Für den Druck ist kein Backend notwendig.

## Kernfunktionen
- QR-Inhalt oder kompletter QuickChart-QR-Link in **ein einziges Feld** einfügen.
- QuickChart-Parameter `text`, `caption`, `ecLevel`, `size` und `captionFontSize` automatisch übernehmen.
- Labelformate `50×30 mm` und `40×40 mm`.
- B1/B1-Pro-Autoerkennung.
- Direktdruck über Web Bluetooth, Dichte/Kopien/Offset, PNG/Share-Fallback.
- Vorlagen und Verlauf lokal in IndexedDB oder optional über den Docker-v22-Server-Provider.
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

## iPhone / iPad – bevorzugt Safari + beacio
beacio stellt in echtem Safari die Standard-Web-Bluetooth-API `navigator.bluetooth` bereit. Die App benötigt dafür keinen proprietären beacio-Code und keinen zusätzlichen Server.

1. beacio installieren und einmal öffnen.
2. In Safari die beacio-Erweiterung aktivieren.
3. Für beacio **„Immer erlauben“ → „Auf jeder Website immer erlauben“** wählen.
4. Diese GitHub-Pages-URL direkt in Safari öffnen.
5. `B1 verbinden` tippen und den Drucker auswählen.
6. Danach QR/Asset-Link übernehmen und drucken.

Die App erkennt die spät injizierte beacio-Bridge auch unter der restriktiven CSP und aktualisiert den Bluetooth-Status automatisch. Bluefy bleibt als Fallback erhalten; für den bevorzugten Safari-Weg sind `bluefy://` und ein separater BLE-Browser nicht mehr nötig.

## Android
In Chrome/Edge die HTTPS-Seite öffnen, Bluetooth erlauben, B1 verbinden und drucken. Optional kann die Seite als PWA installiert werden.

## GitHub Pages
1. Inhalt dieses ZIPs ins Repository-Root legen.
2. Einmalig `Settings → Pages → Build and deployment → Source: GitHub Actions`.
3. Push auf `main` deployt die Seite.
4. Danach verarbeitet der geschützte ZIP-Importer genau ein neu hochgeladenes `*.zip`; `.github/workflows/` wird dabei nie überschrieben.

## Datenmodi
- **Lokal:** IndexedDB, kein Backend erforderlich.
- **Server:** HTTPS-API zu Docker v22; Druck bleibt trotzdem lokal Endgerät → Bluetooth → B1.
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
Service-Worker-Cache: `qr-label-pwa-v22`. Neue Versionen werden vorbereitet und nicht mitten in laufenden Aktionen erzwungen. Kein unkontrollierter `controllerchange`-Reload-Loop.

## Bekannte Grenzen
- Direkter iOS-Druck: bevorzugt Safari + beacio; Bluefy bleibt Fallback.
- B1 + Safari/beacio bzw. Bluefy sowie `40×40` konnten in dieser Build-Umgebung nicht mit echter Hardware getestet werden.
- Die gepinnten QR-/NIIMBOT-JS-Bibliotheken werden weiterhin von UNPKG geladen und nach erfolgreichem Online-Start gecacht; sie sind noch nicht physisch vendort.


## Standardformat und PDF
Ab v7 startet die App mit **40×40 mm**. Der Button **PDF** erzeugt eine einseitige PDF mit exakt der aktuell gewählten Labelgröße; bei der Standardeinstellung also 40×40 mm. Beim Wechsel auf 50×30 wird entsprechend eine 50×30-mm-PDF erzeugt.

## Render-Modi v7

**QuickChart API** erzeugt das QR-Bild über `https://quickchart.io/qr`. Bei importierten QuickChart-Links übernimmt die App insbesondere `text`, `caption`, `captionFontSize`, `size`, `ecLevel`, `margin` sowie unterstützte Farb-/Stilparameter. Das fertige PNG wird anschließend auf das gewählte physische Label skaliert und genau dieser Canvas wird gedruckt bzw. als PNG/PDF exportiert.

**Offline lokal** benötigt keinen QuickChart-Zugriff. QR und Caption werden vollständig im Browser erzeugt. Die Caption sitzt in v7 näher am QR-Code. Im Modus **Auto** wird ein erkannter QuickChart-Link online über QuickChart gerendert; offline fällt die App lokal zurück. Auch im expliziten QuickChart-Modus erfolgt bei Timeout, Netzwerk- oder CORS-Fehler ein lokaler Fallback statt eines leeren Labels.


## iOS/Bluefy Drucktransport (v12)

Der Upstream-Treiber `niimbot-web-bluetooth` lädt Bild-URLs intern über `fetch(url) -> blob() -> createImageBitmap()`. Bluefy kann genau an dieser Lade-/Decodierstufe mit `Load failed` abbrechen. v12 übergibt deshalb keine Bild-URL mehr: Die App hält das fertige Label bereits als Canvas vor und verwendet beim Druck einen eng begrenzten Kompatibilitätsadapter, der genau den internen Bildabruf des Treibers auf dieses Canvas zurückführt. Dadurch gibt es für den eigentlichen Druck weder einen `data:`-/`blob:`-Fetch noch eine Bilddecodierung. Nach dem Druck werden die temporären Global-Overrides sofort wiederhergestellt.

Beim B1 werden auf iOS zusätzlich `WRITE_MODE=paced` und `BUNDLE_MAX=180` gesetzt. Der tatsächliche BLE-Druck muss weiterhin mit realer B1-Hardware geprüft werden.


## Bluefy-Handoff (v22)

Für Jira-/Kurzbefehle wird `handoff.html#url=...` empfohlen. Die Übergabe an einen bereits offenen Bluefy-Drucktab läuft ohne Service Worker über Named Window/`postMessage`, `BroadcastChannel` und `localStorage`-Fallback. Ein verbundener, frischer Drucktab wird bevorzugt. Der Drucktab wird nicht neu geladen, damit eine aktive B1-Verbindung erhalten bleiben kann. Details siehe `SHORTCUTS.md`.

## v22 Handoff-Empfängerwahl
- Drucktabs senden jetzt alle 1,5 Sekunden einen lokalen Heartbeat.
- `connected`, `visible` und `focused` werden getrennt erfasst; ein verbundener Tab hat immer Vorrang vor einem bloß sichtbaren Hilfstab.
- Veraltete Registry-Einträge werden nach 90 Sekunden entfernt.
- Der Connected-Status gilt nur für das aktuelle Browserdokument und wird nicht über Reloads hinweg erfunden.
- Weiterhin kein Server-/Handoff-Endpunkt erforderlich.


## Safari + beacio (v22)
beacio ist ab v22 der bevorzugte iPhone-Weg. Laut Hersteller injiziert die Safari-Erweiterung `navigator.bluetooth` und `window.BluetoothUUID` direkt in HTTPS-Seiten. Unsere NIIMBOT-Integration bleibt deshalb auf der Standard-Web-Bluetooth-API und benötigt keinen beacio-spezifischen Printer-Provider.

Die App bindet absichtlich **kein externes beacio-SDK** ein: die installierte Erweiterung kann bestehende Web-Bluetooth-Seiten ohne Codeänderung unterstützen. Wegen unserer strikten CSP kann die Injektion leicht verzögert ankommen; v22 hört deshalb auf `beacio:extension:ready`/`beacio:ready` und prüft `navigator.bluetooth` in den ersten Sekunden erneut.

Bluefy-Handoff bleibt als Kompatibilitäts-/Fallbackweg enthalten.

## Safari + beacio: Geräteauswahl ab v22

Wenn beacio auf iPhone/Safari erkannt wird, öffnet die App beim Verbinden einen neutralen Web-Bluetooth-Chooser (`acceptAllDevices: true`). Das verhindert, dass ein zu enger NIIMBOT-Filter die beacio-Auswahl blockiert. Nach der Auswahl prüft der NIIMBOT-Treiber das Gerät weiterhin vollständig; ein beliebiges BLE-Gerät wird dadurch nicht automatisch als Drucker akzeptiert.

Die Statusanzeige zeigt, ob der Ablauf bereits beim Chooser, nach der Gerätewahl, bei der NIIMBOT-Erkennung oder beim GATT-/Protokollaufbau scheitert. Bluefy und Browser mit nativem Web Bluetooth behalten ihren bisherigen Verbindungsweg.

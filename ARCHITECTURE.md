# Architektur v42

```text
Gemeinsames Frontend
  ├─ Jira-/URL-/QuickChart-Eingabe
  ├─ Kamera-/Bild-QR-Scanner
  ├─ QuickChart API oder Offline-Renderer
  ├─ Label Geometry Provider (40x40 Standard / 50x30)
  ├─ Printer Provider → Web Bluetooth → NIIMBOT B1/B1 Pro
  └─ Data Provider
       ├─ Local Provider → IndexedDB
       └─ Server Provider → HTTPS API → Flask/SQLite
```

Der Druckpfad ist unabhängig vom Data Provider und bleibt auf dem Endgerät.

## Bluefy Tab-Handoff

```text
Jira / Kurzbefehl
  → bluefy://open?url=<handoff.html#url=...>
  → kleiner Hilfstab
       ├─ Named Window / postMessage
       ├─ BroadcastChannel
       └─ localStorage storage-event
  → bestehender Drucktab
  → QR + Caption aktualisieren, kein Reload
  → bestehende BLE/GATT-Verbindung bleibt im Dokument
```

Der Service Worker ist **nicht** Bestandteil des Handoff-Protokolls. Er bleibt ausschließlich für App-Shell-Cache und Update-Lifecycle zuständig.

Drucktabs registrieren lokal einen kurzlebigen Heartbeat mit `connected`/`visible`. So kann der Hilfstab bei mehreren Tabs den sinnvollsten Empfänger adressieren. Es werden keine Handoff-Daten an einen Server gesendet.

## v22 Handoff-Empfängerwahl
- Drucktabs senden jetzt alle 1,5 Sekunden einen lokalen Heartbeat.
- `connected`, `visible` und `focused` werden getrennt erfasst; ein verbundener Tab hat immer Vorrang vor einem bloß sichtbaren Hilfstab.
- Veraltete Registry-Einträge werden nach 90 Sekunden entfernt.
- Der Connected-Status gilt nur für das aktuelle Browserdokument und wird nicht über Reloads hinweg erfunden.
- Weiterhin kein Server-/Handoff-Endpunkt erforderlich.


## iOS BLE ab v22

Bevorzugt: Safari → beacio Safari Extension → Standard `navigator.bluetooth` → NIIMBOT-Treiber.
Fallback: Bluefy → Standard/Bridge-Web-Bluetooth → derselbe NIIMBOT-Treiber.
Android/Desktop: natives Web Bluetooth.

Es gibt bewusst keinen separaten beacio-Printer-Provider; die App bleibt auf der W3C-Web-Bluetooth-Oberfläche.


## v42 Bluetooth-Lifecycle

Der Drucker bleibt nicht zwingend an einen einzigen Tab gebunden. Nach der erstmaligen Benutzerfreigabe speichert die App nur eine Präferenz (Geräte-ID/Name). Neue Tabs können bei unterstützter Web-Bluetooth-Implementierung über `navigator.bluetooth.getDevices()` das bereits autorisierte Gerät wiederfinden. Die eigentliche GATT-Verbindung wird weiterhin pro Tab aufgebaut. Nach erfolgreichem Druck kann die App die Verbindung automatisch trennen. Es gibt keine parallele Mehrtab-GATT-Nutzung und keine serverseitige Bluetooth-Bridge.


## v42 Return Handler
Nach erfolgreichem Druck kann optional ein validiertes `return=`-Ziel als Top-Level-Navigation geöffnet werden. Der Handler ist bewusst getrennt vom BLE-/Druckpfad und wird erst nach Druckbestätigung und optionalem Disconnect ausgeführt.


## v42 Return Provider
Direkte Ziele und `return=shortcut` laufen über denselben Return-Handler nach erfolgreichem Druck und optionalem Disconnect.


## v42 Printer Model Layer

`printer.js` hält modellbezogene Registry-Daten. `Niimbot.identify()` liefert die Modell-ID; danach wird nur Geometrie desselben Modells verwendet. Unterstützt: B1 (4096), B1 Pro (4097), M2-H (4608). Damit wird vermieden, dass nur aufgrund gleicher DPI eine falsche 300-dpi-Geometrie verwendet wird.


## v42 Local QR Geometry

Der lokale Renderer trennt nun explizit drei Größen: QR-Matrix `n`, konfigurierbarer Ruheraum `q` in Modulen und physisch verfügbare Fläche `maxQr`. Die Modulgröße wird mit `floor(maxQr / (n + 2q))` bestimmt. Damit ist der bisher fest eingebaute Wert `q=4` nicht mehr versteckt. QuickChart verwendet weiterhin seinen externen Renderer.


## v42 Two-Line Caption Layout

Der Render-Layer unterscheidet `caption` und `subcaption`. Im Offline-Renderer werden beide Zeilen bereits bei der verfügbaren QR-Höhe berücksichtigt. Die Subcaption nutzt eine kleinere Schrift. Im QuickChart-Renderer wird für die zweite Zeile unten Platz reserviert und sie nach dem QuickChart-Bitmap lokal gezeichnet. Dadurch bleibt `subcaption` unabhängig von QuickChart-API-Funktionen.


## v42 Label Designer

Der Designer ist eine clientseitige Schicht auf dem lokalen Renderer. Pro `labelSize` wird ein Objekt `labelDesigner:<size>` in den lokalen Einstellungen gespeichert. Jedes Element besitzt normalisierte X/Y-Koordinaten (0–100) und einen Skalierungsfaktor. Die dynamischen Inhalte (`qrText`, `caption`, `subcaption`) bleiben davon getrennt. Es gibt in v42 bewusst keine benannten Layouts und keine Synchronisation dieser Designerwerte.


## v42 Manual QR Rule
Im manuellen Designer ist `quiet=0` intern erzwungen. Der globale `quiet`-Wert wird nur im automatischen lokalen Renderer verwendet. So bildet die Designer-Auswahl exakt die QR-Matrix ab und der Benutzer kontrolliert den gesamten Außenabstand selbst.


## v42 Interaction Model
Hit-Targets selektieren Elemente direkt. Tap wählt; nur Pointermove verschiebt. Ein separater Resize-Handle skaliert um das Elementzentrum. Slider bleiben als nicht-drag-basierte Alternative. Auswahl-Bounds werden aus gerenderten Bounds rotationsbewusst dargestellt. Accordion-Zustände werden als kleine UI-Präferenzen gespeichert.

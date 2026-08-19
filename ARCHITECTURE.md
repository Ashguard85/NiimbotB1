# Architektur v30

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


## v30 Bluetooth-Lifecycle

Der Drucker bleibt nicht zwingend an einen einzigen Tab gebunden. Nach der erstmaligen Benutzerfreigabe speichert die App nur eine Präferenz (Geräte-ID/Name). Neue Tabs können bei unterstützter Web-Bluetooth-Implementierung über `navigator.bluetooth.getDevices()` das bereits autorisierte Gerät wiederfinden. Die eigentliche GATT-Verbindung wird weiterhin pro Tab aufgebaut. Nach erfolgreichem Druck kann die App die Verbindung automatisch trennen. Es gibt keine parallele Mehrtab-GATT-Nutzung und keine serverseitige Bluetooth-Bridge.


## v30 Return Handler
Nach erfolgreichem Druck kann optional ein validiertes `return=`-Ziel als Top-Level-Navigation geöffnet werden. Der Handler ist bewusst getrennt vom BLE-/Druckpfad und wird erst nach Druckbestätigung und optionalem Disconnect ausgeführt.


## v30 Return Provider
Direkte Ziele und `return=shortcut` laufen über denselben Return-Handler nach erfolgreichem Druck und optionalem Disconnect.

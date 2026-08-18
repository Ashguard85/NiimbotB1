# Architektur v16

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

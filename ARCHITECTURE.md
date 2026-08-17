# Architektur v4

```text
Gemeinsames Frontend
  ├─ Eingabe: Ziel-URL oder QuickChart-URL
  ├─ QuickChart Parser (lokal)
  ├─ QR Renderer + Caption
  ├─ Label Geometry Provider (50x30 / 40x40)
  ├─ Printer Provider → Web Bluetooth → B1/B1 Pro
  └─ Data Provider
       ├─ Local Provider → IndexedDB
       └─ Server Provider → HTTPS API → Flask/SQLite
```

Der Druckpfad ist unabhängig vom Data Provider und bleibt immer auf dem Endgerät. QuickChart wird nur als Eingabeformat verstanden; die App muss den Bilddienst zum Rendern nicht aufrufen.

`50x30` verwendet die im NIIMBOT-Treiber veröffentlichten Modellgeometrien. `40x40` ist eine bewusst als abgeleitet markierte benutzerdefinierte Geometrie und kann über `offset` bzw. die UI feinjustiert werden.

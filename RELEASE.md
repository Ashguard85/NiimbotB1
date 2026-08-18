# Release v19

- Safari + beacio ist der bevorzugte iPhone-Druckweg.
- Keine beacio-CDN-Abhängigkeit: die Safari-Erweiterung stellt `navigator.bluetooth` direkt bereit.
- App reagiert auf `beacio:extension:ready` und `beacio:ready` und prüft Web Bluetooth wegen strikter CSP verzögert erneut.
- UI zeigt die erkannte BLE-Umgebung: Safari + beacio, Bluefy/native Bridge oder natives Web Bluetooth.
- B1 nutzt auf iOS weiterhin konservative CoreBluetooth-Transportwerte.
- Bluefy-Handoff bleibt vollständig als Fallback erhalten.
- Version und Service-Worker-Cache: v19 / `qr-label-pwa-v19`.

# Release v17

- Bluefy-Handoff benötigt **keinen Service Worker mehr**. Hauptweg ist Same-Origin `BroadcastChannel`, Fallback ist das `storage`-Event über `localStorage`.
- Drucktabs veröffentlichen einen kurzen lokalen Heartbeat; ein verbundener B1-Tab wird bei mehreren offenen Tabs bevorzugt.
- Neuer benannter Drucktab `niimbot-print`: `handoff.html` versucht den bestehenden Tab direkt zu finden, per `postMessage` zu beliefern und zu fokussieren, ohne ihn neu zu laden.
- `handoff.html` hat jetzt eine eigene CSP-kompatible CSS-Datei; keine blockierten Inline-Styles mehr.
- Mehrere best-effort Close-Strategien für Bluefy/WKWebView sowie optionale Erkennung exakt benannter nativer Close-/Dismiss-Bridges.
- Wenn Bluefy das Schließen weiterhin blockiert, kann „Zum Drucktab wechseln“ den benannten Drucktab best-effort fokussieren; die BLE-Verbindung bleibt im bestehenden Dokument.
- Service Worker dient in v17 nur noch PWA-Cache/Update, nicht mehr der Tab-Übergabe.
- App-/Cache-Version auf v17 erhöht.

Hinweis: Eine Webseite kann einen von der Host-App extern erzeugten Bluefy-Tab nicht garantiert schließen. v17 versucht alle sinnvollen Web-Wege, ohne den funktionierenden Drucktab zu navigieren.

## v17 Handoff-Empfängerwahl
- Drucktabs senden jetzt alle 1,5 Sekunden einen lokalen Heartbeat.
- `connected`, `visible` und `focused` werden getrennt erfasst; ein verbundener Tab hat immer Vorrang vor einem bloß sichtbaren Hilfstab.
- Veraltete Registry-Einträge werden nach 90 Sekunden entfernt.
- Der Connected-Status gilt nur für das aktuelle Browserdokument und wird nicht über Reloads hinweg erfunden.
- Weiterhin kein Server-/Handoff-Endpunkt erforderlich.

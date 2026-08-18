# Release v18

- Versionsanzeige korrigiert: UI, Assets und Service-Worker-Cache sind konsistent auf v18.
- Asset-URLs verwenden `?v=18`, damit Bluefy keine alte `app.js` aus einem früheren Cache verwendet.
- Handoff-Empfängerpriorität aus v17 bleibt erhalten: verbunden > fokussiert > sichtbar > frischester Heartbeat.
- Rücksprung-UX korrigiert: Bluefy kann den Fokuswechsel trotz `window.focus()`/Named Window blockieren; die App behauptet daher keinen garantierten automatischen Rücksprung mehr.
- Der Benutzer-Button startet weiterhin den bestmöglichen Fokusversuch, ohne den verbundenen Drucktab neu zu laden.

- Bluefy-Handoff benötigt **keinen Service Worker mehr**. Hauptweg ist Same-Origin `BroadcastChannel`, Fallback ist das `storage`-Event über `localStorage`.
- Drucktabs veröffentlichen einen kurzen lokalen Heartbeat; ein verbundener B1-Tab wird bei mehreren offenen Tabs bevorzugt.
- Neuer benannter Drucktab `niimbot-print`: `handoff.html` versucht den bestehenden Tab direkt zu finden, per `postMessage` zu beliefern und zu fokussieren, ohne ihn neu zu laden.
- `handoff.html` hat jetzt eine eigene CSP-kompatible CSS-Datei; keine blockierten Inline-Styles mehr.
- Mehrere best-effort Close-Strategien für Bluefy/WKWebView sowie optionale Erkennung exakt benannter nativer Close-/Dismiss-Bridges.
- Wenn Bluefy das Schließen weiterhin blockiert, kann „Zum Drucktab wechseln“ den benannten Drucktab best-effort fokussieren; die BLE-Verbindung bleibt im bestehenden Dokument.
- Service Worker dient in v18 nur noch PWA-Cache/Update, nicht mehr der Tab-Übergabe.
- App-/Cache-Version auf v18 erhöht.

Hinweis: Eine Webseite kann einen von der Host-App extern erzeugten Bluefy-Tab nicht garantiert schließen. v18 versucht alle sinnvollen Web-Wege, ohne den funktionierenden Drucktab zu navigieren.

## v18 Handoff-Empfängerwahl
- Drucktabs senden jetzt alle 1,5 Sekunden einen lokalen Heartbeat.
- `connected`, `visible` und `focused` werden getrennt erfasst; ein verbundener Tab hat immer Vorrang vor einem bloß sichtbaren Hilfstab.
- Veraltete Registry-Einträge werden nach 90 Sekunden entfernt.
- Der Connected-Status gilt nur für das aktuelle Browserdokument und wird nicht über Reloads hinweg erfunden.
- Weiterhin kein Server-/Handoff-Endpunkt erforderlich.
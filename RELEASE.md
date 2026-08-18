# Release v15

- Bluefy-Handoff grundlegend robuster: Service Worker vermittelt zwischen neu geöffnetem Deep-Link-Hilfstab und bereits offenem Drucktab.
- Bestehender verbundener Tab wird bevorzugt und per `WindowClient.focus()` best-effort wieder aktiviert.
- BroadcastChannel/localStorage bleiben nur als Kompatibilitäts-Fallback bestehen.
- Neue kleine `handoff.html` für Jira/Apple-Kurzbefehle; lädt nicht die komplette Druck-App in einem zweiten Tab.
- Bestehende `#handoff=1&url=...`-Links bleiben kompatibel.
- App-/Cache-Version auf v15 erhöht.

Hinweis: Bluefy dokumentiert keinen Parameter, der beim externen `bluefy://open?url=...` garantiert einen vorhandenen Tab ersetzt. v15 vermeidet daher eine Navigation des verbundenen Drucktabs und übergibt nur die Label-Daten.

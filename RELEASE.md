# Release v29

- Experimentelle Option „Nach dem Druck zur Ursprungs-App zurück“.
- Neuer URL-Parameter `return=` bzw. `returnUrl=`.
- Rückkehr wird erst nach erfolgreichem Druck ausgeführt; bei aktivem Disconnect erst nach dem Trennen.
- Gefährliche Return-Schemes (`javascript:`, `data:`, `file:`, `blob:`) werden verworfen.
- v28-Auto-Reconnect, Auto-Print und Disconnect bleiben erhalten.
- App-Version und Service-Worker-Cache: v29.
- README enthält Branch-Test und Rollback-Anleitung.

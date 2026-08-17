# Architekturentscheidungen v1

1. **Anwendungsfall**  
   QR-Inhalt eingeben, QR-Code lokal rendern, 50×30-mm-Label anzeigen und NIIMBOT B1/B1 Pro ohne NIIMBOT-App direkt per Web Bluetooth drucken. iPhone/iPad nutzen dafür einen Web-BLE-Browser wie Bluefy; Android nutzt einen Chromium-Browser.

2. **Datenstruktur**  
   `items` für Vorlagen und `history` für Druckmetadaten. IDs sind UUIDs, Zeitstempel ISO-8601. Keine Druckbilder dauerhaft notwendig.

3. **Ansichten**  
   Eine mobile Hauptansicht mit Editor/Vorschau/Druck, einklappbaren Druckeinstellungen, Vorlagen/Verlauf und Setup/Backup/Update.

4. **Lokal / Server**  
   Lokal: IndexedDB. Server: Flask-REST-API + SQLite. Kein Fake-Sync; ein Moduswechsel wechselt nur den Datenspeicher.

5. **Provider**  
   UI → DataProvider → LocalProvider oder ServerProvider. Der `B1Printer` ist separat, weil BLE nicht über den Datenprovider und nicht über den Server laufen soll.

6. **Cloudflare/CORS/Security**  
   Server-URL nur HTTPS (localhost-Ausnahme). Cloudflare-Service-Token wird nur lokal gespeichert, nicht exportiert. Backend erlaubt CORS nur für `PWA_ALLOWED_ORIGIN`. CSP verbietet Inline-Scripts/eval; v1 erlaubt nur die explizite Script-Origin `https://unpkg.com`.

7. **Environment**  
   `APP_TITLE`, `APP_URL`, `PWA_ALLOWED_ORIGIN`, `BACKUP_KEEP`.

8. **Backup/Migration**  
   Backupformat `qr-label-backup` v1. SQLite-Schema v1 wird automatisch angelegt. Vor Server-Import wird ein SQLite-Backup erzeugt.

9. **ZIP/Git/Deployment**  
   Beide ZIPs sind Repository-Root-Pakete. Der Import-Workflow verarbeitet genau ein geändertes top-level ZIP, schützt `.git` und sich selbst, entfernt das ZIP und pusht den importierten Stand.

10. **Offline-App-Shell / Update**  
    Service Worker cached die lokale App-Shell. Vendor-Skripte werden opportunistisch gecacht. Neue Worker warten; keine automatische Reload-Schleife und kein erzwungener Reload während eines Drucks.

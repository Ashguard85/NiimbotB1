# Third-party notices

## niimbot-web-bluetooth

Project: `iscarelli/niimbot-web-bluetooth`  
License: MIT  
Pinned runtime version in v1: `2.4.0`

The library provides the Web Bluetooth protocol implementation used to communicate with NIIMBOT printers.

## qrcode-generator

Project: `kazuhikoarase/qrcode-generator`  
License: MIT  
Pinned runtime version in v1: `1.4.4`

The library generates QR matrices in the browser.

## Runtime hosting note

v1 loads both pinned libraries from `unpkg.com`. The service worker caches them opportunistically after a successful online load, so they can be reused offline if the browser permits caching opaque cross-origin script responses.

For a completely dependency-self-hosted deployment, copy the exact pinned JS files into `vendor/`, change the two `<script>` tags in `index.html`, update the service-worker cache list, and tighten CSP back to `script-src 'self'`.

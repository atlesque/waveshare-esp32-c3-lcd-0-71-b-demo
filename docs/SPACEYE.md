# Spaceeye

Live game: https://spaceeye.atlesque.dev

Open the same address on up to four devices and select **Take a ship**. Arrow keys or WASD control rotation, thrust and braking; touch buttons support simultaneous holds. The fifth visitor can watch until a seat opens. **Leave ship** releases a seat. A disconnected browser reconnects automatically and can join again.

All pilots share the `lcd-arena-v2` Durable Object in the `spaceeye` Cloudflare Worker. Movement is computed on the server, bounded to the circular arena, and broadcast over WebSockets. A pilot’s thrust expires after 350 ms without input. Socket attachments preserve active ship state across hibernation; positions are ephemeral and disappear when pilots leave. No account is needed to play.

The Waveshare firmware joins the configured 2.4 GHz Wi-Fi, synchronizes time for certificate validation, and reads `https://spaceeye.atlesque.dev/lcd`. It uses the Arduino core’s certificate bundle, never insecure TLS. The network runs in a separate task; the LCD draws at approximately 30 fps. The nominal polling delay is 250 ms plus request time. Failed requests retry after two seconds and Wi-Fi reconnects automatically. Old positions disappear after five seconds without a valid update.

## Source and deployment

- `spaceeye/index.html`: browser interface and controls.
- `spaceeye/server.mjs`: shared game and LCD protocol.
- `spaceeye/build.mjs`: builds the self-contained `worker.js` used by the dashboard editor and deployment tool.
- `spaceeye/wrangler.jsonc`: exact account, domain, room binding, SQLite class export and observability settings.
- `visual_demo/demo.cpp`: LCD firmware; preserves the repository-local TFT driver fixes.
- `visual_demo/original_demo.cpp.txt`: previous visual demo, saved for reference.

From `spaceeye/`, run `npm ci`, `npm test`, then `npm run deploy`. The account must match the configured Atlesque account. The Worker and custom domain were created through Cloudflare’s browser dashboard; Wrangler provisioned the new SQLite Durable Object class because the dashboard binding picker only offered existing namespaces. Cloudflare’s current declarative `exports` configuration is used.

Wi-Fi credentials live in ignored `visual_demo/secrets.h`; copy `secrets.example.h` and fill it locally on another checkout. Never publish that file. Build binaries also contain the credentials and must remain ignored. Use the repository-local upload script and discover the USB port before flashing; see `DEVICE_HANDOFF.md`.

## Verification, 11 October 2026

- Integration checks pass for four-pilot capacity, movement, LCD protocol, seat reuse, origin checks and malformed input.
- Live browser testing connected four pilots and a fifth spectator. Keyboard thrust visibly moved the fourth ship.
- Firmware flash hashes verified on ESP32-C3 MAC `ac:a7:04:b4:42:f0`.
- Serial confirmed Wi-Fi connection, over 280 valid LCD updates, four pilots, and continuing display frames beyond 150 seconds without a crash. Browser reported `LCD · LIVE`.
- Final firmware: 1,225,138 bytes application, 37,096 bytes static RAM, approximately 91 KB free heap during synchronization. The default application slot is 93% used.
- Guest Wi-Fi signal measured around -84 to -86 dBm. The eight-second connection timeout handles initial slow connections; update latency depends on signal quality.
- Physical LCD appearance was not inspected by the agent.

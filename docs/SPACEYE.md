# Spaceeye

Live game: https://spaceeye.atlesque.dev

Open the same address on up to four devices and select **Take a ship**. Arrow keys or WASD control rotation, thrust and braking; touch buttons support simultaneous holds. The fifth visitor can watch until a seat opens. **Leave ship** releases a seat. A disconnected browser reconnects automatically and can join again.

All pilots share the `lcd-arena-v4` Durable Object in the `spaceeye` Cloudflare Worker. Movement is computed on the server and broadcast over WebSockets. Ships collide with each other and bounce with a small energy loss. Crossing the circular map boundary wraps a ship to the opposite side, preserving its heading, velocity and distance travelled past the edge. Physics uses small steps to prevent fast ships passing through each other. A pilot’s thrust expires after 350 ms without input. Socket attachments preserve active ship state across hibernation; positions are ephemeral and disappear when pilots leave. No account is needed to play.

The Waveshare firmware joins the configured 2.4 GHz Wi-Fi, synchronizes time for certificate validation, and reads `https://spaceeye.atlesque.dev/lcd`. It uses the Arduino core’s certificate bundle, never insecure TLS. The network runs in a separate task; the LCD draws at approximately 30 fps. The nominal polling delay is 250 ms plus request time. Failed requests retry after two seconds and Wi-Fi reconnects automatically. Old positions disappear after five seconds without a valid update.

## Combat controls

| Action | Keyboard / touch | Behavior | Recharge |
|---|---|---|---|
| Guns | Hold Space / Guns | Rapid rounds, 8 hull damage per hit | 0.18 s |
| Missile | M / Missile | Homes toward the nearest opposing ship, 24 damage | 1.5 s |
| Photon torpedo | T / Photon torpedo | 40 damage within an 18-unit blast radius | 2.5 s |
| Warp drive | Shift / Warp drive | Jumps 45 units forward, wraps at the boundary, brief shield | 5 s |

Ships have 100 hull points. Destruction credits a kill and respawns the ship after 1.5 seconds with two seconds of protection. Firing ends spawn protection. Cooldowns and damage are enforced by the server. Projectiles expire at the edge; ships and warp jumps wrap. The browser and LCD show rounds, missiles, photon blasts, shields and warp effects. The browser also shows hull, kills and recharge times.

Combat firmware reads `/lcd?v=2`. Protocol `SPACEYE2` carries up to four ships, 24 projectiles and eight effects in a bounded text response. The original `/lcd` protocol remains available for older firmware. Active projectile/effect state is saved in Durable Object SQLite storage; ship state uses WebSocket attachments.

## Source and deployment

- `spaceeye/index.html`: browser interface and controls.
- `spaceeye/server.mjs`: shared game and LCD protocol.
- `spaceeye/simulation.mjs`: weapons, cooldowns, damage, respawns and combat effects.
- `spaceeye/physics.mjs`: ship movement, collisions and circular map wrapping.
- `spaceeye/build.mjs`: builds the self-contained `worker.js` used by the dashboard editor and deployment tool.
- `spaceeye/wrangler.jsonc`: exact account, domain, room binding, SQLite class export and observability settings.
- `visual_demo/demo.cpp`: LCD firmware; preserves the repository-local TFT driver fixes.
- `visual_demo/original_demo.cpp.txt`: previous visual demo, saved for reference.

From `spaceeye/`, run `npm ci`, `npm test`, then `npm run deploy`. The account must match the configured Atlesque account. The Worker and custom domain were created through Cloudflare’s browser dashboard; Wrangler provisioned the new SQLite Durable Object class because the dashboard binding picker only offered existing namespaces. Cloudflare’s current declarative `exports` configuration is used.

Wi-Fi credentials live in ignored `visual_demo/secrets.h`; copy `secrets.example.h` and fill it locally on another checkout. Never publish that file. Build binaries also contain the credentials and must remain ignored. Use the repository-local upload script and discover the USB port before flashing; see `DEVICE_HANDOFF.md`.

## Verification, 11 October 2026

- Collision and wrapping checks pass alongside combat and multiplayer integration tests. Live WebSocket flight confirmed opposite-edge wrapping with momentum preserved in the `lcd-arena-v4` room; runtime reports `physics: collisions-wrap-v1`. No firmware change was needed for these physics features.

- Combined tests pass for collisions/wrapping, four-pilot capacity, LCD protocols, seat reuse, origin checks, malformed input, guns, homing missiles, splash damage, kill credit, respawns, shields, warp and cooldown enforcement.
- Live browser testing connected four pilots and a fifth spectator. Keyboard thrust visibly moved the fourth ship.
- Firmware flash hashes verified on ESP32-C3 MAC `ac:a7:04:b4:42:f0`.
- Serial confirmed Wi-Fi connection, over 280 valid LCD updates, four pilots, and continuing display frames beyond 150 seconds without a crash. Browser reported `LCD · LIVE`.
- Final combat firmware: 1,227,132 bytes application, 37,784 bytes static RAM, approximately 90.8 KB free heap during synchronization. The default application slot is 93% used.
- Guest Wi-Fi signal measured around -84 to -86 dBm. The eight-second connection timeout handles initial slow connections; update latency depends on signal quality.
- Physical LCD appearance was not inspected by the agent.
- Combat firmware flash verified; serial confirmed live pilots, six gun projectiles and two warp effects, and continuing frames beyond 60 seconds. Live browser actions confirmed missile, photon and warp launch feedback and recharge states.
- A live guided missile hit reduced the opposing ship from 100% to 76% hull. See `spaceeye-combat.png` for the browser view.

# Spaceeye

Live game: https://spaceeye.atlesque.dev

Open the same address on up to four devices and select **Take a ship**. Arrow keys or WASD control rotation, thrust and braking; touch buttons support simultaneous holds. While at least one human is flying, AI pilots fill every empty seat; a joining human takes over an AI ship with a fresh hull, and AI pilots leave with the last human. The fifth human visitor can watch until a seat opens. **Leave ship** releases a seat, which an AI pilot refills if other humans remain. A disconnected browser reconnects automatically and can join again.

All pilots share the `lcd-arena-v4` Durable Object in the `spaceeye` Cloudflare Worker. Movement is computed on the server and broadcast over WebSockets. Ships collide with each other and bounce with a small energy loss. Crossing the circular map boundary wraps a ship to the opposite side, preserving its heading, velocity and distance travelled past the edge. Physics uses small steps to prevent fast ships passing through each other. A pilot’s thrust expires after 350 ms without input. Socket attachments preserve active ship state across hibernation; positions are ephemeral and disappear when pilots leave. No account is needed to play.

The Waveshare firmware joins the configured 2.4 GHz Wi-Fi, synchronizes time for certificate validation, and opens a persistent verified-TLS WebSocket at `wss://spaceeye.atlesque.dev/ws?lcd=1`. It uses the Arduino core’s certificate bundle. The network runs in a separate task with bounded receive buffers and reconnects automatically. Wi-Fi power saving and TCP packet batching are disabled to reduce latency. The LCD targets 60 fps, sending only changed 16×16 tiles over the verified 27 MHz SPI configuration. Old positions disappear after five seconds without a valid update. Actual frame rate and update age are reported in serial diagnostics. LCD broadcasts carry compact state at most once per 33 ms, and firmware coalesces pending snapshots so multiple pilots cannot build an unbounded queue. See [STABILITY.md](STABILITY.md) for bounded reception, parsing and overload regression checks.

## Combat controls

| Action | Keyboard / touch | Behavior | Recharge |
|---|---|---|---|
| Guns | Hold Space / Guns | Rapid rounds, 8 hull damage per hit | 0.18 s |
| Missile | M / Missile | Homes toward the nearest opposing ship, 24 damage | 1.5 s |
| Photon torpedo | T / Photon torpedo | 40 damage within an 18-unit blast radius | 2.5 s |
| Warp drive | Shift / Warp drive | Jumps 45 units forward, wraps at the boundary, brief shield | 5 s |

Ships have 100 hull points. Destruction credits a kill and respawns the ship after 1.5 seconds with two seconds of protection. Firing ends spawn protection. Cooldowns and damage are enforced by the server. AI pilots chase the nearest opponent, fire guns when lined up and launch missiles and photon torpedoes on the same cooldowns; they are marked AI in the browser. Projectiles expire at the edge; ships and warp jumps wrap. The browser and LCD show rounds, missiles, photon blasts, shields and warp effects. The browser also shows hull, kills and recharge times.

The current firmware reads the existing JSON WebSocket state, including ship velocity and missile targets. It extrapolates movement, inferred turning, acceleration, damping, collisions and map wrapping in 10 ms steps for at most 250 ms after each update. Guns, missiles and photon shots advance locally at the server’s speeds; missiles home and predicted impacts hide shots without changing authoritative health or kills. Each new state replaces predictions; warps and respawns take effect from the server. Effects age locally. The LCD sends an application heartbeat each second, maintaining the browser’s LCD LIVE indicator without HTTP polling.

The fallback HTTP endpoint `/lcd?v=2` remains available for older firmware. Protocol `SPACEYE2` carries up to four ships, 24 projectiles and eight effects in a bounded text response. The original `/lcd` protocol remains available for older firmware. Active projectile/effect state is saved in Durable Object SQLite storage; ship state uses WebSocket attachments.

## Source and deployment

- `spaceeye/index.html`: single-screen mobile HUD (pilots, hull, arena, flight and weapon buttons).
- `spaceeye/server.mjs`: shared game and LCD protocol.
- `spaceeye/simulation.mjs`: weapons, cooldowns, damage, respawns and combat effects.
- `spaceeye/physics.mjs`: ship movement, collisions and circular map wrapping.
- `spaceeye/build.mjs`: builds the self-contained `worker.js` used by the dashboard editor and deployment tool.
- `spaceeye/wrangler.jsonc`: exact account, domain, room binding, SQLite class export and observability settings.
- `visual_demo/demo.cpp`: LCD rendering, changed-tile transfers and runtime performance diagnostics.
- `visual_demo/stream.cpp`: verified-TLS WebSocket transport and bounded state reception.
- `visual_demo/prediction.cpp`: local visual simulation; portable native tests live in `tests/prediction_test.cpp`.
- `visual_demo/arena_protocol.cpp`: portable legacy LCD protocol parser; preserves older HTTP protocol checks.
- `visual_demo/original_demo.cpp.txt`: previous visual demo, saved for reference.

From `spaceeye/`, run `npm ci`, `npm test`, then `npm run deploy`. The account must match the configured Atlesque account. The Worker and custom domain were created through Cloudflare’s browser dashboard; Wrangler provisioned the new SQLite Durable Object class because the dashboard binding picker only offered existing namespaces. Cloudflare’s current declarative `exports` configuration is used.

Wi-Fi credentials live in ignored `visual_demo/secrets.h`; copy `secrets.example.h` and fill it locally on another checkout. Never publish that file. The streaming firmware requires the already installed ArduinoJson 7.4.3 library. Build binaries also contain the credentials and must remain ignored. Use the repository-local upload script and discover the USB port before flashing; see `DEVICE_HANDOFF.md`.

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

## Streaming and prediction verification, 11 October 2026

- Final firmware flash hashes verified on the same ESP32-C3 MAC. Application: 1,209,118 bytes; static RAM: 71,168 bytes. Driver/pins/27 MHz SPI and compatibility fixes preserved.
- Final live run used four temporary pilots with 50 ms control input, held guns and rotating missile/photon/warp actions for 120 seconds. The server reached 24 projectiles and eight effects. Temporary seats were released afterward; serial confirmed zero pilots while still connected.
- Combat rendering sustained 45.8–49.6 fps in the steady ten-second measurement intervals (18.3–20.6 ms average rendering time). After releasing the temporary pilots, the final firmware measured 65.6 fps unloaded (3.3 ms average rendering time). This is measured runtime throughput, not physical panel refresh or end-to-end input latency.
- Serial received over 2,200 valid snapshots, with sampled active-combat snapshot age 2–49 ms. Local prediction bridges successive snapshots. No crash, reset, frame rejection or reconnect appeared during the final run.
- Typical free heap was 57.2 KB; minimum observed heap 38,220 bytes; typical largest free allocation 45,044 bytes; network task stack headroom 7,592 bytes. Heap recovered after transient TLS receive allocations.
- Changed-tile transfers used roughly 5.2–5.7 MB per ten seconds during sustained combat, compared with 11.0 MB using the earlier full-width strips. Header bounds were adjusted for Cloudflare's live response headers; certificate bundles are reattached on each TLS reconnect.
- Native prediction, legacy text parser and streaming regression tests pass with address/undefined-behavior sanitizers. The stream suite includes 10,000 maximum-load parses and fixed-pool recovery. The multiplayer/combat integration suite and LCD observer/compact-state checks pass; the tested server was deployed to the existing domain.
- Physical LCD appearance was not inspected by the agent. Serial monitors were closed after verification.

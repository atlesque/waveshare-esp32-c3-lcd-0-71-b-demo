# Display stability under sustained data

The firmware combines live streaming and local motion prediction with bounded
network and display work. The original intermittent disconnect was not captured
with a crash trace; these changes address overload risks found in the code.

- Render into the existing 51,200-byte sprite. Hash one hundred 16×16 tiles and
  send only changed tiles, rather than repeatedly transferring the whole screen.
  Refresh all tiles every five seconds. Tile hashes use 400 bytes and a packed
  staging tile uses 512 bytes of render stack; no second framebuffer is allocated.
  Display transfers remain on the documented 27 MHz
  driver configuration with the ESP32-C3 compatibility patches preserved.
- Cap each WebSocket message at 8,192 bytes, including fragmented messages. Reject
  unsupported, oversized or malformed frames and reconnect. A partial frame or
  fragmented message cannot occupy the receiver indefinitely: its timeout is five
  seconds. Control frames can interleave with fragmented text messages.
- Read TLS in blocks of at most 512 bytes. Drain at most 2,048 bytes per receive
  slice, checking a four-millisecond time budget between blocks, then yield to
  other tasks. Coalesce completed messages in one fixed pending buffer and publish
  at most once every 33 ms, so pending state storage cannot grow with traffic.
- Parse JSON with a fixed 16 KiB allocation pool, reused after each document is
  destroyed. Excessive JSON structure or nesting fails cleanly instead of growing
  the TLS heap. Require the numeric and boolean fields used by rendering, enforce
  entity counts/ranges, reject missing fields and normalize headings. Invalid
  updates leave the shared arena unchanged.
- Bound the TLS upgrade headers to 512 bytes per line, approximately 4 KiB total,
  and an eight-second read deadline.
- Reattach the certificate bundle before every secure connection attempt. In the
  installed ESP32 core, `stop_ssl_socket()` clears the client context, including
  its bundle callback, while `NetworkClientSecure` retains its bundle-use flag.
  Without reattachment, the next connection fails with `No CA Chain set`. The
  original polling firmware also stopped TLS on errors without reattaching the
  bundle, so one temporary failure could prevent subsequent synchronization.
  Certificate verification remains enabled.
- Serial diagnostics report reset reason, free/minimum heap, largest available
  allocation, network stack headroom, transferred display bytes and frame rate.
  Stalled connections reconnect; displayed state expires after five seconds.

The streaming receiver and JSON pool are used only by the network task. Their
fixed buffers add memory overhead, which must be checked on the flashed board
alongside TLS handshake headroom. Host tests alone do not prove physical display
stability or diagnose power, cable or Wi-Fi failures.

## Regression checks

From the repository root, using the installed ArduinoJson headers:

```sh
c++ -std=c++17 -fsanitize=address,undefined -g -Ivisual_demo tests/firmware_test.cpp visual_demo/arena_protocol.cpp -o /tmp/spaceeye-firmware-test
/tmp/spaceeye-firmware-test
c++ -std=c++17 -fsanitize=address,undefined -g -Ivisual_demo -I/Users/alex/Documents/Arduino/libraries/ArduinoJson/src tests/stream_test.cpp visual_demo/stream_protocol.cpp -o /tmp/spaceeye-stream-test
/tmp/spaceeye-stream-test
c++ -std=c++17 -fsanitize=address,undefined -g tests/prediction_test.cpp visual_demo/prediction.cpp -o /tmp/spaceeye-prediction-test
/tmp/spaceeye-prediction-test
```

The legacy text parser tests cover maximum counts, duplicate slots, malformed and
truncated input, numeric overflow and 20,000 randomized invalid bodies. Streaming
tests cover 10,000 maximum-load parses (four ships, 24 shots, eight effects), fixed
JSON pool exhaustion and recovery, missing/wrong field types, fragmented frames,
interleaved ping, exact and excessive buffer sizes, partial-message timeouts and
1,000 repeated complete frames. Address and undefined-behavior sanitizers pass.

See `DEVICE_HANDOFF.md` for build/upload/recovery, and `SPACEYE.md` for the combined
firmware's device runtime verification and live game architecture.

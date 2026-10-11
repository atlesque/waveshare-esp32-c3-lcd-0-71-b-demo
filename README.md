# Waveshare ESP32-C3-LCD-0.71-B visual demo

A standalone, looping 160×160 display demo: rainbow halo, animated blinking eye, and color waves. Each scene lasts eight seconds. No Wi-Fi or other peripherals are required.

## Next-agent handoff

Read [docs/DEVICE_HANDOFF.md](docs/DEVICE_HANDOFF.md) for the complete upload procedure, compatibility fixes, recovery steps, hardware capabilities and limits. [AGENTS.md](AGENTS.md) directs future agents to that guide.

## Hardware configuration

GC9D01 display; MOSI GPIO7, clock GPIO6, CS GPIO5, DC GPIO4, reset GPIO8; SPI 27 MHz. A 16-bit framebuffer provides smooth redraws.

## Build and upload

Install Arduino CLI and Espressif's ESP32 core 3.3.2:

```sh
arduino-cli core install esp32:esp32@3.3.2 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
./upload.sh /dev/cu.usbmodem2101
```

USB CDC is enabled. Serial output at 115200 baud reports initialization and animation progress.

## Driver provenance

`libraries/TFT_eSPI` is the vendor-supplied TFT_eSPI 2.5.0 fork, including GC9D01 support, from [Waveshare's official demo archive](https://files.waveshare.com/wiki/ESP32-C3-LCD-0.71/ESP32-C3-LCD-0.71-Demo.zip). Its license is retained. Unused examples and tools are omitted, and `User_Setup.h` contains the board-specific configuration. The C3 processor header explicitly includes `soc/gpio_struct.h` for Arduino ESP32 3.x compatibility and uses hardware register index 2 for SPI2 (distinct from the SPI host enum). It also keeps MISO disconnected on core 3.x: aliasing MISO and MOSI triggers a pin ownership conflict and stalls initialization.

The demo uses a C++ implementation with explicit declarations. The upload script bypasses the legacy Intel-only Arduino ctags helper on Apple Silicon; no generated function prototypes are needed.

[Waveshare board documentation](https://docs.waveshare.com/ESP32-C3-LCD-0.71)

## Verified on hardware

Built and uploaded over USB to an ESP32-C3 revision 0.4 with 4 MB flash. The uploader verified flash hashes. Serial output confirmed display initialization and all three animation scenes, returning to scene 0 after 27 seconds / 750 frames without a reboot. The physical screen appearance still requires visual inspection.

## Spaceeye multiplayer game

The current firmware mirrors up to four browser-controlled spaceships from [spaceeye.atlesque.dev](https://spaceeye.atlesque.dev) over Wi-Fi. See [the Spaceeye guide](docs/SPACEYE.md) for controls, deployment and verification. Create the ignored `visual_demo/secrets.h` from `secrets.example.h` before building on a new checkout.

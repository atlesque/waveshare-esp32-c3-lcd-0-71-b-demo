# Device and firmware handoff

## Current application: Spaceeye

As of 11 October 2026, `visual_demo/demo.cpp` runs the four-player Spaceeye LCD display. Read [SPACEYE.md](SPACEYE.md) for the live URL, architecture, credentials setup, deployment, and verification. The visual-demo runtime messages and build sizes below describe the previous application, saved as `visual_demo/original_demo.cpp.txt`. The verified toolchain, upload process, hardware mapping and compatibility fixes still apply.

Last verified: 11 October 2026. This guide describes the USB-connected Waveshare ESP32-C3-LCD-0.71-B and the working firmware in this repository.

## Quick path for the next agent

1. Read `AGENTS.md` and this guide. Inspect local changes before editing.
2. Discover the current port with `arduino-cli board list` and `ls /dev/cu.*`. A generic/Unknown board label is normal. The verified port was `/dev/cu.usbmodem2101`.
3. Edit `visual_demo/demo.cpp` or add other `.cpp`/`.h` files in `visual_demo/`. Keep the matching `visual_demo.ino` stub.
4. Build and upload with `./upload.sh /dev/cu.usbmodem2101`, substituting the discovered port.
5. Verify the uploader reports `Hash of data verified` and resets the board. Read runtime output and confirm the new behavior progresses without crashes.
6. Close the monitor with Ctrl-C. Report whether the physical display was actually inspected.

The user's original upload request authorized replacing the existing firmware with this demo. For future requests, act within that request's scope. Upload replaces the application in flash; it is not a file copied to a USB drive.

## Verified hardware and connections

The uploader identified ESP32-C3 QFN32 revision 0.4, single core at 160 MHz, 40 MHz crystal, embedded 4 MB XMC flash, and USB Serial/JTAG. MAC observed: `ac:a7:04:b4:42:f0`. Use chip/MAC identification if several boards are connected; a port name alone is insufficient.

The vendor display configuration uses **GC9D01**, 160×160, BGR order, inversion off, and 27 MHz SPI. Do not substitute GC9A01 just because the panel is round.

| Display signal | GPIO |
|---|---:|
| MOSI / data | 7 |
| SCLK | 6 |
| CS | 5 |
| DC | 4 |
| RST | 8 |
| MISO | Disconnected (`-1`) |

Native USB uses GPIO18/19; preserve these for USB access. Avoid repurposing the display pins. GPIO2/8/9 are chip boot strapping pins; GPIO8 is also display reset. Check the schematic before connecting external hardware or assuming a pad is free. Available expansion-pad mapping has not been audited in this session.

## Toolchain and repository layout

Host: Apple Silicon macOS, zsh. Arduino CLI is installed at `/opt/homebrew/bin/arduino-cli`. Espressif Arduino core **3.3.2** was installed and successfully used. Core/tool packages reside under `/Users/alex/Library/Arduino15/packages/esp32/`; no Python package or AI runtime is needed to build this firmware.

```sh
arduino-cli version
arduino-cli core list
arduino-cli board list
```

If the core is missing:

```sh
arduino-cli core install esp32:esp32@3.3.2 --additional-urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
```

Exact tested board selection:

```text
esp32:esp32:esp32c3:CDCOnBoot=cdc,FlashSize=4M,PartitionScheme=default
```

| Path | Purpose |
|---|---|
| `visual_demo/demo.cpp` | Application; `setup()` and `loop()` |
| `visual_demo/visual_demo.ino` | Arduino sketch stub |
| `libraries/TFT_eSPI/` | Vendor TFT_eSPI 2.5.0 fork with GC9D01 support |
| `libraries/TFT_eSPI/User_Setup.h` | Display configuration |
| `libraries/TFT_eSPI/Processors/TFT_eSPI_ESP32_C3.h` | Patched C3 compatibility layer |
| `tools/ctags/ctags` | No-op preprocessing helper |
| `upload.sh` | Build, then upload; optional port argument |
| `build/` | Generated binaries, ELF and map; ignored by Git |

The vendor fork is checked into the working directory, not installed globally. Pass `--libraries ./libraries` so compilation selects it. Its license is retained. Unused examples/tools were removed. The project files were uncommitted at the end of initial setup; do not assume they already exist in a remote repository.

## Build and upload separately

From the repository root:

```sh
BOARD='esp32:esp32:esp32c3:CDCOnBoot=cdc,FlashSize=4M,PartitionScheme=default'
arduino-cli compile --fqbn "$BOARD" --libraries ./libraries --build-property "runtime.tools.ctags.path=$PWD/tools/ctags" --build-path ./build ./visual_demo
arduino-cli upload --fqbn "$BOARD" --port /dev/cu.usbmodem2101 --input-dir ./build ./visual_demo
```

The build path is explicit to keep generated files inside the workspace. In Codex's restricted filesystem environment, ordinary compilation worked; core installation/downloads and access to `/dev/cu.usbmodem2101` required an approved `require_escalated` tool invocation. A serial-port `Operation not permitted` can be sandbox denial even when the uploader says the port is busy or absent. Use the tool's escalation mechanism when needed; do not change device permissions indiscriminately.

## Compatibility fixes that must survive future edits

1. **Apple Silicon preprocessing:** the installed Arduino ctags executable failed with `bad CPU type in executable`. `tools/ctags/ctags` exits successfully without generating prototypes. Application code lives in C++ files, with explicit declarations. Do not add `.ino` functions that rely on automatic forward declarations. The compile command overrides `runtime.tools.ctags.path` to this local helper.
2. **GPIO declaration:** the vendor C3 header includes `soc/gpio_struct.h`, fixing `GPIO was not declared` with core 3.3.2.
3. **SPI register index:** `SPI_PORT` is **2**, the index required by this core's `REG_SPI_BASE`. The vendor's `SPI2_HOST` enum evaluates to 1 and caused a Store access fault at `TFT_eSPI::begin_tft_write()`.
4. **Disconnected MISO:** the vendor remapped MISO `-1` to MOSI. That mapping stalled `tft.init()` with core 3.3.2. The remap is now limited to `ESP_ARDUINO_VERSION_MAJOR < 3`; on the tested core MISO stays disconnected.

These patches were verified together on core 3.3.2. Changing core versions or replacing the library requires a fresh build/upload/runtime check. The hardcoded register index is scoped to this verified toolchain.

## Runtime verification and recovery

```sh
arduino-cli monitor --port /dev/cu.usbmodem2101 --config baudrate=115200
```

Run the monitor with an interactive terminal/PTY; a noninteractive invocation exited without useful output in this session. USB CDC must remain enabled for `Serial` output. Startup has a 1.5-second delay to allow the monitor to connect.

Expected current-demo messages:

```text
Starting display initialization
Display initialized
Visual demo ready: GC9D01 160x160, MOSI7 CLK6 CS5 DC4 RST8
Running: scene=0 frames=150 uptime=6s
Running: scene=1 frames=300 uptime=11s
Running: scene=2 frames=450 uptime=16s
Running: scene=0 frames=750 uptime=27s
```

The final upload verified hashes; runtime progressed through all scenes and beyond 1,050 frames/37 seconds without observed crashes. Final build: 340,240 bytes program storage (25% of the selected 1,310,720-byte application slot), 13,576 bytes static RAM. A 160×160 RGB565 sprite adds **51,200 bytes of heap**; static RAM figures do not include this allocation. The demo checks allocation failure. Physical appearance was not inspected by the agent.

| Symptom | Next step |
|---|---|
| Port busy | Close serial monitors/other IDEs, rediscover port |
| Port access denied | Check sandbox escalation before assuming hardware failure |
| Cannot connect / USB disappears | Enter download mode using BOOT/RESET, rediscover port, retry |
| `bad CPU type` for ctags | Use the local helper and C++ layout |
| `GPIO` compile error | Restore explicit register-header include |
| Store access fault during display writes | Check SPI register index; decode against the exact uploaded ELF |
| Stops after `Starting display initialization` | Check MISO remap and all documented patches |
| No serial output | Check USB CDC setting and monitor timing/PTY |
| Runtime progresses but screen looks wrong | Inspect pin/driver/color/rotation settings and ask for physical observation |

Waveshare's recovery procedure: hold BOOT, press and release RESET while holding BOOT, then release BOOT. Retry the upload after checking the port. See the [official FAQ](https://docs.waveshare.com/ESP32-C3-LCD-0.71/FAQ).

For a crash, keep `build/visual_demo.ino.elf` from the exact flashed build and decode the printed addresses:

```sh
/Users/alex/Library/Arduino15/packages/esp32/tools/esp-rv32/2507/bin/riscv32-esp-elf-addr2line -e build/visual_demo.ino.elf -f -C 0xADDRESS
```

Tool versions/paths can change; discover the installed equivalent. Do not decode with an ELF from a different build. No backup of the original pre-demo firmware was taken. The official archive contains `Firmware/ESP32-C3-LCD-0.71-factory.bin`; inspect its flashing instructions before using it as a recovery image.

## Capabilities: onboard hardware

The following is documented for the 0.71/B family by [Waveshare](https://docs.waveshare.com/ESP32-C3-LCD-0.71):

| Feature | Capability |
|---|---|
| Screen | Round 0.71-inch IPS LCD, 160×160 |
| Compute | Single-core 32-bit RISC-V, up to 160 MHz |
| Memory | 400 KB SRAM, 384 KB ROM, 4 MB flash |
| Wireless | 2.4 GHz Wi-Fi b/g/n; Bluetooth 5 LE; ceramic antenna |
| USB-C | Power and programming |
| Battery | Lithium battery charging circuit; VBAT connection pads |
| Expansion | Some GPIOs exposed as solder pads |
| Controls | BOOT and RESET buttons |
| Power management | Low-power modes and configurable clocks |

Battery capacity, charging current, battery installation, backlight control, expansion pad mapping and total board sleep consumption were not verified. Do not assume a battery is included. Consult the [schematic](https://files.waveshare.com/wiki/ESP32-C3-LCD-0.71/ESP32-C3-LCD-0.71-Schematic.pdf) before wiring.

## Capabilities: ESP32-C3 silicon

These chip features come from the [Espressif datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf); board access depends on available pins and firmware.

| Subsystem | Supported features / requirements |
|---|---|
| Wi-Fi | Station, SoftAP, combined mode; shared radio with BLE |
| BLE | Advertising, GATT applications, mesh; no Bluetooth Classic |
| USB | Fixed USB Serial/JTAG; not general USB OTG/HID hardware |
| Serial buses | Two UARTs, I2C, I2S, general-purpose SPI2; SPI0/1 serve flash |
| Control | GPIO, six-channel LED PWM, RMT, timers, watchdogs |
| Analog | 12-bit ADCs, internal temperature sensor; not ambient measurement |
| CAN | TWAI controller; external transceiver required |
| DMA | General DMA hardware; local TFT driver does not support C3 display DMA |
| Sleep | Modem, light and deep sleep; chip figures exclude board/display consumption |
| Security | Secure boot, flash encryption, AES/SHA/RSA, RNG, HMAC, signatures |

GPIO18/19 serve USB, flash pins are reserved, and strap pins affect boot. Chip peripheral counts do not mean every signal is exposed on this board. Security provisioning can burn irreversible eFuses; it is outside routine demo uploads.

## Software possibilities and practical limits

The current firmware uses only the LCD and USB logging. Wireless, battery operation, expansion hardware, sleep behavior, security provisioning and OTA updates have not been exercised on this unit.

Possible applications with additional firmware include HTTP/HTTPS or MQTT status displays, NTP clocks, BLE-controlled graphics, sensor dashboards and notification indicators. They require appropriate libraries, credentials and error handling; they are not installed services. Do not commit Wi-Fi passwords or API keys.

The local graphics library supports RGB565 drawing, text and sprites. Keep important content within the circular visible area: center approximately (80,80), radius below 80 pixels. The demo targets roughly 30 frames/second, with actual speed dependent on scene/render time. Larger assets consume flash, and additional sprites consume heap. Check available heap when adding Wi-Fi, TLS or BLE.

Waveshare also provides [Arduino examples](https://docs.waveshare.com/ESP32-C3-LCD-0.71/Arduino) using TFT_eSPI and LVGL for text, shapes, animated eyes, images and a clock. LVGL is not vendored in this repository; install/configure a compatible version and `lv_conf.h` if adopting it.

The selected default partition has a 1.25 MiB application slot, not 4 MiB of application space. OTA and filesystem support require firmware implementation and a suitable partition layout. No PSRAM is configured. No onboard touch input, microphone, speaker, camera, motion sensor, SD slot or battery gauge has been established for this unit; use external hardware only after checking the schematic. A reset/boot button should not be treated as a general input without evaluating its hardware role.

This is a microcontroller suited to compact graphics and network tasks. It does not run a desktop operating system or large language models. Follow `AGENTS.md` for any external AI generation: inference belongs on Alex-desktop, not this laptop.

## Source and provenance links

- [Waveshare board specifications and pin mapping](https://docs.waveshare.com/ESP32-C3-LCD-0.71)
- [Waveshare Arduino examples](https://docs.waveshare.com/ESP32-C3-LCD-0.71/Arduino)
- [Waveshare USB/boot recovery FAQ](https://docs.waveshare.com/ESP32-C3-LCD-0.71/FAQ)
- [Official demo/driver/factory-firmware archive](https://files.waveshare.com/wiki/ESP32-C3-LCD-0.71/ESP32-C3-LCD-0.71-Demo.zip)
- [Board schematic, inspect before external wiring](https://files.waveshare.com/wiki/ESP32-C3-LCD-0.71/ESP32-C3-LCD-0.71-Schematic.pdf)
- [ESP32-C3 datasheet](https://www.espressif.com/sites/default/files/documentation/esp32-c3_datasheet_en.pdf)
- [Upstream TFT_eSPI C3 processor header](https://github.com/Bodmer/TFT_eSPI/blob/master/Processors/TFT_eSPI_ESP32_C3.h)

The vendor archive was downloaded to `/tmp/waveshare-demo.zip` and extracted under `/tmp/waveshare-official/` during setup. Those temporary paths are disposable and not prerequisites: the necessary patched driver is already in this repository.

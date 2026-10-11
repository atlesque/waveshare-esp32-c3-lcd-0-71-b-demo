# Agent instructions

## Device work

Before changing firmware or uploading to the attached Waveshare ESP32-C3-LCD-0.71-B, read [docs/DEVICE_HANDOFF.md](docs/DEVICE_HANDOFF.md). It contains the verified toolchain, display configuration, upload and recovery steps, and capability limits.

Use the repository-local TFT_eSPI fork and upload script. Preserve the documented ESP32-C3 compatibility fixes. Put implementation in `.cpp` files with explicit declarations: the local ctags helper intentionally generates no Arduino prototypes.

Discover the current USB port before uploading; `/dev/cu.usbmodem2101` is a previously verified port, not a permanent identifier. Close serial monitors before uploading. Confirm flash verification and runtime progress; distinguish runtime confirmation from physical visual inspection.

## Branch naming preference

Never use the `codex/` prefix. Use conventional prefixes such as `bugfix/`, `feature/`, `chore/`, `refactor/`, or `hotfix/`.

## AI model execution preference

Never run locally hosted AI inference on the laptop. Run models on Alex-desktop over the saved SSH connection; use the laptop only for orchestration and reviewing results. Keep model weights and AI runtime environments on the desktop, outside Git and Dropbox. Reuse existing weights; do not download models without explicit authorization. If the desktop is unavailable, report the blocker rather than using laptop inference.

#!/bin/sh
set -eu
cd "$(dirname "$0")"
BOARD='esp32:esp32:esp32c3:CDCOnBoot=cdc,FlashSize=4M,PartitionScheme=default'
arduino-cli compile --fqbn "$BOARD" --libraries ./libraries --build-property "runtime.tools.ctags.path=$PWD/tools/ctags" --build-path ./build ./visual_demo
arduino-cli upload --fqbn "$BOARD" --port "${1:-/dev/cu.usbmodem2101}" --input-dir ./build ./visual_demo

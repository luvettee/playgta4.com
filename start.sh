#!/bin/bash
set -e
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 or newer is required. Install Node.js, then run this script again." >&2
  exit 1
fi
exec node ./runtime/launch.js "$@"

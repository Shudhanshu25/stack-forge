#!/usr/bin/env bash
# One MongoDB dump of the stackforge database to /backups/stackforge-<UTC timestamp>.archive.gz.
# Written to a temporary name first, so a half-written dump is never mistaken for a backup.
set -euo pipefail

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="/backups/stackforge-${stamp}.archive.gz"
mongodump --uri="${MONGODB_URI}" --gzip --archive="${target}.partial" --quiet
mv "${target}.partial" "${target}"
echo "backup written ${target} ($(du -h "${target}" | cut -f1))"

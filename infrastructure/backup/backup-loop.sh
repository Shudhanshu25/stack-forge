#!/usr/bin/env bash
# Runs inside the `backup` service (mongo image): dump now, then every BACKUP_INTERVAL_HOURS,
# deleting dumps older than BACKUP_RETENTION_DAYS. One gzip archive per run in /backups.
set -euo pipefail

interval_hours="${BACKUP_INTERVAL_HOURS:-24}"
retention_days="${BACKUP_RETENTION_DAYS:-14}"

while true; do
  bash /scripts/backup-once.sh
  find /backups -maxdepth 1 -name 'stackforge-*.archive.gz' -mtime "+${retention_days}" -print -delete \
    | sed 's/^/pruned /'
  sleep "$((interval_hours * 3600))"
done

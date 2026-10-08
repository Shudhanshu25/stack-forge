#!/usr/bin/env bash
# Restores a backup into the production MongoDB, replacing what is there. One command:
#
#   infrastructure/backup/restore.sh                 # newest backup in BACKUP_DIR
#   infrastructure/backup/restore.sh <archive>       # a specific stackforge-*.archive.gz
#   infrastructure/backup/restore.sh --now           # take a fresh backup (no restore)
#
# Run from the repository root on the server. Stops the API and worker during the restore so
# nothing writes meanwhile, then starts them again. Collections are dropped before restoring.
set -euo pipefail

cd "$(dirname "$0")/.."            # infrastructure/
compose=(docker compose -f docker-compose.prod.yml --env-file .env.prod)
backup_dir="$(grep -E '^BACKUP_DIR=' .env.prod 2>/dev/null | cut -d= -f2- || true)"
backup_dir="${backup_dir:-./backups}"

if [[ "${1:-}" == "--now" ]]; then
  "${compose[@]}" run --rm --no-deps --entrypoint bash backup /scripts/backup-once.sh
  exit 0
fi

archive="${1:-}"
if [[ -z "$archive" ]]; then
  # Names carry a UTC timestamp, so the last one in name order is the newest.
  archive="$(find "$backup_dir" -maxdepth 1 -name 'stackforge-*.archive.gz' | sort | tail -n 1)"
  [[ -n "$archive" ]] || { echo "no backups in $backup_dir" >&2; exit 1; }
fi
[[ -f "$archive" ]] || { echo "not found: $archive" >&2; exit 1; }
name="$(basename "$archive")"
case "$(cd "$(dirname "$archive")" && pwd)" in
  "$(cd "$backup_dir" && pwd)") ;;
  *) echo "copy the archive into $backup_dir first (the backup container only sees that folder)" >&2; exit 1 ;;
esac

echo "restoring $name"
"${compose[@]}" up -d mongodb
"${compose[@]}" stop api worker >/dev/null 2>&1 || true
"${compose[@]}" run --rm --no-deps --entrypoint bash backup -c \
  "mongorestore --uri=\"\$MONGODB_URI\" --gzip --archive=/backups/$name --drop --nsInclude='stackforge.*' --quiet"
"${compose[@]}" up -d api worker
echo "restored $name"

#!/usr/bin/env bash
# Deploys one release on the server and rolls back if the smoke test fails.
#
#   IMAGE_PREFIX=ghcr.io/<owner>/stackforge infrastructure/deploy/deploy.sh <tag>
#
# Run from the directory that holds infrastructure/ (with infrastructure/.env.prod).
#   1. pull the release's images          (DEPLOY_SKIP_PULL=1 to use local images)
#   2. back up MongoDB                     (DEPLOY_SKIP_BACKUP=1 to skip)
#   3. run migrations with the new api image
#   4. start the new release
#   5. smoke test /api/v1/health/services through the proxy
#   6. on failure: start the previous release again, smoke test it, exit 1
# Migrations must stay compatible with the previous release (expand first, contract later),
# because a rollback runs the old code against the migrated database.
set -euo pipefail

new_tag="${1:?usage: deploy.sh <image tag>}"
cd "$(dirname "$0")/.."            # infrastructure/
state_file=".deployed-tag"
previous_tag="$(cat "$state_file" 2>/dev/null || true)"
export IMAGE_PREFIX="${IMAGE_PREFIX:?set IMAGE_PREFIX, e.g. ghcr.io/owner/stackforge}"

compose() {
  docker compose -f docker-compose.prod.yml --env-file .env.prod "$@"
}

site="$(grep -E '^SITE_ADDRESS=' .env.prod | cut -d= -f2- || true)"
site="${site:-localhost}"
smoke_test() {
  local attempts="${SMOKE_ATTEMPTS:-30}"
  for ((i = 1; i <= attempts; i++)); do
    if body="$(curl -fsSk --max-time 5 --resolve "${site}:443:127.0.0.1" \
      "https://${site}/api/v1/health/services" 2>/dev/null)"; then
      echo "smoke test passed: ${body}"
      return 0
    fi
    sleep 4
  done
  echo "smoke test failed after ${attempts} attempts" >&2
  return 1
}

release() {
  export IMAGE_TAG="$1"
  echo "== release ${IMAGE_PREFIX}:${IMAGE_TAG}"
  # An unhealthy new release makes `up` fail (dependents wait on health checks); the smoke
  # test below decides what happens next, so do not stop here.
  compose up -d --remove-orphans || echo "== compose reported a problem starting ${IMAGE_TAG}" >&2
  # Bind-mounted configs (Caddyfile, prometheus.yml) may have changed without the containers
  # being recreated: reload them in place (no downtime).
  compose exec -T proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile || true
  compose kill -s SIGHUP prometheus >/dev/null || true
}

echo "== deploying ${new_tag} (previous: ${previous_tag:-none})"
export IMAGE_TAG="$new_tag"
if [[ "${DEPLOY_SKIP_PULL:-0}" != 1 ]]; then
  compose pull api worker frontend simulation
fi
compose up -d mongodb redis
if [[ "${DEPLOY_SKIP_BACKUP:-0}" != 1 ]]; then
  compose run --rm --no-deps --entrypoint bash backup /scripts/backup-once.sh
fi
compose run --rm --no-deps api node dist/migrate.js

release "$new_tag"
if smoke_test; then
  echo "$new_tag" > "$state_file"
  echo "== deployed ${new_tag}"
  exit 0
fi

echo "== ${new_tag} is unhealthy; recent api logs:" >&2
compose logs --tail 40 api >&2 || true
if [[ -z "$previous_tag" ]]; then
  echo "== no previous release to roll back to" >&2
  exit 1
fi
echo "== rolling back to ${previous_tag}" >&2
release "$previous_tag"
if smoke_test; then
  echo "== rolled back to ${previous_tag}; ${new_tag} was not deployed" >&2
else
  echo "== rollback to ${previous_tag} is also unhealthy: investigate now" >&2
fi
exit 1

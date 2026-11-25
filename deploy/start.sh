#!/bin/sh
# Container start. By default only the web server (Docker Compose runs the migration and the worker as their own services).
# With MODULUS_SINGLE_CONTAINER=on (a Coolify "Dockerfile" resource, protected by Coolify's own HTTP basic auth, like Arche,
# Crucible and Clavis): apply the migrations (and the seed of an empty schema, MODULUS_SEED) first, then run the worker in the
# background (backups, outbox to Codex, declaration to Matrix), then the web server on port 3800.
set -e
if [ "${MODULUS_SINGLE_CONTAINER:-}" = "on" ]; then
  npm run db:migrate
  npm run worker &
fi
exec node_modules/.bin/next start -H 0.0.0.0 -p 3800

#!/bin/sh
set -e

# Soporte transparente tanto para VITE_SERVICE_TOKEN como RELAY_SERVICE_TOKEN
if [ -z "$RELAY_SERVICE_TOKEN" ] && [ -n "$VITE_SERVICE_TOKEN" ]; then
    export RELAY_SERVICE_TOKEN="$VITE_SERVICE_TOKEN"
fi

if [ -z "$BACKEND_API_URL" ] && [ -n "$VITE_API_URL" ]; then
    export BACKEND_API_URL="$VITE_API_URL"
fi

if [ -z "$BACKEND_API_URL" ]; then
    export BACKEND_API_URL="https://mtw-relay-api-production.up.railway.app/api/"
fi

exec /docker-entrypoint.sh "$@"

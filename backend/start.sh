#!/bin/sh
# Start the embedded FalkorDB (unless FALKORDB_URL points elsewhere), then the Echo API.
set -e
if [ -z "$FALKORDB_URL" ] && [ "${EMBEDDED_FALKORDB:-1}" = "1" ]; then
  redis-server --loadmodule /var/lib/falkordb/bin/falkordb.so TIMEOUT 5000 \
    --dir /data --save "" --appendonly no --port 6379 --bind 127.0.0.1 --daemonize yes
fi
exec /app/.venv/bin/uvicorn echo_memory.api:app --host 0.0.0.0 --port "${PORT:-7860}" --proxy-headers --forwarded-allow-ips="*"

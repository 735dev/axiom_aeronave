#!/usr/bin/env bash
# Levanta el backend REAL de Aeronaves para las pruebas del frontend en modo real.
#
#   AERO_BACKEND_DIR   repo del backend (por defecto el del equipo)
#   AERO_DB            base de datos propia de esta corrida (por defecto aero_c)
#   AERO_PG            host:puerto de Postgres (por defecto localhost:5440, usuario/clave aero/aero)
#   AERO_PORT          puerto de la API (por defecto 8100)
#   AERO_ORIGINS       orígenes CORS permitidos (por defecto el del preview de Playwright)
#   AERO_VENV_BIN      carpeta bin del entorno Python (por defecto .venv/bin del backend)
#   AERO_RESET         1 (por defecto) borra y recrea la base antes de migrar y sembrar, para que el
#                      seed (los permisos por rol solo se aplican a roles nuevos) corra siempre sobre
#                      una base limpia; `AERO_RESET=0` conserva la base para iterar
#
# Corre `alembic upgrade head` y el seed (`python -m app.scripts.init`, idempotente) y deja uvicorn
# en primer plano. BLACKBOX_MODE y RECEIPT_READER quedan en `fake`: nada sale a la red.
set -euo pipefail

BACKEND="${AERO_BACKEND_DIR:-/home/jerson/proyect code/Trabajos/axiom/axiom_aeronave_backend}"
DB="${AERO_DB:-aero_c}"
PG="${AERO_PG:-localhost:5440}"
PORT="${AERO_PORT:-8100}"
ORIGINS="${AERO_ORIGINS:-http://localhost:4174,http://localhost:3000}"

cd "$BACKEND"
BIN="${AERO_VENV_BIN:-.venv/bin}"

export PGPASSWORD=aero
PSQL=(psql -h "${PG%%:*}" -p "${PG##*:}" -U aero -d postgres -tA)
if [ "${AERO_RESET:-1}" = "1" ]; then
  "${PSQL[@]}" -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)" >/dev/null
fi
if [ -z "$("${PSQL[@]}" -c "SELECT 1 FROM pg_database WHERE datname='$DB'")" ]; then
  "${PSQL[@]}" -c "CREATE DATABASE \"$DB\"" >/dev/null
fi

export DATABASE_URL="postgresql+asyncpg://aero:aero@$PG/$DB"
export ENVIRONMENT=local BLACKBOX_MODE=fake RECEIPT_READER=fake
export ALLOWED_ORIGINS="$ORIGINS"
# Los límites de uso reales (20 lecturas/min por cuenta) los agotaría una sola corrida de pruebas.
export RATE_LIMIT_EXTRACT_PER_ACCOUNT="${RATE_LIMIT_EXTRACT_PER_ACCOUNT:-5000}"
export RATE_LIMIT_EXTRACT_PER_IP="${RATE_LIMIT_EXTRACT_PER_IP:-5000}"
export RATE_LIMIT_UPLOAD_PER_ACCOUNT="${RATE_LIMIT_UPLOAD_PER_ACCOUNT:-5000}"
export RATE_LIMIT_UPLOAD_PER_IP="${RATE_LIMIT_UPLOAD_PER_IP:-5000}"
export RATE_LIMIT_SEARCH_PER_ACCOUNT="${RATE_LIMIT_SEARCH_PER_ACCOUNT:-5000}"
export RATE_LIMIT_SEARCH_PER_IP="${RATE_LIMIT_SEARCH_PER_IP:-5000}"
export JWT_SECRET="${JWT_SECRET:-aero-real-mode-local-secret-0123456789abcdef}"

"$BIN/alembic" upgrade head >&2
"$BIN/python" -m app.scripts.init >&2
exec "$BIN/uvicorn" app.main:app --host "${AERO_HOST:-127.0.0.1}" --port "$PORT"

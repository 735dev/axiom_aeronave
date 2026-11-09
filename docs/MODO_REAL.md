# Modo real: el frontend contra el backend verdadero

Por defecto el frontend usa el simulador (`src/shared/api/mock/`, `VITE_PUBLIC_USE_MOCKS=true`).
El modo real lo reemplaza por el backend FastAPI. El simulador sigue siendo el predeterminado y
sus 372 pruebas unitarias y 17 escenarios e2e no cambian.

## Variables del frontend

| Variable | Modo simulador | Modo real |
| --- | --- | --- |
| `VITE_PUBLIC_USE_MOCKS` | `true` | `false` |
| `VITE_PUBLIC_URL_API` | cualquiera | `http://localhost:8100/api` |
| `VITE_PUBLIC_URL_VERSION` | `/v1` | `/v1` |

Desarrollo a mano contra el backend:

```bash
VITE_PUBLIC_USE_MOCKS=false VITE_PUBLIC_URL_API=http://localhost:8100/api npm run dev
```

## Levantar el backend

`scripts/real/backend.sh` hace todo: crea la base propia, `alembic upgrade head`, seed
(`python -m app.scripts.init`, idempotente) y deja uvicorn en primer plano. Corre con
`BLACKBOX_MODE=fake` y `RECEIPT_READER=fake`: nada sale a la red.

```bash
scripts/real/backend.sh                 # base aero_c, puerto 8100
scripts/real/backend.sh                 # por defecto borra y recrea la base en cada arranque
AERO_RESET=0 scripts/real/backend.sh    # conserva la base (para iterar)
```

Requiere Postgres en `localhost:5440` (usuario y clave `aero`; es el contenedor `aero-pg`).

| Variable | Por defecto | Efecto |
| --- | --- | --- |
| `AERO_BACKEND_DIR` | repo del backend del equipo | ruta del backend |
| `AERO_DB` | `aero_c` | base de datos de la corrida |
| `AERO_PG` | `localhost:5440` | host:puerto de Postgres |
| `AERO_HOST` | `127.0.0.1` | interfaz de uvicorn (`0.0.0.0` solo para el emulador, que llega por 10.0.2.2) |
| `AERO_PORT` | `8100` | puerto de la API |
| `AERO_ORIGINS` | `http://localhost:4174,http://localhost:3000` | orígenes CORS permitidos |
| `AERO_VENV_BIN` | `.venv/bin` del backend | carpeta bin del entorno Python |
| `AERO_RESET` | `1` | `1` = borrar, recrear, migrar y sembrar la base en cada arranque; `0` = conservarla |
| `RATE_LIMIT_*_PER_ACCOUNT/IP` | `5000` | límites de extract, subida y búsqueda; los reales (20/min) los agota una corrida de pruebas |

Usuarios demo (clave `demo1234`): `super@`, `operaciones@`, `piloto@`, `mantenimiento@`,
`tierra@`, `admin@transvalor.com`. Capacitor/app móvil: agregar su origen a `AERO_ORIGINS`
(el backend no acepta `*` con credenciales).

## Pruebas e2e en modo real

```bash
npm run test:e2e:real
```

Usa `playwright.real.config.ts`: compila el frontend con `USE_MOCKS=false` en `build-real/`,
lo sirve con `vite preview` en el puerto 4174 y levanta el backend si no está arriba. Los datos
se crean solo por HTTP (`e2e/support/world.ts`, con `E2E_REAL=1`); no se toca la base.

- `E2E_SKIP_BUILD=1`: reutiliza `build-real/` (solo para iterar; la compuerta siempre compila).
- `E2E_REUSE=1`: reutiliza un `vite preview` ya levantado.

Son los 17 escenarios existentes, adaptados para que valgan en ambos modos, más
`e2e/acceptance.spec.ts` (solo real): el criterio de aceptación del Alcance §12 en 11 pasos,
cada rol en su propia sesión (piloto en viewport de teléfono). Cada corrida concilia un mes libre
distinto, así que puede repetirse sin resetear. El tiempo de espera de ese escenario es 240 s.

## Diferencias del contrato que el frontend ya maneja

- Subida de comprobantes: `multipart/form-data` (en simulador, JSON).
- Errores: `{title, detail, errors, codigo}`; `codigo` y `Retry-After` (429) llegan a `ApiError`.
- Auth: refresh con un solo vuelo en 401 y un reintento; logout remoto; `must_change_password`.
- Pasajeros como recurso propio (`GET/PUT /tickets/{id}/passengers/`).
- Conciliación: períodos cerrados y exportación auditada; el cierre del ticket es un `PATCH
  status_code=closed` protegido, con su resumen en `GET /tickets/{id}/closing/`.
- Avisos con filtros (`unread`, `kind`, `ticket_id`) y "marcar todo".
- Enlaces firmados de adjuntos (Blackbox fake devuelve `https://storage.fake.invalid/...`).

## Huecos conocidos del backend / seed (no corregidos aquí)

- El rol Mantenimiento no trae `tickets.edit.technical_report`, el permiso que exige el campo
  `corrective_action`: mantenimiento responde con 403 al escribir la acción correctiva.
- El rol Administración no trae `reconciliation.close`; solo el superusuario concilia y cierra
  períodos. El escenario de aceptación lo documenta con aserciones explícitas.
- El filtro `?code=` de `/tickets/` se ignora (devuelve todo).
- Colgado no reproducido de uvicorn (proceso a 100 % de CPU) en una corrida inicial; el script
  conviene arrancarlo con `PYTHONFAULTHANDLER=1` para capturar la traza si reaparece.

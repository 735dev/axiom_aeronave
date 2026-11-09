# Control de Operaciones Aéreas — Frontend

Prototipo funcional construido según `FRONTEND_ARCHITECTURE_SKILL.md`:
Vite 6 + React 18 + TypeScript strict + Redux Toolkit + redux-persist + axios
genérico + Zod + RHF + i18n (es/en) + dark mode.

Corre hoy sin backend. Cuando el backend exista, se apaga una bandera.

## Arrancar

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run build      # tsc -b && vite build
```

Usuarios de demostración (cualquier contraseña de 4+ caracteres):

| Correo | Rol |
|---|---|
| `operaciones@transvalor.com` | Gerencia de Operaciones |
| `piloto@transvalor.com` | Piloto |
| `mantenimiento@transvalor.com` | Mantenimiento |
| `tierra@transvalor.com` | Apoyo en tierra |
| `admin@transvalor.com` | Administración |
| `gerencia@transvalor.com` | Gerencia General |
| `super@transvalor.com` | Superusuario |

## Cómo se conecta el backend

Toda la app pega contra `apiAxios` (`src/shared/api/api.ts`). Ese cliente usa
un **adaptador de axios** que se elige por variable de entorno:

```env
VITE_PUBLIC_USE_MOCKS=true    # datos en memoria
VITE_PUBLIC_USE_MOCKS=false   # backend real
```

Con `false`, axios pega a `VITE_PUBLIC_URL_API + VITE_PUBLIC_URL_VERSION` y el
código de mock queda fuera del bundle. **Ningún archivo de `features/` cambia.**

Pasos de integración:

1. `VITE_PUBLIC_URL_API=https://api-real` y `VITE_PUBLIC_USE_MOCKS=false`.
2. Verificar que el backend responda el contrato de abajo.
3. Borrar `src/shared/api/mock/` cuando ya no se necesite el modo demo.

## Contrato que el backend debe cumplir

Base: `{VITE_PUBLIC_URL_API}{VITE_PUBLIC_URL_VERSION}`

Todo el trabajo del sistema es un **ticket**. No hay endpoints por tipo de
documento: una operación aérea, un gasto y un reporte técnico son el mismo
recurso con distinto `type_code`.

| Método | Ruta | Devuelve |
|---|---|---|
| POST | `/auth/login/` | `{ token, refresh_token?, user, permissions }` |
| GET | `/auth/me/` | `{ user, permissions }` — revalida sesión |
| GET | `/ticket-types/?is_active&is_root` | `TicketType[]` |
| POST | `/ticket-types/` | `TicketType` (201) |
| PATCH | `/ticket-types/{id}/` | `TicketType` |
| DELETE | `/ticket-types/{id}/` | 204 |
| GET | `/tickets/?q&type_code&status_code&parent_id&assigned_role_id&is_root&open&from&to&aircraft&page&limit` | paginado de `Ticket` |
| GET | `/tickets/totals/` | `ExpenseTotals` — mismos filtros que el listado |
| GET | `/tickets/{id}/` | `Ticket` |
| POST | `/tickets/` | `Ticket` (201) |
| PATCH | `/tickets/{id}/` | `Ticket` |
| POST | `/tickets/{id}/decisions/` | `Ticket` |
| GET | `/audit/?entity&entity_id&action&actor_id&from&to&search&page&limit` | paginado de `AuditEvent` |
| GET | `/notifications/?page&limit` | paginado de `AppNotification` |
| PATCH | `/notifications/{id}/` | `AppNotification` |
| GET | `/modules/` | `Module[]` |
| PATCH | `/modules/{id}/` | `Module` |
| GET | `/permissions/` | `Permission[]` — catálogo cerrado, solo lectura |
| GET | `/roles/?q&page&limit` | paginado de `Role` |
| POST | `/roles/` | `Role` (201) |
| PATCH | `/roles/{id}/` | `Role` |
| DELETE | `/roles/{id}/` | 204 |
| GET | `/users/?q&page&limit` | paginado de `AppUser` |
| POST | `/users/` | `AppUser` (201) |
| PATCH | `/users/{id}/` | `AppUser` |
| GET | `/catalogs/` | `CatalogDefinition[]` |
| GET | `/catalog-items/?catalog&is_active&page&limit` | paginado de `CatalogItem` |
| POST | `/catalog-items/` | `CatalogItem` (201) |
| PATCH | `/catalog-items/{id}/` | `CatalogItem` |
| DELETE | `/catalog-items/{id}/` | 204 |

`/audit/` **no tiene escritura**: los eventos los asienta el backend al escribir.
Los permisos son un catálogo cerrado: no hay `POST /permissions/`.

El detalle de dinero, totales y auditoría está en
`../backend-contract/API_CONTRACT.md` §10 y §11.

**Envoltura de paginación** (todo listado):

```json
{
  "data": [],
  "total": 42,
  "page": 1,
  "limit": 10,
  "links": { "next": "?page=2", "previous": null }
}
```

**Errores.** El front espera `title` y `detail`; en 422, además `errors` por campo:

```json
{
  "title": "Datos inválidos",
  "detail": "El monto debe ser mayor que cero.",
  "errors": { "amount": "Debe ser mayor que cero" }
}
```

`detail` se muestra tal cual al usuario en 422. `errors` se inyecta campo por
campo en el formulario vía `applyServerErrors`.

**Autenticación.** `Authorization: Bearer <token>` en cada request, más
`Accept-Language: es-ES | en-US`. En 401 el interceptor cierra sesión y redirige
a `/login` sin que ningún componente lo maneje.

**Permisos.** `POST /auth/login/` devuelve `permissions: string[]` con los códigos
del rol. `GET /auth/me/` los devuelve otra vez y la app lo llama al montar: los
permisos guardados son solo caché, el servidor manda. Si el rol cambia, la
sesión activa se corrige al recargar sin necesidad de cerrar sesión.

**El backend debe validar los permisos igual que el front.** Lo del front es
experiencia de usuario: oculta lo que no corresponde. La autorización real vive
en el backend, que debe rechazar con 403 cualquier acción sin permiso.

Los tipos exactos están en `src/features/*/types/*.types.ts`. Sirven como
especificación para el backend.

## Estructura

```
src/
  app/          bootstrap: providers, rutas, main
  shared/       librería interna reutilizable
    api/        client axios, apiAxios, handlers, tipos, mock/
    components/ ui/ · form/ · feedback/ · pagination/ · layout/
    hooks/      useT, useApi, usePagination, useAuth, useTheme, useDebounce, useMediaQuery
    store/      slices auth, theme, lang, ui
    i18n/       es.json · en.json
  features/
    auth/          login, revalidación de sesión y guards por permiso
    tickets/       el núcleo: listado, expediente, formularios dinámicos,
                   constructor de tipos, pasos, totales y analítica
    audit/         bitácora de auditoría: línea de tiempo y consulta global
    notifications/ avisos por rol
    users/         alta, edición y excepciones de permiso por usuario
    roles/         roles dinámicos y árbol de permisos por módulo
    catalogs/      catálogos administrables que alimentan los formularios
```

Reglas aplicadas: un solo punto de entrada HTTP, `ApiResult<T>` en todo servicio,
errores centralizados en `notify`, formularios con RHF + Zod, listados con
`usePagination` + `PaginatedComplete`, cero texto quemado en JSX, persistencia
solo de `auth`/`theme`/`lang`, sin imports cruzados entre features, ningún
archivo sobre 300 líneas.

## Permisología

Modelo heredado del patrón ya usado en otros proyectos:
`Module` → `Permission (module.accion)` → `Role` (N permisos) → `User` (un rol).

Los roles se crean desde la aplicación y el superusuario decide qué permisos
lleva cada uno. Un usuario tiene **un** rol, más excepciones propias:
`efectivos = permisos del rol ∪ concedidos − revocados`.

El catálogo de permisos es **cerrado**: se define en código, no lo crea el
usuario. Un permiso inventado desde la interfaz no haría nada, porque ningún
código lo consulta. Códigos en `src/shared/auth/permissions.ts`:

```
tickets.view / create / edit / decide_any
ticket_types.manage
notifications.view
users.view / manage
roles.view / manage
catalogs.view / manage
analytics.view
audit.view / export
```

Además hay **permisos derivados por tipo de ticket**: `tickets.view.expense`,
`tickets.edit.technical_report`, etc. Se otorgan cuando un rol solo debe tocar
cierto trabajo. `canScoped('tickets.view')` da verdadero si el rol tiene el
permiso general **o** cualquiera de sus derivados.

Cómo se aplica en el código:

- **Rutas:** `<RequirePermission permission="...">` en `app/routes.tsx`.
- **Acciones:** `<Can permission="...">` envuelve botones de alta, cierre y borrado.
- **Menú:** lo gobiernan los módulos (`useMenu()`), cada uno con su ruta, icono
  y permiso; el superusuario decide qué aparece sin tocar código.
- **Lógica:** `useCan()` expone `can`, `canAny`, `canAll`, `canScoped`.
- **Por tipo:** `useTypeAccess().canForType('edit', 'expense')`.
- **Por campo:** cada campo puede declarar `view_permission` y `edit_permission`.

El rol `Superusuario` es de sistema: no se puede eliminar ni editar sus permisos.

## Dinero y auditoría

Dos piezas que conviene entender antes de tocar el código:

**El campo declara qué significa, no cómo se llama.** `FieldDef.role`
(`amount`, `currency`, `quantity`, `unit`, `item`, `accounting_date`) es lo que
permite totalizar un `payload` dinámico. Sumar por nombre de clave se rompería
en silencio con el primer tipo que use otra nomenclatura.

**La tasa se congela al registrar** (`ticket.money`) y nunca se recalcula al
leer. Sin tasa disponible, un importe en moneda distinta de la base devuelve
422 en vez de convertirse con `1`.

**La bitácora es append-only y un solo modelo** para tickets, usuarios, roles,
catálogos y accesos. El actor sale del token; nombre, rol y etiqueta se guardan
congelados, para que renombrar a alguien no reescriba la historia.

Detalle completo en `../backend-contract/API_CONTRACT.md` §10 y §11.

## Catálogos

Catálogos administrables desde la aplicación: conceptos de gasto,
unidades, monedas, tipos de operación, alcances, estados de aeronave,
aeronaves, aeropuertos y sedes.

Los formularios los consumen con `useCatalogOptions(clave)`, así que agregar un
concepto de gasto nuevo no requiere desarrollo. Los registros marcados como
del sistema no pueden eliminarse ni desactivarse porque el flujo depende de
ellos (por ejemplo, la radioayuda que bloquea el despacho).

## Reglas de negocio implementadas

- **Numeración** `matrícula-correlativo-año` (`YV2323-004-26`), correlativo por
  aeronave.
- **Radioayuda del INAC bloquea el cierre** mientras no tenga comprobante
  cargado. El backend debe replicar esa validación: el front la muestra, no la
  garantiza.
- **Cierre con firma electrónica.** Tras firmar, la operación queda inmutable.
- **Autorización de taller externo** corresponde solo a la dirección ejecutiva;
  el formulario de mantenimiento lo advierte al marcar que requiere taller.
- **Solo gastos.** No hay ingresos, tarifas ni márgenes, según el alcance
  acordado el 19-08-2026.

## Verificado

- `npm run typecheck` en verde, `npm run build` en verde.
- Flujo operativo probado en navegador: login → listado → detalle → intento de
  cierre bloqueado por radioayuda (422 con el mensaje del servidor) → cierre
  exitoso de otra operación → validación Zod en gastos → cambio de idioma y de
  tema → layout móvil y escritorio.
- Permisología probada de extremo a extremo: el superusuario creó el rol
  "Auditor de Calidad" con tres permisos de lectura, se lo asignó a un usuario
  nuevo, y al entrar con ese usuario el menú quedó reducido a sus tres módulos,
  el botón de nueva operación desapareció y las rutas prohibidas rebotaron.
- Revalidación probada: se manipularon a mano los permisos guardados en
  `localStorage` y al recargar el servidor los corrigió.

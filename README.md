# mtw-frontend

Panel interno de cotizaciones de MTW: lista y detalle de proyectos, gestión de
clientes y armado de presupuestos (cotizador). SPA en React que consume la API
de [`mtw-relay-api`](https://github.com/MTW-Chile/mtw-relay-api) — no habla
nunca directo con HETMO ni con la base de datos.

## Arquitectura

```
Navegador (este repo)
       │  HTTPS + Authorization
       ▼
mtw-relay-api  (Node/Express/Prisma/Postgres)
       │  server-to-server, vía Cloudflare Tunnel
       ▼
mtw-apiv2  (.NET, agente on-prem, solo lectura sobre SQL Server HETMO)
```

`mtw-frontend` solo conoce a `mtw-relay-api`. Toda la lógica de negocio,
autenticación y acceso a datos vive en el relay.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- TanStack Query (React Query) para el estado de datos remotos
- Axios como cliente HTTP (`src/api/client.ts`)

## Desarrollo local

```bash
npm install
npm run dev       # http://localhost:5173
```

Variables de entorno (`.env`, ver `.env.example`):

- `VITE_API_URL`: URL base de `mtw-relay-api` (por defecto `/api`).

## Scripts

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Vite) |
| `npm run build` | Typecheck (`tsc -b`) + build de producción |
| `npm run lint` | Lint con oxlint |
| `npm run preview` | Sirve el build de producción localmente |

## Estructura

```
src/
  api/          cliente HTTP hacia mtw-relay-api
  components/   componentes de layout compartidos (Sidebar, Header)
  modules/      módulos de dominio (hoy: cotizaciones)
  types/        tipos compartidos del dominio
  lib/          utilidades
```

## Despliegue

Se construye como imagen Docker (Nginx sirviendo el build estático) y se
despliega en Railway — ver `Dockerfile`, `entrypoint.sh` y `railway.json`.

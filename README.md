# RepairOS

Sistema de gestión para talleres de reparación de electrónica: clientes, equipos,
órdenes con checklist y firma del cliente, presupuestos, entregas con cobro, cuenta
corriente, caja y autorizaciones. Multi-taller (SaaS) y multi-sucursal.

## Estructura

```
proyectoRepairOs/
├── backend/    API REST — Node.js, Express 5, TypeScript, Sequelize, MySQL
├── frontend/   PWA — React 18, Vite, TypeScript, React-Bootstrap (privada, noindex)
└── landing/    Sitio público estático + páginas legales (lo único indexable)
```

### Backend (`backend/src`)

```
config/          env.ts (variables validadas con zod al arrancar), database.ts
models/          Modelos de Sequelize y sus asociaciones (models/index.ts)
modules/<dominio>/
  *.routes.ts       rutas y middlewares de acceso
  *.controller.ts   lee el request, llama al servicio, arma la respuesta
  *.schemas.ts      validación de entrada (zod)
  *.service.ts      reglas de negocio y transacciones
shared/          http (errores, contexto del request), middlewares, security, utils, validation
integrations/    storage (local / S3), email (Resend), whatsapp (stub)
database/        migrations, seeders, demo, scripts (init-db, reset-demo, rotate-encryption-key)
```

Módulos: `auth`, `usuarios`, `sucursales`, `clientes`, `equipos`, `ordenes`, `cuentas`,
`solicitudes`, `reportes`, `configuracion`, `suscripciones`, `notificaciones`.

### Frontend (`frontend/src`)

```
app/             App (rutas), Layout y guardas de ruta
features/<dominio>/
  api.ts            llamadas a la API de ese dominio
  pages/            pantallas
  components/       componentes propios del dominio
shared/          cliente HTTP, componentes, hooks (useConsulta, useAccion, useBusqueda), tipos y utilidades
```

Los imports usan el alias `@/` (`@/shared/...`, `@/features/...`).

## Puesta en marcha

Requisitos: Node.js 20.9+ (ver `.nvmrc`) y MySQL 8.

```bash
# Backend
cd backend
cp .env.example .env      # completar DB_*, JWT_SECRET y ENCRYPTION_KEY
npm install
npm run db:init:seed      # crea la base, corre migraciones y carga datos de ejemplo
npm run dev               # http://localhost:4000

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

Desde la raíz: `npm run check` corre typecheck, lint y tests de las dos apps.

Generar claves:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"        # ENCRYPTION_KEY
```

El seeder crea el usuario `admin@repairos.local` / `Admin123!` y el taller de demo
pública (`demo@repairos.ar` / `demo123`). **No correr `db:seed` en producción**, o
cambiar esas contraseñas apenas se crea la base.

## Scripts

| Backend | |
|---|---|
| `dev` / `build` / `start` | desarrollo, compilación, producción |
| `check` | typecheck + lint + tests |
| `test` | tests unitarios (Vitest) |
| `db:init` / `db:init:seed` | crea la base y aplica migraciones (y seed) |
| `db:migrate` / `db:migrate:undo` | migraciones |
| `demo:reset` | rehace el taller de demo (pensado para un cron) |
| `keys:rotate` | re-cifra los datos al cambiar `ENCRYPTION_KEY` |

| Frontend | |
|---|---|
| `dev` / `build` / `preview` | desarrollo, build de producción, servir el build |
| `check` | typecheck + lint + tests |

## Decisiones de arquitectura

- **Multi-tenencia por taller.** `users`, `sucursales`, `clientes`, `equipos` y `ordenes`
  llevan `taller_id` y toda consulta lo filtra. El taller sale de la base en cada request
  (`authenticate`, con 30 s de caché), no del token. Un id de otro taller responde 404.
- **Login en dos pasos.** Primero el usuario, después la sucursal: el segundo token lleva
  `sucursalId` y las rutas de órdenes, cuentas y configuración lo exigen.
- **Numeración por taller.** `ORD-000001` arranca de nuevo en cada taller (índice único
  `taller_id + numero_orden`); el número se reserva con `SELECT … FOR UPDATE`.
- **Máquina de estados de la orden** en `modules/ordenes/estado-orden.ts` (copia en el
  frontend). Un admin puede forzar una transición dejando el motivo.
- **Entregar es un endpoint propio** (`POST /ordenes/:id/entrega`): cambia el estado y
  asienta lo facturado y lo cobrado en una transacción, con la orden y el cliente
  bloqueados para que dos clics no cobren dos veces.
- **Cuenta corriente como libro de movimientos.** El saldo es la suma de
  `cuenta_movimientos` (`cargo`, `pago`, `ajuste_debito`, `ajuste_credito`), nunca una
  columna guardada. La caja solo suma `pago`.
- **Fiar y ajustar saldos requieren autorización.** El mostrador pide, un admin aprueba;
  aprobar ejecuta la entrega o el ajuste en la misma transacción.
- **Datos sensibles cifrados** (AES-256-GCM): credenciales de equipos y firma del cliente.
  Revelarlas queda auditado en `accesos_sensibles`.
- **Fechas en la zona del negocio.** `APP_TIMEZONE` define qué es "hoy" en la caja y la
  hora impresa en el remito; la base guarda UTC.
- **Proveedores intercambiables** para almacenamiento, email y WhatsApp.

## Producción

- `STORAGE_DRIVER=s3` para no perder imágenes al redeployar.
- `JWT_SECRET` y `ENCRYPTION_KEY` propios de producción; `CORS_ALLOWED_ORIGINS` con el
  dominio del frontend; `RESEND_API_KEY` para enviar emails.
- Para cambiar `ENCRYPTION_KEY` con datos cargados (hacer backup antes):
  `OLD_ENCRYPTION_KEY=<actual> NEW_ENCRYPTION_KEY=<nueva> npm run keys:rotate` y recién
  después reemplazar la clave en el `.env`.

## Landing y documentos legales

`landing/` es HTML estático (sin build): se sube tal cual a Netlify, Vercel o Cloudflare
Pages. Los precios figuran en las tarjetas y en el JSON-LD del final de `index.html`:
si cambian, hay que actualizar los dos (Google muestra el del JSON-LD).

Las páginas `terminos.html`, `privacidad.html` y `tratamiento-de-datos.html` son
borradores: falta completar los datos entre corchetes, la revisión de un abogado, la
inscripción de la base en la AAIP y registrar la aceptación de los términos al registrarse.
El texto de consentimiento que firma el cliente del taller está en
`backend/src/modules/ordenes/orden-pdf.service.ts`.

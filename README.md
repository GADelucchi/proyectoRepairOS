# RepairOS

Sistema de gestión para talleres de reparación (celulares, computadoras, tablets y electrónica en general). Permite administrar clientes, equipos, recepción de órdenes de reparación con checklist personalizable, firma del cliente, presupuestos, seguimiento de estado y generación de remitos en PDF, con soporte multi-sucursal y control de acceso por rol/técnico.

## Estructura del proyecto

```
proyectoRepairOs/
├── backend/   # API REST (Node.js + Express + TypeScript + Sequelize + MySQL)
├── frontend/  # PWA (React + Vite + TypeScript + React-Bootstrap) — privada, noindex
├── landing/   # Sitio público de marketing (HTML estático) — lo único indexable
└── docs/      # Material de marca (paleta de color)
```

El frontend es una **PWA instalable**: desde la tablet del mostrador se agrega a la
pantalla de inicio y abre sin barra del navegador. El service worker cachea la
aplicación (no los datos de la API, que siempre se piden a la red).

## Requisitos previos

- Node.js 20.9 o superior (Express 5 y las herramientas de lint lo exigen)
- MySQL 8 (o compatible) corriendo localmente o accesible por red
- npm

## 1. Backend

```bash
cd backend
cp .env.example .env
```

Editar `.env` y completar:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: credenciales de la base MySQL. No hace falta crear la base a mano: el script `db:init` la crea automáticamente si no existe.
- `JWT_SECRET`: una cadena secreta larga y aleatoria.
- `ENCRYPTION_KEY`: clave de 64 caracteres hexadecimales (32 bytes) usada para cifrar datos sensibles del equipo (clave de desbloqueo, credenciales de cuenta). Generarla con:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `STORAGE_DRIVER`: `local` para guardar imágenes en disco (`uploads/`) o `s3` para usar un bucket S3/compatible (completar las variables `S3_*`).
- `RESEND_API_KEY` y `EMAIL_FROM`: opcional, para el envío de emails transaccionales vía [Resend](https://resend.com).
- `WHATSAPP_PROVIDER`: queda en `none` por defecto; la integración real está preparada para conectarse a futuro sin cambiar el resto del código.
- `CORS_ALLOWED_ORIGINS`: orígenes permitidos separados por coma (en desarrollo, `http://localhost:5173`).

Instalar dependencias y crear la base de datos (crea la base si no existe, ejecuta todas las migraciones y carga los datos iniciales):

```bash
npm install
npm run db:init:seed
npm run dev
```

El servidor queda escuchando en `http://localhost:4000`.

> `db:init:seed` = crear/verificar la base + correr migraciones + seed en un solo paso. Si solo necesitás crear la base y las tablas sin los datos de ejemplo, usá `npm run db:init`. Estos scripts se pueden volver a correr sin problema: la creación de la base usa `CREATE DATABASE IF NOT EXISTS` y las migraciones son idempotentes (Sequelize lleva registro de cuáles ya se aplicaron).

### Usuario administrador inicial

El seeder crea un taller de demostración con su administrador y una sucursal:

- **Taller:** "Taller Demo"
- **Email:** `admin@repairos.local`
- **Contraseña:** `Admin123!`
- **Sucursal:** "Sucursal Central"

> **Cambiá esta contraseña en el primer ingreso.** Es pública en este README, así que
> cualquiera que llegue al login la conoce.

El seeder es idempotente: se puede volver a correr sin duplicar el admin ni la sucursal.

### Política de contraseñas

Mínimo 8 caracteres, con al menos una mayúscula, una minúscula y un número. Se valida
tanto en el formulario como en la API (`src/validators/usuarioValidators.ts`), así que
también aplica a cualquier cliente que pegue contra el backend directamente.

## 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173` y consume la API definida en `VITE_API_BASE_URL` (por defecto `http://localhost:4000/api`).

## Flujo de uso

1. **Registro** (`/registro`): quien contrata el servicio crea su taller y queda como
   administrador. El alta genera el taller, su usuario y una suscripción en período de
   prueba con un mes de gracia, y devuelve la sesión ya iniciada. Desde la selección de
   sucursal crea la primera sucursal y, con ella, da de alta a sus técnicos.
2. **Login**: el técnico/administrador inicia sesión con email y contraseña.
3. **Selección de sucursal**: inmediatamente después del login, se elige la sucursal desde la que se va a trabajar (según los permisos otorgados).
4. **Clientes / Equipos**: alta y búsqueda de clientes y equipos, con datos sensibles (clave de desbloqueo, credenciales de cuenta) cifrados en la base y ocultos por defecto (`••••••••`), revelables bajo demanda.
5. **Recepción de orden**: se busca o crea el cliente y el equipo, se cargan detalles estéticos, imágenes, un checklist de diagnóstico definido por el técnico, descripción del problema, notas internas y fecha pactada.
6. **Gestión de la orden**: desde el detalle se agrega presupuesto (con aprobación/rechazo del cliente), firma del cliente, cambios de estado (con historial) y se descarga el remito en PDF.
7. **Entrega y cobro**: al entregar el equipo se confirma el total y cuánto abona el cliente. Si
   tiene saldo a favor se descuenta solo, y lo que quede sin cubrir va a su cuenta corriente, que
   solo puede tener deuda si un administrador se la habilitó.
8. **Cuenta corriente** (`/cuentas`): listado de quién debe y cuánto, con el historial de cada
   cuenta y el registro de cobros, que descuentan el saldo. Un saldo negativo es plata a favor
   del cliente.
9. **Autorizaciones** (`/autorizaciones`): cuando el mostrador necesita fiarle a un cliente sin
   cuenta habilitada, o corregir un saldo, deja el pedido con su motivo y un administrador lo
   aprueba o lo rechaza. El menú avisa cuántos hay esperando.
10. **Caja** (`/caja`): cuánto entró en un período, abierto por medio de pago, usuario y
    sucursal, con el detalle de cada cobro.
11. **Administración** (solo rol `admin`): gestión de usuarios/técnicos (rol, contraseña, activación) y de sucursales (datos y permisos de acceso por técnico).

## Arquitectura y decisiones técnicas

- **Stack**: Express 5 en el backend y React Router 7 en el frontend. La rama 4 de Express
  arrastraba CVEs en `qs`/`body-parser` sin parche disponible.
- **Identificadores de ruta validados**: `utils/requestParams.ts` normaliza `req.params`
  (que en Express 5 puede ser `string | string[]`) y rechaza con 400 lo que no sea un
  entero positivo, antes de que llegue a la base.
- **Un taller por cuenta (multi-tenencia)**: `talleres` es el inquilino del sistema.
  `users`, `sucursales`, `clientes` y `equipos` llevan `taller_id` y toda consulta lo
  filtra; el resto de las tablas no lo necesita porque siempre se llega por un padre ya
  filtrado (las órdenes por `sucursal_id`, los chequeos por `orden_id`). Pedir por id un
  registro de otro taller devuelve 404, no 403: un id ajeno tiene que ser indistinguible
  de uno inexistente.
- **El taller sale de la base, no del token**: `authenticate` relee rol y taller del
  usuario en cada request (con 30 s de caché), igual que ya hacía con el rol, así un token
  viejo no puede pedir datos de un taller al que su usuario ya no pertenece.
- **Numeración y números de serie por taller**: el contador de órdenes usa la clave
  `orden:<tallerId>`, y `numero_serie` es único por `(taller_id, numero_serie)` en vez de
  serlo en toda la base — antes un taller no podía cargar un serial que otro ya tenía, y
  el choque se lo revelaba.
- **Suscripción por taller**: `planes` replica los planes del sitio público y
  `suscripciones` guarda el estado y la fecha de fin de gracia. El alta arranca en
  `prueba` sin plan elegido; el cobro todavía no está conectado.
- **La cuenta corriente es un libro de movimientos, no un saldo guardado**: el saldo sale de
  sumar `cuenta_movimientos` (`cargo` suma deuda, `pago` la descuenta, siempre con monto
  positivo). Un total acumulado en una columna se desincroniza en cuanto un cobro se cae a
  mitad de camino, y este número tiene que poder mostrarse asiento por asiento cuando el
  cliente lo discute.
- **Entregar es un endpoint propio, no un cambio de estado más**: `POST /ordenes/:id/entrega`
  mueve el estado a `entregado`, guarda lo facturado y lo cobrado, y asienta los movimientos en
  una sola transacción. `PUT /ordenes/:id/estado` rechaza `entregado` a propósito: por ahí se
  entregaba el equipo sin registrar un peso.
- **Fiar es una decisión del dueño**: un cliente solo puede quedar debiendo si tiene
  `cuenta_corriente_habilitada`, y ese campo solo lo cambia un `admin`. Registrar cobros, en
  cambio, lo hace cualquier técnico: la plata entra por el mostrador.
- **Negar sin dar salida no sirve**: el cliente está parado en el local esperando, así que un
  rechazo por falta de cuenta corriente viaja con `requiereAutorizacion` y la pantalla ofrece
  pedirle permiso a un supervisor. Sin eso, el mostrador lo resuelve por teléfono y no queda
  registrado quién autorizó qué. Lo mismo para los ajustes de saldo: cualquiera los pide, solo
  un `admin` los aprueba. Cuando quien pide ya es `admin` se ejecuta en el acto, pero la
  solicitud queda igual asentada: es el registro del responsable.
- **Aprobar ejecuta**: aprobar un fiado entrega el equipo y aprobar un ajuste asienta el
  movimiento, en la misma operación. Aprobar sin ejecutar dejaría al mostrador esperando un
  segundo paso que nadie le avisa que tiene que dar. Por eso la entrega vive en
  `services/entregaOrden`: hay dos puertas que llegan ahí —el mostrador y la aprobación— y las
  dos tienen que registrar exactamente lo mismo.
- **El saldo a favor se aplica solo, y no genera asientos**: el crédito ya vive en el libro como
  saldo negativo, así que el cargo de la entrega lo consume sin movimientos extra —anotar un
  "pago" con plata que no entró inflaría la caja—. Lo que sí se guarda es `credito_aplicado` en
  la orden: sin ese dato, la pantalla y el remito dirían que el cliente quedó debiendo una
  diferencia que su propio saldo ya cubría.
- **El control mira la deuda que crea la entrega, no la resta del total**: con `total - abonado`
  a secas, un cliente con plata a favor quedaba bloqueado aunque su crédito cubriera todo, y un
  cliente que ya debía no podía retirar ni pagando completo. Lo que se exige es que *esta*
  operación no aumente lo que debe.
- **Un ajuste no es plata**: `ajuste_debito` y `ajuste_credito` corrigen el saldo sin que haya
  entrado ni salido nada, y por eso son tipos propios de movimiento. La caja suma solo los
  `pago`: si contara los ajustes, el total no coincidiría con lo que hay en el cajón, que es
  exactamente para lo que se usa ese número.
- **Autenticación en dos pasos**: primer token al hacer login, segundo token al confirmar la sucursal seleccionada; las rutas del backend validan sucursal activa mediante middleware.
- **Cifrado de datos sensibles**: AES-256-GCM sobre los campos de credenciales del equipo, con máscara por defecto y parámetro explícito `?reveal=true` para descifrar.
- **Almacenamiento de imágenes desacoplado**: interfaz `StorageProvider` con implementaciones local y S3, seleccionable por variable de entorno sin cambiar código de negocio.
- **Email desacoplado**: interfaz `EmailProvider` con implementación basada en Resend.
- **WhatsApp preparado a futuro**: interfaz `WhatsAppProvider` con stub `NoneWhatsAppProvider`, lista para conectar un proveedor real sin modificar el resto del sistema.
- **Tipos de equipo por sucursal**: el catálogo de tipos y sus checklists pertenece a la
  sucursal, no al técnico que los creó, para que todo el equipo vea los mismos nombres.
- **Clientes y equipos globales del taller**: se atienden desde cualquier sucursal (un
  cliente puede dejar el equipo en un local y retirarlo en otro). Lo que sí se controla es
  el descifrado de credenciales: cada uso de `?reveal=true` queda auditado en
  `accesos_sensibles`.
- **Numeración de órdenes con contador bloqueado**: el número sale de la tabla `contadores`
  con `SELECT ... FOR UPDATE` dentro de la transacción que crea la orden, así dos altas
  simultáneas se serializan en vez de colisionar.
- **Acceso por sucursal en un solo lugar**: `services/sucursalAccess.ts` define quién entra
  a qué sucursal; `/auth/me` y `seleccionarSucursal` lo consultan en vez de repetir la regla.
- **Revocación efectiva de privilegios**: `authenticate` valida el rol y el estado del
  usuario contra la base (con 30 s de caché), no contra el token.
- **Estado de la orden**: máquina de estados real, definida en
  `backend/src/models/estadoOrden.ts` y replicada en `frontend/src/types/index.ts`. El
  backend rechaza las transiciones inválidas y el desplegable solo ofrece las posibles;
  un admin puede forzar una transición fuera del circuito indicando el motivo, que queda
  marcado como `[Forzado]` en el historial.
- **Chequeos con opciones propias**: cada tipo de equipo define sus opciones de respuesta
  ("Sí / No / Sin revisar", "Excelente / Regular / Malo", las que sirvan). Al recibir el
  equipo esas opciones se copian a la orden y quedan congeladas, así una orden vieja sigue
  mostrando con qué alternativas se la respondió aunque después se edite el checklist.
- **Notificaciones honestas**: el aviso al cliente informa qué pasó realmente (enviado, sin
  email cargado, proveedor no configurado o error) en vez de afirmar siempre que se notificó.

## Scripts útiles

| Backend                   | Descripción                                    |
|---------------------------|-----------------------------------------------|
| `npm run dev`             | Levanta el servidor en modo desarrollo         |
| `npm run build` / `start` | Compila y ejecuta en producción                |
| `npm run db:init`         | Crea la base de datos (si no existe) y aplica las migraciones |
| `npm run db:init:seed`    | Igual a `db:init` + carga los datos iniciales (admin + sucursal) |
| `npm run db:migrate`      | Aplica migraciones de base de datos            |
| `npm run db:seed`         | Carga datos iniciales (admin + sucursal)       |
| `npm run keys:rotate`     | Re-cifra los datos sensibles al cambiar `ENCRYPTION_KEY` |
| `npm run typecheck`       | Verifica tipos con TypeScript                  |
| `npm run lint`            | ESLint (`lint:fix` para autocorregir)          |
| `npm run format`          | Prettier (`format:check` para solo verificar)  |

| Frontend        | Descripción                          |
|------------------|----------------------------------------|
| `npm run dev`   | Levanta la SPA en modo desarrollo      |
| `npm run build` | Compila TypeScript y genera build de producción |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run typecheck` | Verifica tipos con TypeScript      |
| `npm run lint`  | ESLint (`lint:fix` para autocorregir)  |
| `npm run format` | Prettier (`format:check` para solo verificar) |

## Producción

- Configurar `VITE_API_BASE_URL` (frontend) y `CORS_ALLOWED_ORIGINS` / `FRONTEND_URL` (backend) apuntando a los dominios finales.
- Usar `STORAGE_DRIVER=s3` con un bucket real para persistir imágenes fuera del disco del servidor.
- Definir un `JWT_SECRET` y `ENCRYPTION_KEY` únicos y seguros, distintos a los de desarrollo.
- Configurar `RESEND_API_KEY` para habilitar el envío de emails.

### Rotar la clave de cifrado

`ENCRYPTION_KEY` no se puede cambiar sin más: los datos ya guardados quedarían
irrecuperables. El procedimiento es:

```bash
# 1. Generar la clave nueva
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Re-cifrar lo que ya está en la base (hacé un backup antes)
OLD_ENCRYPTION_KEY=<la actual> NEW_ENCRYPTION_KEY=<la nueva> npm run keys:rotate

# 3. Recién ahora, reemplazar ENCRYPTION_KEY en el .env por la nueva
```

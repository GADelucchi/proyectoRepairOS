import { Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes';
import { clientesRoutes } from './modules/clientes/clientes.routes';
import { configuracionRoutes } from './modules/configuracion/configuracion.routes';
import { cuentasRoutes } from './modules/cuentas/cuentas.routes';
import { equiposRoutes } from './modules/equipos/equipos.routes';
import { notificacionesRoutes } from './modules/notificaciones/notificaciones.routes';
import { ordenesRoutes } from './modules/ordenes/ordenes.routes';
import { plataformaRoutes } from './modules/plataforma/plataforma.routes';
import { planRoutes } from './modules/suscripciones/plan.routes';
import { portalRoutes } from './modules/portal/portal.routes';
import { seguimientoRoutes } from './modules/seguimiento/seguimiento.routes';
import { reportesRoutes } from './modules/reportes/reportes.routes';
import { solicitudesRoutes } from './modules/solicitudes/solicitudes.routes';
import { sucursalesRoutes } from './modules/sucursales/sucursales.routes';
import { usuariosRoutes } from './modules/usuarios/usuarios.routes';

/** Todas las rutas de la API, montadas bajo `/api`. */
export const apiRoutes = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/usuarios', usuariosRoutes);
apiRoutes.use('/sucursales', sucursalesRoutes);
apiRoutes.use('/clientes', clientesRoutes);
apiRoutes.use('/equipos', equiposRoutes);
apiRoutes.use('/ordenes', ordenesRoutes);
apiRoutes.use('/cuentas', cuentasRoutes);
apiRoutes.use('/solicitudes', solicitudesRoutes);
apiRoutes.use('/reportes', reportesRoutes);
apiRoutes.use('/configuracion', configuracionRoutes);
apiRoutes.use('/notificaciones', notificacionesRoutes);
apiRoutes.use('/plataforma', plataformaRoutes);
apiRoutes.use('/plan', planRoutes);
// Público, sin sesión: lo que ve el cliente con el link del remito.
apiRoutes.use('/seguimiento', seguimientoRoutes);
// Público: el cliente consulta sus datos y su cuenta con DNI + teléfono.
apiRoutes.use('/portal', portalRoutes);

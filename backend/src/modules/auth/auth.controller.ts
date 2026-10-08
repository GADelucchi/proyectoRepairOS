import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { sequelize, User, Sucursal, Taller, Suscripcion } from '../../models';
import { errores } from '../../shared/http/http-error';
import { usuarioDe } from '../../shared/http/request-context';
import { signToken } from '../../shared/security/jwt';
import { env } from '../../config/env';
import { esAdminDePlataforma, notificarAdminsDePlataforma } from '../plataforma/plataforma.service';
import { invalidarCacheUsuario } from '../../shared/middlewares/auth.middleware';
import { monedaDePais } from '../../shared/utils/paises';
import { excesoDelPlan, usoDelPlan } from '../suscripciones/limites.service';
import { codigoPublicoDe } from '../portal/portal.service';
import { generarCodigoPublico, urlDelPortal } from '../seguimiento/codigo';
import {
  errorDeBloqueo,
  finDeGracia,
  suscripcionDeTaller,
  tallerBloqueado
} from '../suscripciones/suscripcion.service';
import {
  puedeAccederASucursal,
  sucursalesDisponiblesPara,
  sucursalPublica
} from '../sucursales/sucursal-access.service';
import {
  loginSchema,
  pedirEmailSchema,
  registroSchema,
  restablecerSchema,
  seleccionarSucursalSchema,
  tokenSchema
} from './auth.schemas';
import { consumirToken, emailHabilitado, enviarRecuperacion, enviarVerificacion } from './tokens.service';

/** Costo de bcrypt. 10 es el estándar razonable para un login interactivo. */
export const BCRYPT_ROUNDS = 10;

function usuarioPublico(u: User) {
  return { id: u.id, nombre: u.nombre, apellido: u.apellido, email: u.email, rol: u.rol };
}

function tokenDeSesion(u: User, sucursalId?: number): string {
  return signToken({ userId: u.id, tallerId: u.tallerId, rol: u.rol, sucursalId });
}

/**
 * Alta de un taller nuevo: taller, usuario administrador y suscripción en
 * prueba, en una sola transacción (un taller sin usuario sería una cuenta
 * imposible de usar y de limpiar).
 *
 * Devuelve el token ya emitido: el dueño queda adentro sin repetir credenciales.
 * Con `EXIGIR_EMAIL_VERIFICADO` no: primero tiene que confirmar el email.
 * Un email repetido lo resuelve el índice único de la base (ver error-handler).
 */
export async function registrar(req: Request, res: Response): Promise<void> {
  const data = registroSchema.parse(req.body);

  if (await User.count({ where: { email: data.email } })) {
    throw errores.conflicto('Ya existe una cuenta con ese email');
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const { usuario, taller } = await sequelize.transaction(async (transaction) => {
    const taller = await Taller.create(
      { nombre: data.nombreTaller, pais: data.pais, codigoPublico: generarCodigoPublico() },
      { transaction }
    );
    const nuevo = await User.create(
      {
        tallerId: taller.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        passwordHash,
        rol: 'admin'
      },
      { transaction }
    );
    await Suscripcion.create(
      { tallerId: taller.id, estado: 'prueba', graciaHasta: finDeGracia() },
      { transaction }
    );
    return { usuario: nuevo, taller };
  });

  // Fuera de la transacción: el aviso no puede tumbar un alta que ya se confirmó.
  await notificarAdminsDePlataforma(
    {
      tipo: 'taller_nuevo',
      titulo: `Nuevo taller: ${taller.nombre}`,
      mensaje: `${usuario.nombre} ${usuario.apellido} (${usuario.email}) se registró y empezó la prueba gratuita.`,
      link: `/plataforma?taller=${taller.id}`
    },
    usuario.id
  );

  // Best-effort: si el email no sale, desde el login se puede pedir de nuevo.
  await enviarVerificacion(usuario).catch((err) => console.error('[email] verificación:', err));

  if (env.exigirEmailVerificado) {
    res.status(201).json({ verificacionPendiente: true, email: usuario.email });
    return;
  }

  res.status(201).json({
    token: tokenDeSesion(usuario),
    usuario: usuarioPublico(usuario),
    suscripcion: await suscripcionDeTaller(usuario.tallerId)
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ where: { email } });
  // Mismo mensaje para "no existe" y "contraseña incorrecta": no revela qué emails tienen cuenta.
  const passwordOk = user?.activo ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !passwordOk) throw errores.noAutenticado('Credenciales inválidas');

  // Con la suscripción vencida no entra nadie del taller, salvo quien administra la plataforma.
  const adminPlataforma = esAdminDePlataforma(user.email);
  if (!adminPlataforma && (await tallerBloqueado(user.tallerId))) {
    throw await errorDeBloqueo(user.tallerId);
  }
  if (env.exigirEmailVerificado && !user.emailVerificadoEn && !adminPlataforma) {
    throw errores.emailNoVerificado(user.email);
  }
  await user.update({ ultimoAccesoAt: new Date() });

  res.json({ token: tokenDeSesion(user), usuario: usuarioPublico(user) });
}

/** Segundo paso del login: emite un token nuevo con la sucursal elegida. */
export async function seleccionarSucursal(req: Request, res: Response): Promise<void> {
  const { sucursalId } = seleccionarSucursalSchema.parse(req.body);

  const user = await User.findByPk(usuarioDe(req).userId);
  if (!user?.activo) throw errores.noAutenticado('Cuenta no disponible');

  const sucursal = await Sucursal.findOne({
    where: { id: sucursalId, tallerId: user.tallerId, activo: true }
  });
  if (!sucursal) throw errores.noEncontrado('Sucursal');
  if (!(await puedeAccederASucursal(user, sucursalId))) {
    throw errores.sinPermiso('No tenés acceso a esta sucursal');
  }

  res.json({
    token: tokenDeSesion(user, sucursalId),
    sucursal: { id: sucursal.id, nombre: sucursal.nombre }
  });
}

/** Perfil de la sesión: usuario, taller, suscripción y sucursales disponibles. */
export async function me(req: Request, res: Response): Promise<void> {
  const auth = usuarioDe(req);
  const user = await User.findByPk(auth.userId, {
    include: [{ model: Taller, as: 'taller', attributes: ['id', 'nombre', 'pais', 'codigoPublico'] }]
  });
  if (!user) throw errores.noEncontrado('Usuario');

  const sucursales = await sucursalesDisponiblesPara(user);
  const { demoEmail } = env.plataforma;

  // Si la sucursal del token se desactivó o dejó de estar disponible, se limpia
  // para que la app pida elegir de nuevo.
  const sucursalActualId = sucursales.some((s) => s.id === auth.sucursalId) ? auth.sucursalId : null;

  res.json({
    ...usuarioPublico(user),
    taller: user.taller
      ? {
          id: user.taller.id,
          nombre: user.taller.nombre,
          pais: user.taller.pais,
          // Con la que arrancan las órdenes, los cobros y los ajustes.
          moneda: monedaDePais(user.taller.pais),
          // Link para que sus clientes consulten sus datos y su cuenta.
          portalClientes: urlDelPortal(await codigoPublicoDe(user.taller))
        }
      : null,
    suscripcion: await suscripcionDeTaller(user.tallerId),
    // Cuánto del plan está usando: las pantallas de Usuarios y Sucursales lo muestran.
    usoDelPlan: await usoDelPlan(user.tallerId),
    // Con el plan excedido la app solo muestra la pantalla para ajustarlo.
    excesoDelPlan: await excesoDelPlan(user.tallerId),
    esAdminPlataforma: esAdminDePlataforma(user.email),
    // Cualquier usuario del taller de demo (el admin o el técnico de ejemplo).
    esDemo:
      Boolean(demoEmail) && (await User.count({ where: { tallerId: user.tallerId, email: demoEmail } })) > 0,
    sucursalActualId,
    sucursales: sucursales.map(sucursalPublica)
  });
}

/**
 * Pide el link para recuperar la contraseña.
 *
 * Responde lo mismo exista o no la cuenta, para no revelar qué emails están
 * registrados. Sí avisa si el envío de emails está desactivado: en ese caso el
 * link no le va a llegar a nadie y la salida es pedirle al admin del taller
 * que le cambie la contraseña.
 */
export async function recuperarPassword(req: Request, res: Response): Promise<void> {
  const { email } = pedirEmailSchema.parse(req.body);
  const usuario = await User.findOne({ where: { email, activo: true } });
  if (usuario) await enviarRecuperacion(usuario).catch((err) => console.error('[email] recuperación:', err));
  res.json({ emailHabilitado: emailHabilitado() });
}

/** Elige la contraseña nueva con el link del email. Usarlo también confirma el email. */
export async function restablecerPassword(req: Request, res: Response): Promise<void> {
  const { token, password } = restablecerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const usuario = await sequelize.transaction(async (transaction) => {
    const u = await consumirToken('restablecer_password', token, transaction);
    await u.update({ passwordHash, emailVerificadoEn: u.emailVerificadoEn ?? new Date() }, { transaction });
    return u;
  });

  invalidarCacheUsuario(usuario.id);
  res.json({ email: usuario.email });
}

/** Confirma el email con el link que se mandó al registrarse. */
export async function verificarEmail(req: Request, res: Response): Promise<void> {
  const { token } = tokenSchema.parse(req.body);
  const usuario = await sequelize.transaction(async (transaction) => {
    const u = await consumirToken('verificar_email', token, transaction);
    if (!u.emailVerificadoEn) await u.update({ emailVerificadoEn: new Date() }, { transaction });
    return u;
  });
  res.json({ email: usuario.email });
}

/** Vuelve a mandar el email de verificación. Misma respuesta exista o no la cuenta. */
export async function reenviarVerificacion(req: Request, res: Response): Promise<void> {
  const { email } = pedirEmailSchema.parse(req.body);
  const usuario = await User.findOne({ where: { email, activo: true } });
  if (usuario && !usuario.emailVerificadoEn) {
    await enviarVerificacion(usuario).catch((err) => console.error('[email] verificación:', err));
  }
  res.json({ emailHabilitado: emailHabilitado() });
}

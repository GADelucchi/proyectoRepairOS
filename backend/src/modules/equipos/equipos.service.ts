import { ForeignKeyConstraintError, Op, WhereOptions } from 'sequelize';
import { z } from 'zod';
import { AccesoSensible, Cliente, Equipo, TipoEquipoPersonalizado } from '../../models';
import { EquipoAttributes } from '../../models/Equipo';
import { errores } from '../../shared/http/http-error';
import { MASCARA, decryptNullable, encryptNullable } from '../../shared/security/encryption';
import { exigirTipoDelTaller } from '../configuracion/tipos-equipo.service';
import { actualizarEquipoSchema, crearEquipoSchema, listarEquiposQuery } from './equipos.schemas';

interface CredencialesEnClaro {
  claveDesbloqueo?: string | null;
  cuentaUsuario?: string | null;
  cuentaPassword?: string | null;
}

/**
 * Credenciales cifradas listas para guardar. Solo incluye los campos que
 * vinieron: `undefined` significa "no tocar", `null` o "" significa "borrar".
 */
export function cifrarCredenciales(datos: CredencialesEnClaro) {
  const cifradas: Partial<Pick<Equipo, 'claveDesbloqueoEnc' | 'cuentaUsuarioEnc' | 'cuentaPasswordEnc'>> = {};
  if (datos.claveDesbloqueo !== undefined)
    cifradas.claveDesbloqueoEnc = encryptNullable(datos.claveDesbloqueo);
  if (datos.cuentaUsuario !== undefined) cifradas.cuentaUsuarioEnc = encryptNullable(datos.cuentaUsuario);
  if (datos.cuentaPassword !== undefined) cifradas.cuentaPasswordEnc = encryptNullable(datos.cuentaPassword);
  return cifradas;
}

/**
 * Equipo tal como sale por la API: sin las columnas cifradas y con las
 * credenciales enmascaradas, salvo que se pida revelarlas.
 */
export function serializarEquipo(equipo: Equipo, revelar: boolean) {
  const { claveDesbloqueoEnc, cuentaUsuarioEnc, cuentaPasswordEnc, ...resto } = equipo.get({ plain: true });
  const mostrar = (cifrado: string | null | undefined) =>
    cifrado ? (revelar ? decryptNullable(cifrado) : MASCARA) : null;

  return {
    ...resto,
    claveDesbloqueo: mostrar(claveDesbloqueoEnc),
    cuentaUsuario: mostrar(cuentaUsuarioEnc),
    cuentaPassword: mostrar(cuentaPasswordEnc)
  };
}

const LIMITE_LISTADO = 100;

const INCLUDES = [
  { model: Cliente, as: 'cliente', attributes: ['id', 'nombre', 'apellido'] },
  { model: TipoEquipoPersonalizado, as: 'tipoEquipo', attributes: ['id', 'nombre'] }
];

export async function equipoDelTaller(tallerId: number, id: number): Promise<Equipo> {
  const equipo = await Equipo.findOne({ where: { id, tallerId }, include: INCLUDES });
  if (!equipo) throw errores.noEncontrado('Equipo');
  return equipo;
}

async function exigirClienteDelTaller(clienteId: number, tallerId: number): Promise<void> {
  if (!(await Cliente.count({ where: { id: clienteId, tallerId } }))) throw errores.noEncontrado('Cliente');
}

export async function listarEquipos(
  tallerId: number,
  { search, clienteId, numeroSerie }: z.infer<typeof listarEquiposQuery>
) {
  const where: WhereOptions<EquipoAttributes> = {
    tallerId,
    ...(clienteId ? { clienteId } : {}),
    ...(numeroSerie ? { numeroSerie } : {}),
    ...(search
      ? {
          [Op.or]: ['numeroSerie', 'marca', 'modelo'].map((campo) => ({
            [campo]: { [Op.like]: `%${search}%` }
          }))
        }
      : {})
  };

  const equipos = await Equipo.findAll({
    where,
    include: INCLUDES,
    order: [['createdAt', 'DESC']],
    limit: LIMITE_LISTADO
  });
  return equipos.map((e) => serializarEquipo(e, false));
}

/** Deja registrado quién vio las credenciales de un equipo: es el dato que más duele si se filtra. */
export async function registrarAccesoSensible(acceso: {
  usuarioId: number;
  equipoId: number;
  sucursalId: number | null;
  ip: string | null;
}): Promise<void> {
  await AccesoSensible.create(acceso);
}

export async function crearEquipo(tallerId: number, data: z.infer<typeof crearEquipoSchema>) {
  const { claveDesbloqueo, cuentaUsuario, cuentaPassword, ...datos } = data;

  await exigirClienteDelTaller(datos.clienteId, tallerId);
  await exigirTipoDelTaller(datos.tipoEquipoPersonalizadoId, tallerId);

  const equipo = await Equipo.create({
    ...datos,
    tallerId,
    ...cifrarCredenciales({ claveDesbloqueo, cuentaUsuario, cuentaPassword })
  });
  // Con dueño y tipo: la pantalla ofrece imprimir la etiqueta QR del equipo recién creado.
  await equipo.reload({ include: INCLUDES });
  return serializarEquipo(equipo, false);
}

export async function actualizarEquipo(equipo: Equipo, data: z.infer<typeof actualizarEquipoSchema>) {
  const { claveDesbloqueo, cuentaUsuario, cuentaPassword, ...datos } = data;

  // El dueño y el tipo nuevos tienen que ser del mismo taller que el equipo.
  if (datos.clienteId !== undefined) await exigirClienteDelTaller(datos.clienteId, equipo.tallerId);
  if (datos.tipoEquipoPersonalizadoId !== undefined) {
    await exigirTipoDelTaller(datos.tipoEquipoPersonalizadoId, equipo.tallerId);
  }

  await equipo.update({
    ...datos,
    ...cifrarCredenciales({ claveDesbloqueo, cuentaUsuario, cuentaPassword })
  });
  await equipo.reload({ include: INCLUDES });
  return serializarEquipo(equipo, false);
}

export async function eliminarEquipo(equipo: Equipo): Promise<void> {
  try {
    await equipo.destroy();
  } catch (err) {
    if (err instanceof ForeignKeyConstraintError) {
      throw errores.conflicto('No se puede eliminar: el equipo tiene órdenes asociadas');
    }
    throw err;
  }
}

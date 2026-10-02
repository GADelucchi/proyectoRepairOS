import type { Equipo } from '@/shared/types';
import { textoONull } from '@/shared/utils/texto';

/** Datos de un equipo tal como se editan en el formulario. */
export interface EquipoFormData {
  tipoEquipoPersonalizadoId: number;
  marca: string;
  modelo: string;
  color: string;
  numeroSerie: string;
  claveDesbloqueo: string;
  cuentaUsuario: string;
  cuentaPassword: string;
}

export const EQUIPO_FORM_VACIO: EquipoFormData = {
  tipoEquipoPersonalizadoId: 0,
  marca: '',
  modelo: '',
  color: '',
  numeroSerie: '',
  claveDesbloqueo: '',
  cuentaUsuario: '',
  cuentaPassword: ''
};

/** Carga un equipo (con las credenciales ya reveladas) en el formulario. */
export function equipoAFormulario(equipo: Equipo): EquipoFormData {
  return {
    tipoEquipoPersonalizadoId: equipo.tipoEquipoPersonalizadoId,
    marca: equipo.marca ?? '',
    modelo: equipo.modelo ?? '',
    color: equipo.color ?? '',
    numeroSerie: equipo.numeroSerie ?? '',
    claveDesbloqueo: equipo.claveDesbloqueo ?? '',
    cuentaUsuario: equipo.cuentaUsuario ?? '',
    cuentaPassword: equipo.cuentaPassword ?? ''
  };
}

/** Campos del formulario listos para la API ("" se manda como null). */
export function formularioAEquipo(form: EquipoFormData) {
  return {
    tipoEquipoPersonalizadoId: form.tipoEquipoPersonalizadoId,
    marca: textoONull(form.marca),
    modelo: textoONull(form.modelo),
    color: textoONull(form.color),
    numeroSerie: form.numeroSerie.trim(),
    claveDesbloqueo: textoONull(form.claveDesbloqueo),
    cuentaUsuario: textoONull(form.cuentaUsuario),
    cuentaPassword: textoONull(form.cuentaPassword)
  };
}

/** Texto corto para identificar un equipo en listas y buscadores. */
export function describirEquipo(equipo: Pick<Equipo, 'marca' | 'modelo' | 'numeroSerie'>): string {
  const nombre = `${equipo.marca ?? ''} ${equipo.modelo ?? ''}`.trim() || 'Equipo';
  return equipo.numeroSerie ? `${nombre} (${equipo.numeroSerie})` : nombre;
}

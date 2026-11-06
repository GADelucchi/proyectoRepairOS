import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import type { CondicionIvaEmisor } from '../shared/utils/fiscal';

/**
 * Taller: el inquilino del sistema.
 *
 * Cada alta del registro público crea uno. Sucursales, usuarios, clientes y
 * equipos pertenecen a un taller y nunca se ven entre talleres distintos.
 */
export interface TallerAttributes {
  id: number;
  nombre: string;
  activo: boolean;
  pais: string;
  codigoPublico?: string | null;
  razonSocial?: string | null;
  cuit?: string | null;
  condicionIva?: CondicionIvaEmisor | null;
  domicilioFiscal?: string | null;
  inicioActividades?: string | null;
  ingresosBrutos?: string | null;
  puntoVenta?: number | null;
  stockEntreSucursales?: boolean;
  terminosVenta?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type TallerCreationAttributes = Optional<
  TallerAttributes,
  | 'id'
  | 'activo'
  | 'pais'
  | 'codigoPublico'
  | 'razonSocial'
  | 'cuit'
  | 'condicionIva'
  | 'domicilioFiscal'
  | 'inicioActividades'
  | 'ingresosBrutos'
  | 'puntoVenta'
  | 'stockEntreSucursales'
  | 'terminosVenta'
  | 'createdAt'
  | 'updatedAt'
>;

/** Los campos con los que factura el taller. */
export const ATRIBUTOS_FISCALES = [
  'razonSocial',
  'cuit',
  'condicionIva',
  'domicilioFiscal',
  'inicioActividades',
  'ingresosBrutos',
  'puntoVenta'
] as const;

export class Taller extends Model<TallerAttributes, TallerCreationAttributes> implements TallerAttributes {
  declare id: number;
  declare nombre: string;
  declare activo: boolean;
  /** ISO 3166-1 alfa-2. Define la moneda por defecto y el prefijo de WhatsApp. */
  declare pais: string;
  /** Arma el link del portal de clientes. Se completa al pedirlo si falta (ver `codigoPublicoDe`). */
  declare codigoPublico: string | null;
  // Datos para facturar: cada taller carga los suyos y factura con su propio CUIT.
  declare razonSocial: string | null;
  declare cuit: string | null;
  declare condicionIva: CondicionIvaEmisor | null;
  declare domicilioFiscal: string | null;
  declare inicioActividades: string | null;
  declare ingresosBrutos: string | null;
  /** Punto de venta de tipo Web Services (RECE) dado de alta en ARCA. */
  declare puntoVenta: number | null;
  /** Cada sucursal ve el stock de las demás. Apagado, cada una ve solo lo suyo. */
  declare stockEntreSucursales: boolean;
  /** Términos y condiciones que se imprimen en el comprobante de cada venta de equipos. */
  declare terminosVenta: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof Taller {
    Taller.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        nombre: { type: DataTypes.STRING(150), allowNull: false },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        pais: { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'AR' },
        codigoPublico: { type: DataTypes.STRING(12), allowNull: true, field: 'codigo_publico' },
        razonSocial: { type: DataTypes.STRING(150), allowNull: true, field: 'razon_social' },
        cuit: { type: DataTypes.STRING(11), allowNull: true },
        condicionIva: { type: DataTypes.STRING(30), allowNull: true, field: 'condicion_iva' },
        domicilioFiscal: { type: DataTypes.STRING(255), allowNull: true, field: 'domicilio_fiscal' },
        inicioActividades: { type: DataTypes.DATEONLY, allowNull: true, field: 'inicio_actividades' },
        ingresosBrutos: { type: DataTypes.STRING(30), allowNull: true, field: 'ingresos_brutos' },
        puntoVenta: { type: DataTypes.INTEGER, allowNull: true, field: 'punto_venta' },
        stockEntreSucursales: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: 'stock_entre_sucursales'
        },
        terminosVenta: { type: DataTypes.TEXT, allowNull: true, field: 'terminos_venta' }
      },
      {
        sequelize,
        tableName: 'talleres',
        underscored: true
      }
    );
    return Taller;
  }
}

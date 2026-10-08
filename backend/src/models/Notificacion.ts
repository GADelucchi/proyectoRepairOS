import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

/** De qué se avisa. Sirve para elegir el ícono y para filtrar. */
export const TIPOS_NOTIFICACION = ['taller_nuevo', 'usuario_nuevo', 'autorizacion'] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

/**
 * Aviso dentro de la app para un usuario (la campanita del menú).
 *
 * Es el canal que siempre funciona: no depende de que haya email o WhatsApp
 * configurados. Cada aviso es de un solo destinatario, así marcarlo como leído
 * no se lo marca a nadie más.
 */
export interface NotificacionAttributes {
  id: number;
  usuarioId: number;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje?: string | null;
  /** Ruta de la app adonde lleva el aviso al tocarlo. */
  link?: string | null;
  leidaEn?: Date | null;
  createdAt?: Date;
}

export type NotificacionCreationAttributes = Optional<
  NotificacionAttributes,
  'id' | 'mensaje' | 'link' | 'leidaEn' | 'createdAt'
>;

export class Notificacion
  extends Model<NotificacionAttributes, NotificacionCreationAttributes>
  implements NotificacionAttributes
{
  declare id: number;
  declare usuarioId: number;
  declare tipo: TipoNotificacion;
  declare titulo: string;
  declare mensaje: string | null;
  declare link: string | null;
  declare leidaEn: Date | null;
  declare readonly createdAt: Date;

  static initModel(sequelize: Sequelize): typeof Notificacion {
    Notificacion.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        usuarioId: { type: DataTypes.INTEGER, allowNull: false, field: 'usuario_id' },
        tipo: { type: DataTypes.STRING(40), allowNull: false },
        titulo: { type: DataTypes.STRING(150), allowNull: false },
        mensaje: { type: DataTypes.STRING(500), allowNull: true },
        link: { type: DataTypes.STRING(255), allowNull: true },
        leidaEn: { type: DataTypes.DATE, allowNull: true, field: 'leida_en' }
      },
      {
        sequelize,
        tableName: 'notificaciones',
        underscored: true,
        updatedAt: false
      }
    );
    return Notificacion;
  }
}

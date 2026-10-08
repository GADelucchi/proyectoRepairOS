import { sequelize } from '../config/database';
import { Taller } from './Taller';
import { Plan } from './Plan';
import { Suscripcion } from './Suscripcion';
import { User } from './User';
import { Sucursal } from './Sucursal';
import { UsuarioSucursal } from './UsuarioSucursal';
import { Cliente } from './Cliente';
import { Equipo } from './Equipo';
import { Orden } from './Orden';
import { OrdenChequeo } from './OrdenChequeo';
import { OrdenImagen } from './OrdenImagen';
import { OrdenHistorialEstado } from './OrdenHistorialEstado';
import { TipoEquipoPersonalizado } from './TipoEquipoPersonalizado';
import { ChequeoPersonalizado } from './ChequeoPersonalizado';
import { Contador } from './Contador';
import { AccesoSensible } from './AccesoSensible';
import { CuentaMovimiento } from './CuentaMovimiento';
import { Solicitud } from './Solicitud';
import { Notificacion } from './Notificacion';
import { TokenUsuario } from './TokenUsuario';

Taller.initModel(sequelize);
Plan.initModel(sequelize);
Suscripcion.initModel(sequelize);
User.initModel(sequelize);
Sucursal.initModel(sequelize);
UsuarioSucursal.initModel(sequelize);
Cliente.initModel(sequelize);
Equipo.initModel(sequelize);
Orden.initModel(sequelize);
OrdenChequeo.initModel(sequelize);
OrdenImagen.initModel(sequelize);
OrdenHistorialEstado.initModel(sequelize);
TipoEquipoPersonalizado.initModel(sequelize);
ChequeoPersonalizado.initModel(sequelize);
Contador.initModel(sequelize);
AccesoSensible.initModel(sequelize);
CuentaMovimiento.initModel(sequelize);
Solicitud.initModel(sequelize);
Notificacion.initModel(sequelize);
TokenUsuario.initModel(sequelize);

// Taller -> todo lo que se consulta desde la raíz
Taller.hasOne(Suscripcion, { foreignKey: 'tallerId', as: 'suscripcion' });
Suscripcion.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });
Suscripcion.belongsTo(Plan, { foreignKey: 'planId', as: 'plan' });
Plan.hasMany(Suscripcion, { foreignKey: 'planId', as: 'suscripciones' });

Taller.hasMany(User, { foreignKey: 'tallerId', as: 'usuarios' });
User.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });

Taller.hasMany(Sucursal, { foreignKey: 'tallerId', as: 'sucursales' });
Sucursal.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });

Taller.hasMany(Cliente, { foreignKey: 'tallerId', as: 'clientes' });
Cliente.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });

Taller.hasMany(Equipo, { foreignKey: 'tallerId', as: 'equipos' });
Equipo.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });

// Usuario <-> Sucursal (muchos a muchos, permisos asignados por el admin)
User.belongsToMany(Sucursal, {
  through: UsuarioSucursal,
  foreignKey: 'usuarioId',
  otherKey: 'sucursalId',
  as: 'sucursales'
});
Sucursal.belongsToMany(User, {
  through: UsuarioSucursal,
  foreignKey: 'sucursalId',
  otherKey: 'usuarioId',
  as: 'usuarios'
});
UsuarioSucursal.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
UsuarioSucursal.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });

// Cliente -> Equipos
Cliente.hasMany(Equipo, { foreignKey: 'clienteId', as: 'equipos' });
Equipo.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });

// Orden
Taller.hasMany(Orden, { foreignKey: 'tallerId', as: 'ordenes' });
Orden.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });

Cliente.hasMany(Orden, { foreignKey: 'clienteId', as: 'ordenes' });
Orden.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });

Equipo.hasMany(Orden, { foreignKey: 'equipoId', as: 'ordenes' });
Orden.belongsTo(Equipo, { foreignKey: 'equipoId', as: 'equipo' });

Sucursal.hasMany(Orden, { foreignKey: 'sucursalId', as: 'ordenes' });
Orden.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });

User.hasMany(Orden, { foreignKey: 'tecnicoId', as: 'ordenesRecibidas' });
Orden.belongsTo(User, { foreignKey: 'tecnicoId', as: 'tecnico' });

Orden.hasMany(OrdenChequeo, { foreignKey: 'ordenId', as: 'chequeos', onDelete: 'CASCADE' });
OrdenChequeo.belongsTo(Orden, { foreignKey: 'ordenId', as: 'ordenPadre' });

Orden.hasMany(OrdenImagen, { foreignKey: 'ordenId', as: 'imagenes', onDelete: 'CASCADE' });
OrdenImagen.belongsTo(Orden, { foreignKey: 'ordenId', as: 'orden' });

Orden.hasMany(OrdenHistorialEstado, { foreignKey: 'ordenId', as: 'historialEstados', onDelete: 'CASCADE' });
OrdenHistorialEstado.belongsTo(Orden, { foreignKey: 'ordenId', as: 'orden' });
OrdenHistorialEstado.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

// Tipos de equipo personalizados
User.hasMany(TipoEquipoPersonalizado, { foreignKey: 'usuarioId', as: 'tiposEquipo' });
TipoEquipoPersonalizado.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

Sucursal.hasMany(TipoEquipoPersonalizado, { foreignKey: 'sucursalId', as: 'tiposEquipo' });
TipoEquipoPersonalizado.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });

TipoEquipoPersonalizado.hasMany(ChequeoPersonalizado, {
  foreignKey: 'tipoEquipoPersonalizadoId',
  as: 'chequeos',
  onDelete: 'CASCADE'
});
ChequeoPersonalizado.belongsTo(TipoEquipoPersonalizado, {
  foreignKey: 'tipoEquipoPersonalizadoId',
  as: 'tipoEquipo'
});

// Cuenta corriente: el libro de movimientos de cada cliente
Taller.hasMany(CuentaMovimiento, { foreignKey: 'tallerId', as: 'movimientos' });
CuentaMovimiento.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });
Cliente.hasMany(CuentaMovimiento, { foreignKey: 'clienteId', as: 'movimientos' });
CuentaMovimiento.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });
Orden.hasMany(CuentaMovimiento, { foreignKey: 'ordenId', as: 'movimientos' });
CuentaMovimiento.belongsTo(Orden, { foreignKey: 'ordenId', as: 'orden' });
CuentaMovimiento.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
CuentaMovimiento.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });

// Solicitudes de autorización (fiado y ajustes de cuenta)
Taller.hasMany(Solicitud, { foreignKey: 'tallerId', as: 'solicitudes' });
Solicitud.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });
Solicitud.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });
Solicitud.belongsTo(Orden, { foreignKey: 'ordenId', as: 'orden' });
Solicitud.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });
Solicitud.belongsTo(User, { foreignKey: 'solicitanteId', as: 'solicitante' });
Solicitud.belongsTo(User, { foreignKey: 'resueltoPorId', as: 'resueltoPor' });

// Auditoría de accesos a credenciales de equipos
AccesoSensible.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
AccesoSensible.belongsTo(Equipo, { foreignKey: 'equipoId', as: 'equipo' });
Equipo.hasMany(AccesoSensible, { foreignKey: 'equipoId', as: 'accesosSensibles' });

// Equipo -> Tipo de Equipo Personalizado
Equipo.belongsTo(TipoEquipoPersonalizado, { foreignKey: 'tipoEquipoPersonalizadoId', as: 'tipoEquipo' });
TipoEquipoPersonalizado.hasMany(Equipo, { foreignKey: 'tipoEquipoPersonalizadoId', as: 'equipos' });

// Notificaciones en la app (la campanita)
Notificacion.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
User.hasMany(Notificacion, { foreignKey: 'usuarioId', as: 'notificaciones' });

export {
  sequelize,
  Taller,
  Plan,
  Suscripcion,
  User,
  Sucursal,
  UsuarioSucursal,
  Cliente,
  Equipo,
  Orden,
  OrdenChequeo,
  OrdenImagen,
  OrdenHistorialEstado,
  TipoEquipoPersonalizado,
  ChequeoPersonalizado,
  Contador,
  AccesoSensible,
  CuentaMovimiento,
  Solicitud,
  Notificacion,
  TokenUsuario
};

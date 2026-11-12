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
import { OrdenPrecio } from './OrdenPrecio';
import { TipoEquipoPersonalizado } from './TipoEquipoPersonalizado';
import { ChequeoPersonalizado } from './ChequeoPersonalizado';
import { Contador } from './Contador';
import { AccesoSensible } from './AccesoSensible';
import { CuentaMovimiento } from './CuentaMovimiento';
import { Solicitud } from './Solicitud';
import { Notificacion } from './Notificacion';
import { TokenUsuario } from './TokenUsuario';
import { EquipoStock } from './EquipoStock';
import { EquipoStockCosto } from './EquipoStockCosto';
import { Venta } from './Venta';
import { VentaItem } from './VentaItem';
import { VentaPartePago } from './VentaPartePago';
import { VentaPago } from './VentaPago';
import { Tercerizacion } from './Tercerizacion';

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
OrdenPrecio.initModel(sequelize);
TipoEquipoPersonalizado.initModel(sequelize);
ChequeoPersonalizado.initModel(sequelize);
Contador.initModel(sequelize);
AccesoSensible.initModel(sequelize);
CuentaMovimiento.initModel(sequelize);
Solicitud.initModel(sequelize);
Notificacion.initModel(sequelize);
TokenUsuario.initModel(sequelize);
EquipoStock.initModel(sequelize);
EquipoStockCosto.initModel(sequelize);
Venta.initModel(sequelize);
VentaItem.initModel(sequelize);
VentaPartePago.initModel(sequelize);
VentaPago.initModel(sequelize);
Tercerizacion.initModel(sequelize);

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

Orden.hasMany(OrdenPrecio, { foreignKey: 'ordenId', as: 'precios', onDelete: 'CASCADE' });
OrdenPrecio.belongsTo(Orden, { foreignKey: 'ordenId', as: 'orden' });

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

// Stock de equipos para la venta
Taller.hasMany(EquipoStock, { foreignKey: 'tallerId', as: 'stock' });
EquipoStock.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });
EquipoStock.belongsTo(User, { foreignKey: 'cargadoPorId', as: 'cargadoPor' });
EquipoStock.belongsTo(User, { foreignKey: 'bajaPorId', as: 'bajaPor' });
EquipoStock.hasMany(EquipoStockCosto, { foreignKey: 'equipoStockId', as: 'costos' });
EquipoStockCosto.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });
EquipoStockCosto.belongsTo(User, { foreignKey: 'anuladoPorId', as: 'anuladoPor' });

// Ventas de equipos del stock
Taller.hasMany(Venta, { foreignKey: 'tallerId', as: 'ventas' });
Venta.belongsTo(Cliente, { foreignKey: 'clienteId', as: 'cliente' });
Venta.belongsTo(Sucursal, { foreignKey: 'sucursalId', as: 'sucursal' });
Venta.belongsTo(User, { foreignKey: 'vendedorId', as: 'vendedor' });
Venta.belongsTo(User, { foreignKey: 'canceladaPorId', as: 'canceladaPor' });
Venta.hasMany(VentaItem, { foreignKey: 'ventaId', as: 'items' });
VentaItem.belongsTo(EquipoStock, { foreignKey: 'equipoStockId', as: 'equipo' });
VentaItem.belongsTo(Venta, { foreignKey: 'ventaId', as: 'venta' });
Venta.hasMany(VentaPartePago, { foreignKey: 'ventaId', as: 'partesPago' });
Venta.hasMany(VentaPago, { foreignKey: 'ventaId', as: 'pagos' });
VentaPago.belongsTo(User, { foreignKey: 'usuarioId', as: 'usuario' });

// Tercerización: la orden del taller que manda el equipo y, si el destino usa
// RepairOS, la que se le creó a ese taller.
Orden.hasMany(Tercerizacion, { foreignKey: 'ordenId', as: 'tercerizaciones' });
Tercerizacion.belongsTo(Orden, { foreignKey: 'ordenId', as: 'orden' });
Tercerizacion.belongsTo(Orden, { foreignKey: 'ordenDestinoId', as: 'ordenDestino' });
Tercerizacion.belongsTo(Taller, { foreignKey: 'tallerId', as: 'taller' });
Tercerizacion.belongsTo(Taller, { foreignKey: 'tallerDestinoId', as: 'tallerDestino' });
Tercerizacion.belongsTo(User, { foreignKey: 'enviadaPorId', as: 'enviadaPor' });

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
  OrdenPrecio,
  TipoEquipoPersonalizado,
  ChequeoPersonalizado,
  Contador,
  AccesoSensible,
  CuentaMovimiento,
  Solicitud,
  Notificacion,
  TokenUsuario,
  EquipoStock,
  EquipoStockCosto,
  Venta,
  VentaItem,
  VentaPartePago,
  VentaPago,
  Tercerizacion
};

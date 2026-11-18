import { Router } from 'express';
import { authenticate, requireRole, requireSucursal } from '../../shared/middlewares/auth.middleware';
import * as inventario from './inventario.controller';

export const inventarioRoutes = Router();

// Cargar compras, usar repuestos y pasar entre sucursales es tarea de todos los
// días; los costos los ve solo un admin (el servicio los saca de la respuesta).
inventarioRoutes.use(authenticate, requireSucursal);

inventarioRoutes.get('/config', inventario.obtenerConfig);
inventarioRoutes.put('/config', requireRole('admin'), inventario.guardarConfig);

inventarioRoutes.post('/categorias', inventario.crearCategoria);
inventarioRoutes.put('/categorias/:id', requireRole('admin'), inventario.renombrarCategoria);
inventarioRoutes.delete('/categorias/:id', requireRole('admin'), inventario.borrarCategoria);

inventarioRoutes.get('/articulos', inventario.listarArticulos);
inventarioRoutes.get('/articulos/codigo', inventario.buscarPorCodigo);
inventarioRoutes.get('/articulos/:id', inventario.obtenerArticulo);
inventarioRoutes.post('/articulos', inventario.crearArticulo);
inventarioRoutes.put('/articulos/:id', inventario.actualizarArticulo);
inventarioRoutes.post('/articulos/:id/archivar', requireRole('admin'), inventario.archivarArticulo);
// Corregir lo que hay según un conteo cambia el valor del stock: solo admin.
inventarioRoutes.post('/articulos/:id/ajuste', requireRole('admin'), inventario.ajustarPorConteo);

inventarioRoutes.post('/entradas', inventario.cargarEntrada);
// Sacar unidades sin usarlas baja el valor del stock: es de admin.
inventarioRoutes.post('/entradas/:id/baja', requireRole('admin'), inventario.darDeBajaUnidades);
inventarioRoutes.get('/proveedores', inventario.listarProveedores);
inventarioRoutes.get('/cotizacion', inventario.cotizacionSugerida);

inventarioRoutes.get('/pases', inventario.listarPases);
inventarioRoutes.post('/pases', inventario.crearPase);
inventarioRoutes.post('/pases/:id/recibir', inventario.recibirPase);
inventarioRoutes.post('/pases/:id/cancelar', inventario.cancelarPase);

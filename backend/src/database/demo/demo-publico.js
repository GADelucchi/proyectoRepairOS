'use strict';

const bcrypt = require('bcrypt');
const { randomInt } = require('crypto');

/** Mismo formato que `modules/seguimiento/codigo.ts`: el link público de cada orden. */
const ALFABETO_SEGUIMIENTO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const codigoSeguimiento = () =>
  Array.from({ length: 10 }, () => ALFABETO_SEGUIMIENTO[randomInt(ALFABETO_SEGUIMIENTO.length)]).join('');

/**
 * Taller de demostración pública.
 *
 * Es un taller como cualquier otro: el aislamiento multi-tenant (`taller_id` en
 * cada consulta) alcanza para que quien entre a probar el sistema no vea ni
 * toque los datos de un taller real. Por eso la demo no necesita permisos
 * especiales ni un rol nuevo, solo su propio taller.
 *
 * Este módulo lo usan dos cosas:
 *  - el seeder `20260101000001-demo-publico.js`, para crearlo la primera vez;
 *  - `scripts/reset-demo.js`, que lo borra y lo rehace para que la demo no se degrade
 *    con lo que vayan dejando los visitantes.
 *
 * Todo lo de acá se identifica por el nombre del taller, así que borrar la demo
 * nunca puede tocar datos de otro taller.
 */

const TALLER_NOMBRE = 'RepairOS Demo';
const DEMO_EMAIL = 'demo@repairos.ar';
const TECNICO_EMAIL = 'tecnico.demo@repairos.ar';
const DEMO_PASSWORD = 'demo123';

/**
 * Las órdenes sembradas arrancan después de este número. La numeración es por
 * taller (índice único `taller_id + numero_orden`), así que la demo no choca
 * con ningún taller real.
 */
const NUMERO_ORDEN_BASE = 0;

// "Sin chequear" primero: es la respuesta que queda marcada al crear una orden.
const OPCIONES_CHEQUEO = [{ etiqueta: 'Sin chequear' }, { etiqueta: 'Sí' }, { etiqueta: 'No' }];

const SUCURSALES = [
  {
    clave: 'central',
    nombre: 'Casa Central',
    direccion: 'Av. Rivadavia 4521, CABA',
    telefono: '011 4902-7730'
  },
  { clave: 'norte', nombre: 'Sucursal Norte', direccion: 'Av. Cabildo 2190, CABA', telefono: '011 4783-1140' }
];

const TIPOS_EQUIPO = [
  {
    clave: 'celular',
    nombre: 'Celular',
    chequeos: [
      'Enciende',
      'Pantalla sin fisuras',
      'Táctil responde en toda la superficie',
      'Cámara frontal y trasera',
      'Altavoz y micrófono',
      'Puerto de carga',
      'Botones físicos',
      'Lector de huella / Face ID'
    ]
  },
  {
    clave: 'notebook',
    nombre: 'Notebook',
    chequeos: [
      'Enciende',
      'Pantalla sin píxeles muertos',
      'Teclado completo',
      'Trackpad',
      'La batería retiene carga',
      'Puertos USB',
      'Ventilador sin ruido',
      'Wi-Fi'
    ]
  },
  {
    clave: 'tablet',
    nombre: 'Tablet',
    chequeos: [
      'Enciende',
      'Pantalla sin fisuras',
      'Táctil responde en toda la superficie',
      'Puerto de carga',
      'Altavoces'
    ]
  }
];

const CLIENTES = [
  {
    clave: 'gomez',
    nombre: 'Lucía',
    apellido: 'Gómez',
    dniCuit: '32415678',
    telefono: '11 5523-8841',
    email: 'lucia.gomez@example.com',
    direccion: 'Pje. Dorrego 142, CABA',
    cuentaCorriente: false
  },
  {
    clave: 'peralta',
    nombre: 'Martín',
    apellido: 'Peralta',
    dniCuit: '28904331',
    telefono: '11 6694-2015',
    email: 'mperalta@example.com',
    direccion: 'Bulnes 1890, CABA',
    cuentaCorriente: true
  },
  {
    clave: 'sosa',
    nombre: 'Carla',
    apellido: 'Sosa',
    dniCuit: '35112908',
    telefono: '11 3388-7724',
    email: 'carla.sosa@example.com',
    direccion: 'Av. Córdoba 3155, CABA',
    cuentaCorriente: false
  },
  {
    clave: 'ferreyra',
    nombre: 'Diego',
    apellido: 'Ferreyra',
    dniCuit: '30551207',
    telefono: '11 4471-9003',
    email: 'dferreyra@example.com',
    direccion: 'Olazábal 2740, CABA',
    cuentaCorriente: false
  },
  {
    clave: 'sindicato',
    nombre: 'Ramiro',
    apellido: 'Quiroga',
    dniCuit: '30-71044562-8',
    telefono: '11 4328-5500',
    email: 'compras@sindicatodemo.org.ar',
    direccion: 'Av. Belgrano 1370, CABA',
    cuentaCorriente: true,
    esGremio: true,
    nombreGremio: 'Sindicato Demo de Empleados'
  },
  {
    clave: 'ledesma',
    nombre: 'Natalia',
    apellido: 'Ledesma',
    dniCuit: '36780114',
    telefono: '11 5901-6677',
    email: 'nledesma@example.com',
    direccion: 'Juramento 4502, CABA',
    cuentaCorriente: false
  }
];

const EQUIPOS = [
  {
    clave: 'ip12-gomez',
    cliente: 'gomez',
    tipo: 'celular',
    sucursal: 'central',
    marca: 'Apple',
    modelo: 'iPhone 12',
    color: 'Negro',
    serie: 'F17GX8PQ2L'
  },
  {
    clave: 'a54-peralta',
    cliente: 'peralta',
    tipo: 'celular',
    sucursal: 'central',
    marca: 'Samsung',
    modelo: 'Galaxy A54',
    color: 'Violeta',
    serie: 'RF8T40ZK9ME'
  },
  {
    clave: 'moto-sosa',
    cliente: 'sosa',
    tipo: 'celular',
    sucursal: 'central',
    marca: 'Motorola',
    modelo: 'Moto G84',
    color: 'Azul',
    serie: 'ZY22K8XQ1D'
  },
  {
    clave: 'vivo-ferreyra',
    cliente: 'ferreyra',
    tipo: 'notebook',
    sucursal: 'central',
    marca: 'Lenovo',
    modelo: 'IdeaPad 3 15ITL',
    color: 'Gris',
    serie: 'PF2YH4N7'
  },
  {
    clave: 'hp-sindicato',
    cliente: 'sindicato',
    tipo: 'notebook',
    sucursal: 'central',
    marca: 'HP',
    modelo: 'ProBook 440 G8',
    color: 'Plata',
    serie: '5CD1340XQK'
  },
  {
    clave: 'dell-sindicato',
    cliente: 'sindicato',
    tipo: 'notebook',
    sucursal: 'central',
    marca: 'Dell',
    modelo: 'Latitude 3420',
    color: 'Negro',
    serie: 'JH8R4T3'
  },
  {
    clave: 'ipad-ledesma',
    cliente: 'ledesma',
    tipo: 'tablet',
    sucursal: 'norte',
    marca: 'Apple',
    modelo: 'iPad 9na gen',
    color: 'Gris espacial',
    serie: 'DMPX20JLQ1GC'
  },
  {
    clave: 'ip13-ledesma',
    cliente: 'ledesma',
    tipo: 'celular',
    sucursal: 'norte',
    marca: 'Apple',
    modelo: 'iPhone 13',
    color: 'Blanco',
    serie: 'G99KL1MM4T'
  }
];

/**
 * Las órdenes cubren todos los estados del ciclo de vida para que la demo
 * muestre el tablero poblado y no una sola columna. `historial` sigue las
 * transiciones válidas de `models/estadoOrden.ts`.
 */
const ORDENES = [
  {
    equipo: 'ip12-gomez',
    sucursal: 'central',
    tecnico: 'tecnico',
    diasAtras: 1,
    historial: ['recibido'],
    reparacion: 'No carga. Probó con dos cables distintos y tampoco.',
    esteticos: 'Marca de golpe en la esquina inferior izquierda.',
    chequeosFallados: ['Puerto de carga']
  },
  {
    equipo: 'a54-peralta',
    sucursal: 'central',
    tecnico: 'tecnico',
    diasAtras: 2,
    historial: ['recibido', 'en_diagnostico'],
    reparacion: 'Se apaga solo cuando la batería llega a 40%.',
    esteticos: 'Sin daños visibles.',
    notas: 'Revisar batería y controlador de carga.'
  },
  {
    equipo: 'moto-sosa',
    sucursal: 'central',
    tecnico: 'admin',
    diasAtras: 4,
    historial: ['recibido', 'en_diagnostico', 'presupuestado'],
    reparacion: 'Pantalla rota tras una caída. El táctil responde a medias.',
    esteticos: 'Vidrio astillado en toda la mitad superior.',
    presupuesto: 85000,
    chequeosFallados: ['Pantalla sin fisuras', 'Táctil responde en toda la superficie']
  },
  {
    equipo: 'vivo-ferreyra',
    sucursal: 'central',
    tecnico: 'tecnico',
    diasAtras: 6,
    historial: ['recibido', 'en_diagnostico', 'presupuestado', 'aprobado'],
    reparacion: 'No da imagen. Enciende pero la pantalla queda en negro.',
    esteticos: 'Tapa con rayones de uso.',
    presupuesto: 142000,
    aprobado: true,
    chequeosFallados: ['Pantalla sin píxeles muertos']
  },
  {
    equipo: 'hp-sindicato',
    sucursal: 'central',
    tecnico: 'tecnico',
    diasAtras: 8,
    historial: ['recibido', 'en_diagnostico', 'presupuestado', 'aprobado', 'en_reparacion'],
    reparacion: 'Teclado con varias teclas que no responden.',
    esteticos: 'Equipo en buen estado general.',
    presupuesto: 96000,
    aprobado: true,
    notas: 'Teclado pedido al proveedor, llega en 48 hs.',
    chequeosFallados: ['Teclado completo']
  },
  {
    equipo: 'dell-sindicato',
    sucursal: 'central',
    tecnico: 'admin',
    diasAtras: 11,
    historial: ['recibido', 'en_diagnostico', 'presupuestado', 'aprobado', 'listo_para_retirar'],
    reparacion: 'Muy lenta y se recalienta.',
    esteticos: 'Sin daños.',
    presupuesto: 68000,
    aprobado: true,
    notas: 'Se cambió pasta térmica y se limpió el disipador. Probada 2 hs sin throttling.',
    chequeosFallados: ['Ventilador sin ruido']
  },
  {
    equipo: 'ip13-ledesma',
    sucursal: 'norte',
    tecnico: 'admin',
    diasAtras: 15,
    historial: ['recibido', 'en_diagnostico', 'presupuestado', 'aprobado', 'listo_para_retirar', 'entregado'],
    reparacion: 'Cambio de batería, duraba media jornada.',
    esteticos: 'Impecable.',
    presupuesto: 72000,
    aprobado: true,
    montoTotal: 72000,
    montoAbonado: 72000
  },
  {
    equipo: 'ipad-ledesma',
    sucursal: 'norte',
    tecnico: 'admin',
    diasAtras: 21,
    historial: ['recibido', 'en_diagnostico', 'presupuestado', 'aprobado', 'listo_para_retirar', 'entregado'],
    reparacion: 'Puerto de carga flojo, había que sostener el cable.',
    esteticos: 'Rayón leve en el marco.',
    presupuesto: 54000,
    aprobado: true,
    montoTotal: 54000,
    montoAbonado: 54000,
    chequeosFallados: ['Puerto de carga']
  },
  {
    equipo: 'moto-sosa',
    sucursal: 'central',
    tecnico: 'tecnico',
    diasAtras: 28,
    historial: ['recibido', 'en_diagnostico', 'presupuestado', 'rechazado'],
    reparacion: 'Mojado. El cliente lo dejó en agua de lluvia toda la noche.',
    esteticos: 'Óxido visible en el conector.',
    presupuesto: 190000,
    aprobado: false,
    notas: 'El cliente no aprueba: el presupuesto supera lo que vale el equipo.'
  },
  {
    equipo: 'a54-peralta',
    sucursal: 'central',
    tecnico: 'admin',
    diasAtras: 34,
    historial: ['recibido', 'cancelado'],
    reparacion: 'Consulta por cambio de glass.',
    esteticos: 'Sin daños.',
    notas: 'El cliente se llevó el equipo sin dejarlo en reparación.'
  }
];

/** Cuántos pesos valía 1 US$ (ilustrativo: es para que la demo muestre ventas y costos en pesos). */
const COTIZACION_ARS = 1450;

/**
 * Equipos del stock, de la compra más vieja a la más nueva. El estado sale de
 * las ventas (`VENTAS`): lo que no está en ninguna queda disponible. Los precios
 * de venta van en dólares, como se publican los celulares.
 *
 * `costos`: lo que se le agregó después de comprarlo (lo ve solo un admin).
 */
const STOCK = [
  {
    clave: 'ip13pro-vendido',
    sucursal: 'central',
    diasCompra: 70,
    marca: 'Apple',
    modelo: 'iPhone 13 Pro',
    color: 'Grafito',
    gb: 128,
    condicion: 'usado',
    bateria: 89,
    proveedor: 'Importadora Once',
    costo: 520,
    precio: 690
  },
  {
    clave: 'a35-vendido',
    sucursal: 'central',
    diasCompra: 60,
    marca: 'Samsung',
    modelo: 'Galaxy A35',
    color: 'Azul',
    gb: 128,
    condicion: 'nuevo',
    proveedor: 'Distribuidora Sur',
    monedaCosto: 'ARS',
    costo: 350000,
    cotizacionCosto: 1380,
    precio: 330
  },
  {
    clave: 'ip14-vendido',
    sucursal: 'central',
    diasCompra: 48,
    marca: 'Apple',
    modelo: 'iPhone 14',
    color: 'Medianoche',
    gb: 128,
    condicion: 'usado',
    bateria: 90,
    proveedor: 'Importadora Once',
    costo: 560,
    precio: 720,
    costos: [{ concepto: 'Cambio de vidrio trasero', diasAtras: 45, monto: 35 }]
  },
  {
    clave: 'ip13-disp',
    sucursal: 'central',
    diasCompra: 40,
    marca: 'Apple',
    modelo: 'iPhone 13',
    color: 'Azul',
    gb: 128,
    condicion: 'usado',
    bateria: 86,
    proveedor: 'Importadora Once',
    costo: 380,
    precio: 520
  },
  {
    clave: 'motoe13-baja',
    sucursal: 'central',
    diasCompra: 38,
    marca: 'Motorola',
    modelo: 'Moto E13',
    color: 'Negro',
    gb: 64,
    condicion: 'nuevo',
    proveedor: 'Distribuidora Sur',
    costo: 85,
    precio: 129,
    baja: { diasAtras: 36, motivo: 'Vino con la pantalla rota de fábrica; el proveedor no lo cambió.' }
  },
  {
    clave: 's23-disp',
    sucursal: 'central',
    diasCompra: 30,
    marca: 'Samsung',
    modelo: 'Galaxy S23',
    color: 'Verde',
    gb: 256,
    condicion: 'usado',
    bateria: 88,
    proveedor: 'Particular',
    costo: 400,
    precio: 580,
    costos: [
      {
        concepto: 'Módulo de pantalla',
        diasAtras: 27,
        moneda: 'ARS',
        monto: 87000,
        cotizacion: COTIZACION_ARS
      }
    ]
  },
  {
    clave: 'ip15pro-vendido',
    sucursal: 'central',
    diasCompra: 25,
    marca: 'Apple',
    modelo: 'iPhone 15 Pro',
    color: 'Titanio natural',
    gb: 256,
    condicion: 'nuevo',
    proveedor: 'Importadora Once',
    costo: 980,
    precio: 1199
  },
  {
    clave: 's23ultra-senado',
    sucursal: 'central',
    diasCompra: 22,
    marca: 'Samsung',
    modelo: 'Galaxy S23 Ultra',
    color: 'Negro',
    gb: 256,
    condicion: 'usado',
    bateria: 92,
    proveedor: 'Particular',
    costo: 650,
    precio: 890
  },
  {
    clave: 'ip15-disp',
    sucursal: 'central',
    diasCompra: 18,
    marca: 'Apple',
    modelo: 'iPhone 15',
    color: 'Negro',
    gb: 128,
    condicion: 'nuevo',
    proveedor: 'Importadora Once',
    costo: 780,
    precio: 999
  },
  {
    clave: 'a55-disp',
    sucursal: 'central',
    diasCompra: 15,
    marca: 'Samsung',
    modelo: 'Galaxy A55',
    color: 'Celeste',
    gb: 256,
    condicion: 'nuevo',
    proveedor: 'Distribuidora Sur',
    monedaCosto: 'ARS',
    costo: 435000,
    cotizacionCosto: COTIZACION_ARS,
    precio: 429
  },
  {
    clave: 'ip14pro-reservado',
    sucursal: 'central',
    diasCompra: 12,
    marca: 'Apple',
    modelo: 'iPhone 14 Pro',
    color: 'Morado oscuro',
    gb: 256,
    condicion: 'usado',
    bateria: 91,
    proveedor: 'Particular',
    costo: 700,
    precio: 950
  },
  {
    clave: 'redmi-disp',
    sucursal: 'central',
    diasCompra: 6,
    marca: 'Xiaomi',
    modelo: 'Redmi Note 13 Pro',
    color: 'Negro',
    gb: 256,
    condicion: 'nuevo',
    proveedor: 'Distribuidora Sur',
    costo: 230,
    precio: 319
  },
  {
    clave: 'g84-vendido',
    sucursal: 'norte',
    diasCompra: 35,
    marca: 'Motorola',
    modelo: 'Moto G84',
    color: 'Azul',
    gb: 256,
    condicion: 'nuevo',
    proveedor: 'Distribuidora Sur',
    costo: 190,
    precio: 259
  },
  {
    clave: 'edge40-disp',
    sucursal: 'norte',
    diasCompra: 20,
    marca: 'Motorola',
    modelo: 'Edge 40',
    color: 'Negro',
    gb: 256,
    condicion: 'nuevo',
    proveedor: 'Distribuidora Sur',
    costo: 280,
    precio: 379
  },
  {
    clave: 'ip12-disp',
    sucursal: 'norte',
    diasCompra: 10,
    marca: 'Apple',
    modelo: 'iPhone 12',
    color: 'Blanco',
    gb: 64,
    condicion: 'usado',
    bateria: 79,
    proveedor: 'Particular',
    costo: 210,
    precio: 300
  }
];

/**
 * Ventas: completadas a lo largo de los últimos dos meses (para que el informe
 * tenga este mes y el anterior), más una reserva y una seña abiertas. Cubren los
 * casos que tiene que mostrar la demo: venta en pesos, descuento, parte de pago
 * y pago en dos monedas.
 *
 * `pagos` tienen que cubrir lo que se paga en plata (total − parte de pago), en
 * la moneda de la venta o en dólares con su cotización. `crearDemo` lo verifica.
 */
const VENTAS = [
  {
    cliente: 'gomez',
    sucursal: 'central',
    vendedor: 'admin',
    diasAtras: 50,
    estado: 'completada',
    moneda: 'USD',
    items: [{ equipo: 'ip13pro-vendido', precio: 690 }],
    pagos: [{ monto: 690, medio: 'efectivo' }]
  },
  {
    cliente: 'sosa',
    sucursal: 'central',
    vendedor: 'tecnico',
    diasAtras: 34,
    estado: 'completada',
    moneda: 'ARS',
    cotizacion: 1420,
    items: [{ equipo: 'a35-vendido', precio: 480000 }],
    pagos: [{ monto: 480000, medio: 'transferencia' }]
  },
  {
    cliente: 'peralta',
    sucursal: 'central',
    vendedor: 'admin',
    diasAtras: 21,
    estado: 'completada',
    moneda: 'USD',
    items: [{ equipo: 'ip14-vendido', precio: 720 }],
    descuento: { tipo: 'monto', valor: 20 },
    comentarioCliente: 'Incluye funda y vidrio templado.',
    // Lo que deja entra al stock como usado, con su costo = lo que se le descontó.
    partePago: {
      marca: 'Apple',
      modelo: 'iPhone 11',
      color: 'Rojo',
      gb: 64,
      bateria: 76,
      monto: 150,
      precio: 260,
      observaciones: 'Rayón en el marco.'
    },
    // 700 − 150 de parte de pago = 550: 400 en dólares y el resto en pesos.
    pagos: [
      { monto: 400, medio: 'efectivo' },
      { monto: 217500, moneda: 'ARS', cotizacion: COTIZACION_ARS, medio: 'transferencia' }
    ]
  },
  {
    cliente: 'ferreyra',
    sucursal: 'central',
    vendedor: 'admin',
    diasAtras: 8,
    estado: 'completada',
    moneda: 'USD',
    items: [{ equipo: 'ip15pro-vendido', precio: 1199 }],
    pagos: [{ monto: 1199, medio: 'transferencia' }]
  },
  {
    cliente: 'ledesma',
    sucursal: 'norte',
    vendedor: 'admin',
    diasAtras: 3,
    estado: 'completada',
    moneda: 'USD',
    items: [{ equipo: 'g84-vendido', precio: 259 }],
    pagos: [{ monto: 259, medio: 'efectivo' }]
  },
  {
    cliente: 'ledesma',
    sucursal: 'central',
    vendedor: 'tecnico',
    diasAtras: 5,
    estado: 'senada',
    moneda: 'USD',
    items: [{ equipo: 's23ultra-senado', precio: 890 }],
    comentarioCliente: 'Retira el sábado con el resto.',
    pagos: [{ monto: 200, medio: 'efectivo' }]
  },
  {
    cliente: 'sosa',
    sucursal: 'central',
    vendedor: 'tecnico',
    diasAtras: 1,
    estado: 'reservada',
    moneda: 'USD',
    items: [{ equipo: 'ip14pro-reservado', precio: 950 }],
    reservadaPorDias: 3,
    pagos: []
  }
];

const TERMINOS_VENTA =
  'Garantía de 90 días en equipos usados y la del fabricante en los nuevos. No cubre golpes, humedad ni pantallas rotas. Las señas no son reembolsables pasados 15 días.';

/** IMEI válido (dígito verificador de Luhn), distinto para cada equipo de la demo. */
function imeiDemo(indice) {
  const base = '3569' + String(41000000 + indice * 7919).padStart(10, '0');
  let suma = 0;
  for (let i = 0; i < 14; i++) {
    let d = Number(base[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  return base + String((10 - (suma % 10)) % 10);
}

const redondear = (valor) => Math.round((valor + Number.EPSILON) * 100) / 100;

/** Un monto pasado a dólares con su cotización (1 US$ en esa moneda), como `enDolares`. */
const aDolares = (monto, moneda, cotizacion) => (moneda === 'USD' ? monto : redondear(monto / cotizacion));

/** Resta días a una fecha sin tocar la original. */
function haceDias(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fecha;
}

function soloFecha(fecha) {
  return fecha.toISOString().slice(0, 10);
}

/** Id del taller demo, o null si todavía no existe. */
async function buscarTallerDemo(sequelize) {
  const [fila] = await sequelize.query('SELECT id FROM talleres WHERE nombre = ? LIMIT 1', {
    replacements: [TALLER_NOMBRE],
    type: sequelize.QueryTypes.SELECT
  });
  return fila ? fila.id : null;
}

/**
 * Borra el taller demo por completo.
 *
 * El orden importa: `ordenes` referencia clientes, equipos, sucursales y users
 * con onDelete RESTRICT, así que las filas que dependen de algo se van primero.
 */
async function borrarDemo(queryInterface) {
  const { sequelize } = queryInterface;
  const tallerId = await buscarTallerDemo(sequelize);
  if (!tallerId) return false;

  const r = { replacements: [tallerId] };

  // Stock y ventas primero: las ventas apuntan a clientes, sucursales y users, y
  // un equipo del stock a la venta en la que entró como parte de pago.
  await sequelize.query('DELETE FROM venta_pagos WHERE taller_id = ?', r);
  await sequelize.query(
    'DELETE p FROM venta_partes_pago p JOIN ventas v ON v.id = p.venta_id WHERE v.taller_id = ?',
    r
  );
  await sequelize.query(
    'DELETE i FROM venta_items i JOIN ventas v ON v.id = i.venta_id WHERE v.taller_id = ?',
    r
  );
  await sequelize.query('DELETE FROM equipo_stock_costos WHERE taller_id = ?', r);
  await sequelize.query('UPDATE equipos_stock SET recibido_en_venta_id = NULL WHERE taller_id = ?', r);
  await sequelize.query('DELETE FROM ventas WHERE taller_id = ?', r);
  await sequelize.query('DELETE FROM equipos_stock WHERE taller_id = ?', r);

  await sequelize.query(
    `DELETE oc FROM orden_chequeos oc
       JOIN ordenes o ON o.id = oc.orden_id
       JOIN clientes c ON c.id = o.cliente_id
      WHERE c.taller_id = ?`,
    r
  );
  await sequelize.query(
    `DELETE oi FROM orden_imagenes oi
       JOIN ordenes o ON o.id = oi.orden_id
       JOIN clientes c ON c.id = o.cliente_id
      WHERE c.taller_id = ?`,
    r
  );
  await sequelize.query(
    `DELETE h FROM orden_historial_estados h
       JOIN ordenes o ON o.id = h.orden_id
       JOIN clientes c ON c.id = o.cliente_id
      WHERE c.taller_id = ?`,
    r
  );
  await sequelize.query('DELETE FROM cuenta_movimientos WHERE taller_id = ?', r);
  await sequelize.query('DELETE FROM solicitudes WHERE taller_id = ?', r);
  await sequelize.query(
    `DELETE a FROM accesos_sensibles a
       JOIN equipos e ON e.id = a.equipo_id
      WHERE e.taller_id = ?`,
    r
  );
  await sequelize.query(
    `DELETE o FROM ordenes o
       JOIN clientes c ON c.id = o.cliente_id
      WHERE c.taller_id = ?`,
    r
  );
  await sequelize.query('DELETE FROM equipos WHERE taller_id = ?', r);
  await sequelize.query('DELETE FROM clientes WHERE taller_id = ?', r);
  await sequelize.query(
    `DELETE ch FROM chequeo_personalizados ch
       JOIN tipo_equipo_personalizados t ON t.id = ch.tipo_equipo_personalizado_id
       JOIN sucursales s ON s.id = t.sucursal_id
      WHERE s.taller_id = ?`,
    r
  );
  await sequelize.query(
    `DELETE t FROM tipo_equipo_personalizados t
       JOIN sucursales s ON s.id = t.sucursal_id
      WHERE s.taller_id = ?`,
    r
  );
  await sequelize.query(
    `DELETE us FROM usuario_sucursales us
       JOIN users u ON u.id = us.usuario_id
      WHERE u.taller_id = ?`,
    r
  );
  await sequelize.query('DELETE FROM users WHERE taller_id = ?', r);
  await sequelize.query('DELETE FROM sucursales WHERE taller_id = ?', r);
  await sequelize.query('DELETE FROM suscripciones WHERE taller_id = ?', r);
  await sequelize.query('DELETE FROM contadores WHERE clave IN (?)', {
    replacements: [['orden:' + tallerId, 'stock:' + tallerId, 'venta:' + tallerId]]
  });
  await sequelize.query('DELETE FROM talleres WHERE id = ?', r);

  return true;
}

/** Inserta una fila y devuelve su id, resolviendo el autoincrement de MySQL. */
async function insertarYObtenerId(sequelize, tabla, datos) {
  const columnas = Object.keys(datos);
  const marcadores = columnas.map(() => '?').join(', ');
  const [id] = await sequelize.query(
    'INSERT INTO `' +
      tabla +
      '` (' +
      columnas.map((c) => '`' + c + '`').join(', ') +
      ') VALUES (' +
      marcadores +
      ')',
    { replacements: columnas.map((c) => datos[c]) }
  );
  return id;
}

/** Crea el taller demo completo. Asume que no existe (llamar a borrarDemo antes). */
async function crearDemo(queryInterface) {
  const { sequelize } = queryInterface;
  const ahora = new Date();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const tallerId = await insertarYObtenerId(sequelize, 'talleres', {
    nombre: TALLER_NOMBRE,
    activo: true,
    // Fijo: el portal de clientes y el catálogo de la demo tienen siempre el mismo link.
    codigo_publico: 'DEMO2026',
    stock_entre_sucursales: true,
    catalogo_publico: true,
    terminos_venta: TERMINOS_VENTA,
    created_at: ahora,
    updated_at: ahora
  });

  // La demo no debe caducar nunca por vencimiento de suscripción.
  await insertarYObtenerId(sequelize, 'suscripciones', {
    taller_id: tallerId,
    plan_id: null,
    estado: 'prueba',
    gracia_hasta: '2099-12-31',
    periodo_fin: null,
    created_at: ahora,
    updated_at: ahora
  });

  const sucursalIds = {};
  for (const suc of SUCURSALES) {
    sucursalIds[suc.clave] = await insertarYObtenerId(sequelize, 'sucursales', {
      taller_id: tallerId,
      nombre: suc.nombre,
      direccion: suc.direccion,
      telefono: suc.telefono,
      activo: true,
      created_at: ahora,
      updated_at: ahora
    });
  }

  const adminId = await insertarYObtenerId(sequelize, 'users', {
    taller_id: tallerId,
    nombre: 'Usuario',
    apellido: 'Demo',
    email: DEMO_EMAIL,
    password_hash: passwordHash,
    rol: 'admin',
    activo: true,
    created_at: ahora,
    updated_at: ahora
  });

  const tecnicoId = await insertarYObtenerId(sequelize, 'users', {
    taller_id: tallerId,
    nombre: 'Javier',
    apellido: 'Núñez',
    email: TECNICO_EMAIL,
    password_hash: passwordHash,
    rol: 'tecnico',
    activo: true,
    created_at: ahora,
    updated_at: ahora
  });

  const usuarioIds = { admin: adminId, tecnico: tecnicoId };

  // El admin ve las dos sucursales; el técnico solo la central.
  for (const sucursalId of Object.values(sucursalIds)) {
    await insertarYObtenerId(sequelize, 'usuario_sucursales', {
      usuario_id: adminId,
      sucursal_id: sucursalId,
      created_at: ahora,
      updated_at: ahora
    });
  }
  await insertarYObtenerId(sequelize, 'usuario_sucursales', {
    usuario_id: tecnicoId,
    sucursal_id: sucursalIds.central,
    created_at: ahora,
    updated_at: ahora
  });

  // Los tipos de equipo son por sucursal, así que cada una lleva su juego.
  const tipoIds = {};
  const chequeosPorTipo = {};
  for (const suc of SUCURSALES) {
    for (const tipo of TIPOS_EQUIPO) {
      const tipoId = await insertarYObtenerId(sequelize, 'tipo_equipo_personalizados', {
        nombre: tipo.nombre,
        usuario_id: adminId,
        sucursal_id: sucursalIds[suc.clave],
        activo: true,
        created_at: ahora,
        updated_at: ahora
      });
      tipoIds[suc.clave + ':' + tipo.clave] = tipoId;
      chequeosPorTipo[suc.clave + ':' + tipo.clave] = tipo.chequeos;

      let orden = 0;
      for (const texto of tipo.chequeos) {
        await insertarYObtenerId(sequelize, 'chequeo_personalizados', {
          tipo_equipo_personalizado_id: tipoId,
          texto,
          opciones: JSON.stringify(OPCIONES_CHEQUEO),
          orden: orden++,
          created_at: ahora,
          updated_at: ahora
        });
      }
    }
  }

  const clienteIds = {};
  for (const cli of CLIENTES) {
    clienteIds[cli.clave] = await insertarYObtenerId(sequelize, 'clientes', {
      taller_id: tallerId,
      nombre: cli.nombre,
      apellido: cli.apellido,
      dni_cuit: cli.dniCuit,
      telefono: cli.telefono,
      email: cli.email,
      direccion: cli.direccion,
      fecha_nacimiento: null,
      es_gremio: cli.esGremio === true,
      nombre_gremio: cli.nombreGremio || null,
      cuenta_corriente_habilitada: cli.cuentaCorriente === true,
      created_at: ahora,
      updated_at: ahora
    });
  }

  const equipoIds = {};
  const equipoPorClave = {};
  for (const eq of EQUIPOS) {
    equipoPorClave[eq.clave] = eq;
    equipoIds[eq.clave] = await insertarYObtenerId(sequelize, 'equipos', {
      taller_id: tallerId,
      cliente_id: clienteIds[eq.cliente],
      tipo_equipo_personalizado_id: tipoIds[eq.sucursal + ':' + eq.tipo],
      marca: eq.marca,
      modelo: eq.modelo,
      color: eq.color,
      numero_serie: eq.serie,
      clave_desbloqueo_enc: null,
      cuenta_usuario_enc: null,
      cuenta_password_enc: null,
      created_at: ahora,
      updated_at: ahora
    });
  }

  let numero = NUMERO_ORDEN_BASE;
  // De más vieja a más nueva, para que la numeración siga el orden cronológico.
  const ordenesOrdenadas = [...ORDENES].sort((a, b) => b.diasAtras - a.diasAtras);

  for (const ord of ordenesOrdenadas) {
    numero += 1;
    const equipo = equipoPorClave[ord.equipo];
    const ingreso = haceDias(ord.diasAtras);
    const estadoFinal = ord.historial[ord.historial.length - 1];
    const entregada = estadoFinal === 'entregado';

    const ordenId = await insertarYObtenerId(sequelize, 'ordenes', {
      taller_id: tallerId,
      numero_orden: 'ORD-' + String(numero).padStart(6, '0'),
      codigo_seguimiento: codigoSeguimiento(),
      cliente_id: clienteIds[equipo.cliente],
      equipo_id: equipoIds[ord.equipo],
      sucursal_id: sucursalIds[ord.sucursal],
      tecnico_id: usuarioIds[ord.tecnico],
      estado: estadoFinal,
      fecha_ingreso: ingreso,
      fecha_pactada: soloFecha(haceDias(ord.diasAtras - 7)),
      detalles_esteticos: ord.esteticos || null,
      reparacion_solicitada: ord.reparacion,
      notas_internas: ord.notas || null,
      presupuesto_monto: ord.presupuesto || null,
      presupuesto_aprobado: ord.aprobado === undefined ? null : ord.aprobado,
      firma_cliente_url: null,
      monto_total: ord.montoTotal || null,
      monto_abonado: ord.montoAbonado || null,
      credito_aplicado: null,
      fecha_entrega: entregada ? haceDias(Math.max(ord.diasAtras - 9, 0)) : null,
      created_at: ingreso,
      updated_at: ahora
    });

    // Historial: un salto por transición, repartido entre el ingreso y hoy.
    let anterior = null;
    let paso = 0;
    for (const estado of ord.historial) {
      const fecha = haceDias(Math.max(ord.diasAtras - paso * 2, 0));
      await insertarYObtenerId(sequelize, 'orden_historial_estados', {
        orden_id: ordenId,
        estado_anterior: anterior,
        estado_nuevo: estado,
        usuario_id: usuarioIds[ord.tecnico],
        comentario: null,
        created_at: fecha
      });
      anterior = estado;
      paso += 1;
    }

    // Checklist de recepción, con las opciones congeladas al momento del ingreso.
    const fallados = ord.chequeosFallados || [];
    const items = chequeosPorTipo[ord.sucursal + ':' + equipo.tipo];
    let ordenItem = 0;
    for (const item of items) {
      await insertarYObtenerId(sequelize, 'orden_chequeos', {
        orden_id: ordenId,
        item,
        resultado: fallados.includes(item) ? 'No' : 'Sí',
        opciones: JSON.stringify(OPCIONES_CHEQUEO),
        orden: ordenItem++,
        created_at: ingreso,
        updated_at: ingreso
      });
    }
  }

  // El contador arranca donde terminó la siembra: la próxima orden que cargue
  // un visitante sigue la numeración en vez de chocar con una existente.
  await sequelize.query(
    'INSERT INTO contadores (clave, valor, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) ' +
      'ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()',
    { replacements: ['orden:' + tallerId, numero] }
  );

  const stock = await crearStockYVentas(sequelize, { tallerId, sucursalIds, usuarioIds, clienteIds });

  return {
    tallerId,
    ordenes: ORDENES.length,
    clientes: CLIENTES.length,
    equipos: EQUIPOS.length,
    stock: stock.equipos,
    ventas: VENTAS.length
  };
}

/**
 * El stock y las ventas de la demo, armados como los arma la app: los equipos
 * apartados o vendidos cambian de estado, lo que deja el cliente en parte de
 * pago entra al stock y la plata queda en `venta_pagos` (es lo que suma la caja).
 */
async function crearStockYVentas(sequelize, { tallerId, sucursalIds, usuarioIds, clienteIds }) {
  const ahora = new Date();
  let numeroStock = 0;
  let indiceImei = 0;

  /** Inserta un equipo en el stock con el próximo número y devuelve su id. */
  async function ingresar(datos) {
    numeroStock += 1;
    indiceImei += 1;
    return insertarYObtenerId(sequelize, 'equipos_stock', {
      taller_id: tallerId,
      sucursal_id: datos.sucursalId,
      numero: numeroStock,
      marca: datos.marca,
      modelo: datos.modelo,
      color: datos.color || null,
      almacenamiento_gb: datos.gb || null,
      condicion: datos.condicion,
      bateria: datos.condicion === 'usado' ? datos.bateria : null,
      numero_serie: null,
      // Todo el stock de la demo son celulares.
      imei: imeiDemo(indiceImei),
      imei2: null,
      fecha_compra: soloFecha(datos.fecha),
      proveedor: datos.proveedor,
      moneda_costo: datos.monedaCosto,
      costo: datos.costo,
      cotizacion_costo: datos.monedaCosto === 'USD' ? null : datos.cotizacionCosto,
      costo_reparaciones_usd: datos.costoReparacionesUsd || 0,
      moneda_precio: 'USD',
      precio: datos.precio,
      estado: datos.estado || 'disponible',
      observaciones: datos.observaciones || null,
      cargado_por_id: usuarioIds.admin,
      baja_en: datos.baja ? datos.baja.fecha : null,
      baja_por_id: datos.baja ? usuarioIds.admin : null,
      motivo_baja: datos.baja ? datos.baja.motivo : null,
      recibido_en_venta_id: datos.recibidoEnVentaId || null,
      created_at: datos.fecha,
      updated_at: ahora
    });
  }

  // El estado de cada equipo según la venta en la que está.
  const ESTADO_EQUIPO = { completada: 'vendido', senada: 'senado', reservada: 'reservado' };
  const estadoPorEquipo = {};
  for (const venta of VENTAS) {
    for (const item of venta.items) estadoPorEquipo[item.equipo] = ESTADO_EQUIPO[venta.estado];
  }

  const stockIds = {};
  for (const eq of STOCK) {
    const monedaCosto = eq.monedaCosto || 'USD';
    const costos = (eq.costos || []).map((c) => {
      const moneda = c.moneda || 'USD';
      return { ...c, moneda, montoUsd: aDolares(c.monto, moneda, c.cotizacion) };
    });
    stockIds[eq.clave] = await ingresar({
      ...eq,
      sucursalId: sucursalIds[eq.sucursal],
      fecha: haceDias(eq.diasCompra),
      monedaCosto,
      costoReparacionesUsd: redondear(costos.reduce((t, c) => t + c.montoUsd, 0)),
      estado: eq.baja ? 'baja' : estadoPorEquipo[eq.clave],
      baja: eq.baja && { fecha: haceDias(eq.baja.diasAtras), motivo: eq.baja.motivo }
    });

    for (const c of costos) {
      await insertarYObtenerId(sequelize, 'equipo_stock_costos', {
        taller_id: tallerId,
        equipo_stock_id: stockIds[eq.clave],
        concepto: c.concepto,
        fecha: soloFecha(haceDias(c.diasAtras)),
        moneda: c.moneda,
        monto: c.monto,
        cotizacion: c.moneda === 'USD' ? null : c.cotizacion,
        monto_usd: c.montoUsd,
        usuario_id: usuarioIds.admin,
        created_at: haceDias(c.diasAtras),
        updated_at: haceDias(c.diasAtras)
      });
    }
  }

  // De la más vieja a la más nueva, para que la numeración siga el orden cronológico.
  const ventasOrdenadas = [...VENTAS].sort((a, b) => b.diasAtras - a.diasAtras);
  let numeroVenta = 0;
  for (const v of ventasOrdenadas) {
    numeroVenta += 1;
    const fecha = haceDias(v.diasAtras);
    const sucursalId = sucursalIds[v.sucursal];
    const vendedorId = usuarioIds[v.vendedor];
    const subtotal = v.items.reduce((t, i) => t + i.precio, 0);
    const descuento = v.descuento ? v.descuento.valor : 0;
    const total = subtotal - descuento;
    const partePago = v.partePago ? v.partePago.monto : 0;

    const pagos = v.pagos.map((p) => {
      const moneda = p.moneda || v.moneda;
      const equivalente =
        moneda === v.moneda
          ? p.monto
          : redondear(moneda === 'USD' ? p.monto * p.cotizacion : p.monto / p.cotizacion);
      return { ...p, moneda, equivalente };
    });
    const pagado = redondear(pagos.reduce((t, p) => t + p.equivalente, 0));
    if (v.estado === 'completada' && Math.abs(pagado - (total - partePago)) >= 0.005) {
      throw new Error('Demo: los pagos de VTA-' + numeroVenta + ' no cubren lo que se paga en plata.');
    }

    const ventaId = await insertarYObtenerId(sequelize, 'ventas', {
      taller_id: tallerId,
      sucursal_id: sucursalId,
      numero: numeroVenta,
      cliente_id: clienteIds[v.cliente],
      estado: v.estado,
      moneda: v.moneda,
      cotizacion: v.cotizacion || null,
      subtotal,
      descuento_tipo: v.descuento ? v.descuento.tipo : null,
      descuento_valor: v.descuento ? v.descuento.valor : null,
      descuento,
      total,
      parte_pago: partePago,
      reservada_hasta: v.reservadaPorDias ? soloFecha(haceDias(-v.reservadaPorDias)) : null,
      comentario_cliente: v.comentarioCliente || null,
      comentario_interno: null,
      vendedor_id: vendedorId,
      completada_en: v.estado === 'completada' ? fecha : null,
      created_at: fecha,
      updated_at: fecha
    });

    for (const item of v.items) {
      await insertarYObtenerId(sequelize, 'venta_items', {
        venta_id: ventaId,
        equipo_stock_id: stockIds[item.equipo],
        precio: item.precio,
        created_at: fecha,
        updated_at: fecha
      });
    }

    for (const p of pagos) {
      await insertarYObtenerId(sequelize, 'venta_pagos', {
        taller_id: tallerId,
        sucursal_id: sucursalId,
        venta_id: ventaId,
        tipo: v.estado === 'completada' ? 'pago' : 'sena',
        monto: p.monto,
        moneda: p.moneda,
        cotizacion: p.moneda === v.moneda ? null : p.cotizacion,
        equivalente: p.equivalente,
        medio_pago: p.medio,
        usuario_id: vendedorId,
        nota: null,
        created_at: fecha,
        updated_at: fecha
      });
    }

    if (v.partePago) {
      const parte = v.partePago;
      const equipoStockId = await ingresar({
        sucursalId,
        marca: parte.marca,
        modelo: parte.modelo,
        color: parte.color,
        gb: parte.gb,
        condicion: 'usado',
        bateria: parte.bateria,
        fecha,
        proveedor: 'Parte de pago',
        monedaCosto: v.moneda,
        costo: parte.monto,
        cotizacionCosto: v.cotizacion || null,
        precio: parte.precio,
        observaciones: [
          'Lo dejó el cliente en VTA-' + String(numeroVenta).padStart(6, '0') + '.',
          parte.observaciones
        ]
          .filter(Boolean)
          .join(' '),
        recibidoEnVentaId: ventaId
      });
      await insertarYObtenerId(sequelize, 'venta_partes_pago', {
        venta_id: ventaId,
        marca: parte.marca,
        modelo: parte.modelo,
        color: parte.color,
        almacenamiento_gb: parte.gb,
        condicion: 'usado',
        bateria: parte.bateria,
        numero_serie: null,
        imei: imeiDemo(indiceImei),
        imei2: null,
        monto: parte.monto,
        observaciones: parte.observaciones || null,
        equipo_stock_id: equipoStockId,
        created_at: fecha,
        updated_at: fecha
      });
    }
  }

  // Los contadores siguen donde terminó la siembra, como el de las órdenes.
  for (const [clave, valor] of [
    ['stock:' + tallerId, numeroStock],
    ['venta:' + tallerId, numeroVenta]
  ]) {
    await sequelize.query(
      'INSERT INTO contadores (clave, valor, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) ' +
        'ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_at = NOW()',
      { replacements: [clave, valor] }
    );
  }

  return { equipos: numeroStock };
}

module.exports = {
  TALLER_NOMBRE,
  DEMO_EMAIL,
  TECNICO_EMAIL,
  DEMO_PASSWORD,
  buscarTallerDemo,
  borrarDemo,
  crearDemo
};

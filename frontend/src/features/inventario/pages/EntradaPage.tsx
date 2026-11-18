import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { X } from 'lucide-react';
import { AlertaError } from '@/shared/components/AlertaError';
import { BuscadorConSugerencias } from '@/shared/components/BuscadorConSugerencias';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Articulo } from '@/shared/types';
import { aNumero, formatearMonto, redondear } from '@/shared/utils/dinero';
import { textoONull } from '@/shared/utils/texto';
import * as inventarioApi from '../api';
import { DatosCompra, type ValorCompra } from '../components/DatosCompra';

interface Linea {
  articulo: Pick<Articulo, 'id' | 'codigo' | 'nombre'>;
  cantidad: string;
  costo: string;
}

/**
 * Una compra de productos que ya están en el inventario: una línea por
 * producto. Cada línea entra como una entrada con su costo, en la sucursal en
 * la que se está. El escáner agrega el producto por su código de barras.
 */
export function EntradaPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const articuloInicial = Number(params.get('articulo')) || null;
  const [error, setError] = useState<string | null>(null);
  const { enCurso, ejecutar } = useAccion(setError);

  const [compra, setCompra] = useState<ValorCompra>({
    moneda: 'USD',
    cotizacion: '',
    proveedor: '',
    nota: ''
  });
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [texto, setTexto] = useState('');
  const buscado = useDebounce(texto);

  const { datos: inicial } = useConsulta(
    () => (articuloInicial ? inventarioApi.obtenerArticulo(articuloInicial) : Promise.resolve(null)),
    [articuloInicial],
    'No se pudo cargar el producto'
  );
  // El producto desde el que se vino entra como primera línea, una sola vez.
  const inicialAgregado = useRef(false);
  useEffect(() => {
    if (inicialAgregado.current || !inicial || inicial.tipo === 'servicio') return;
    inicialAgregado.current = true;
    setLineas((actuales) => (actuales.length ? actuales : [{ articulo: inicial, cantidad: '', costo: '' }]));
  }, [inicial]);

  const { datos: resultados } = useConsulta(
    () =>
      buscado.trim().length < 2
        ? Promise.resolve(null)
        : inventarioApi.listarArticulos({ tipo: 'productos', search: buscado.trim() }),
    [buscado],
    'No se pudieron buscar los productos'
  );
  const sugerencias = (resultados?.articulos ?? []).filter(
    (a) => !lineas.some((l) => l.articulo.id === a.id)
  );

  function agregar(articulo: Linea['articulo']) {
    if (lineas.some((l) => l.articulo.id === articulo.id)) return;
    setLineas([...lineas, { articulo, cantidad: '', costo: '' }]);
    setTexto('');
  }

  const total = redondear(lineas.reduce((t, l) => t + aNumero(l.cantidad) * aNumero(l.costo), 0));

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.length === 0) return setError('Agregá al menos un producto.');
    if (lineas.some((l) => aNumero(l.cantidad) <= 0)) return setError('Cada línea necesita una cantidad.');
    if (compra.moneda !== 'USD' && aNumero(compra.cotizacion) <= 0) {
      return setError('Indicá la cotización: el costo se informa en dólares.');
    }
    await ejecutar(async () => {
      await inventarioApi.cargarEntrada({
        moneda: compra.moneda,
        cotizacion: compra.moneda === 'USD' ? null : aNumero(compra.cotizacion),
        proveedor: textoONull(compra.proveedor),
        nota: textoONull(compra.nota),
        lineas: lineas.map((l) => ({
          articuloId: l.articulo.id,
          cantidad: Math.round(aNumero(l.cantidad)),
          costo: aNumero(l.costo)
        }))
      });
      navigate(lineas.length === 1 ? `/inventario/articulos/${lineas[0].articulo.id}` : '/inventario');
    }, 'No se pudo cargar la entrada');
  }

  return (
    <Form onSubmit={guardar} style={{ maxWidth: 960 }}>
      <div className="mb-3">
        <Link to="/inventario" className="small">
          ← Inventario
        </Link>
        <h3 className="mb-0 mt-1">Nueva entrada</h3>
        <p className="text-muted mb-0">
          Una compra de productos que ya tenés cargados. Cada línea queda como una entrada con lo que costó.
        </p>
      </div>

      <AlertaError error={error} onCerrar={() => setError(null)} />

      <Card className="mb-3">
        <Card.Header>Compra</Card.Header>
        <Card.Body>
          <DatosCompra id="entrada" valor={compra} onChange={setCompra} />
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header>Productos</Card.Header>
        <Card.Body>
          {lineas.length > 0 && (
            <Row className="g-2 small fw-semibold text-muted text-uppercase d-none d-md-flex mb-1">
              <Col md={6}>Producto</Col>
              <Col md={2}>Cantidad</Col>
              <Col md={2}>Costo c/u ({compra.moneda})</Col>
              <Col md={2}>Subtotal</Col>
            </Row>
          )}
          {lineas.map((l, i) => (
            <Row key={l.articulo.id} className="g-2 mb-2 align-items-center">
              <Col xs={12} md={6}>
                <span className="font-mono small text-muted me-2">{l.articulo.codigo}</span>
                {l.articulo.nombre}
              </Col>
              <Col xs={4} md={2}>
                <Form.Control
                  type="number"
                  min={1}
                  required
                  aria-label={`Cantidad de ${l.articulo.nombre}`}
                  value={l.cantidad}
                  onChange={(e) =>
                    setLineas(lineas.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)))
                  }
                />
              </Col>
              <Col xs={4} md={2}>
                <Form.Control
                  inputMode="decimal"
                  required
                  aria-label={`Costo por unidad de ${l.articulo.nombre}`}
                  value={l.costo}
                  onChange={(e) =>
                    setLineas(lineas.map((x, j) => (j === i ? { ...x, costo: e.target.value } : x)))
                  }
                />
              </Col>
              <Col xs={3} md={1} className="text-nowrap">
                {formatearMonto(aNumero(l.cantidad) * aNumero(l.costo), compra.moneda)}
              </Col>
              <Col xs={1} className="text-end">
                <Button
                  variant="link"
                  className="text-secondary p-1"
                  aria-label={`Quitar ${l.articulo.nombre}`}
                  onClick={() => setLineas(lineas.filter((_, j) => j !== i))}
                >
                  <X size={18} aria-hidden="true" />
                </Button>
              </Col>
            </Row>
          ))}
          <BuscadorConSugerencias
            texto={texto}
            onTextoChange={setTexto}
            sugerencias={sugerencias}
            claveDe={(a) => a.id}
            mostrar={(a) => (
              <>
                <span className="font-mono small text-muted me-2">{a.codigo}</span>
                {a.nombre}
                <span className="small text-muted"> · hay {a.cantidad}</span>
              </>
            )}
            onElegir={agregar}
            placeholder="Buscar un producto por nombre, código o código de barras"
          />
          <Form.Text>
            ¿Es un producto nuevo? <Link to="/inventario/nuevo?tipo=repuesto">Cargalo primero</Link>.
          </Form.Text>
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <span>
          <span className="text-muted">Total de la compra: </span>
          <strong>{formatearMonto(total, compra.moneda)}</strong>
        </span>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button type="submit" disabled={enCurso}>
            {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar entrada'}
          </Button>
        </div>
      </div>
    </Form>
  );
}

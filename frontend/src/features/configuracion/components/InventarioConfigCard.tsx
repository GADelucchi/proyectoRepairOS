import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button, Card, Col, Form, InputGroup, Row, Spinner } from 'react-bootstrap';
import { useLocation } from 'react-router';
import { X } from 'lucide-react';
import * as inventarioApi from '@/features/inventario/api';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { CategoriaInventario, ConfigInventario, TipoArticulo } from '@/shared/types';

interface InventarioConfigCardProps {
  onError: (mensaje: string) => void;
  onGuardado: (mensaje: string) => void;
}

const GRUPOS: { grupo: TipoArticulo; titulo: string }[] = [
  { grupo: 'repuesto', titulo: 'Productos › Repuestos' },
  { grupo: 'accesorio', titulo: 'Productos › Accesorios' },
  { grupo: 'servicio', titulo: 'Servicios' }
];

/**
 * Configuración del inventario (admin): los nombres de los precios (hasta 3),
 * el stock mínimo con el que arranca cada producto, a quién se avisa cuando
 * una sucursal queda por debajo, los prefijos de los códigos y las categorías
 * propias (el tercer nivel: los dos primeros son fijos).
 */
export function InventarioConfigCard({ onError, onGuardado }: InventarioConfigCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();
  const { datos, recargar } = useConsulta(
    () => inventarioApi.obtenerConfig(),
    [],
    'No se pudo cargar la configuración del inventario',
    'inventario-config'
  );
  const [config, setConfig] = useState<ConfigInventario | null>(null);
  const { enCurso, ejecutar } = useAccion(onError);

  useEffect(() => {
    if (datos) setConfig(datos.config);
  }, [datos]);
  useEffect(() => {
    if (hash === '#inventario' && datos) ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, datos]);

  if (!config) return null;

  const precios = [0, 1, 2].map((i) => config.precios[i] ?? null);
  const usados = precios.filter((p) => p !== null).length;

  function cambiarPrecio(i: number, valor: string | null) {
    setConfig({ ...config!, precios: precios.map((p, j) => (j === i ? valor : p)) });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (precios.every((p) => !p?.trim())) return onError('Dejá al menos un precio.');
    const ok = await ejecutar(
      () => inventarioApi.guardarConfig({ ...config!, precios: precios.map((p) => p?.trim() || null) }),
      'No se pudo guardar la configuración del inventario'
    );
    if (ok) {
      onGuardado('Configuración del inventario guardada');
      recargar();
    }
  }

  return (
    <Card className="mb-3" ref={ref} id="inventario">
      <Card.Header>Inventario</Card.Header>
      <Card.Body>
        <Row className="g-4">
          <Col lg={6}>
            <Form onSubmit={guardar}>
              <h6>Precios</h6>
              <p className="small text-muted">
                Hasta 3, para todos los productos y servicios. El monto de cada uno se carga en el producto.
                Si borrás uno, deja de mostrarse (los montos cargados se guardan).
              </p>
              {precios.map((p, i) =>
                p === null ? null : (
                  <InputGroup key={i} className="mb-2">
                    <InputGroup.Text>{i + 1}</InputGroup.Text>
                    <Form.Control
                      aria-label={`Nombre del precio ${i + 1}`}
                      maxLength={30}
                      value={p}
                      onChange={(e) => cambiarPrecio(i, e.target.value)}
                    />
                    <Button
                      variant="outline-secondary"
                      aria-label={`Borrar el precio ${p}`}
                      disabled={usados === 1}
                      onClick={() => cambiarPrecio(i, null)}
                    >
                      <X size={16} aria-hidden="true" />
                    </Button>
                  </InputGroup>
                )
              )}
              {usados < 3 && (
                <Button
                  size="sm"
                  variant="outline-primary"
                  className="mb-3"
                  onClick={() =>
                    cambiarPrecio(
                      precios.findIndex((p) => p === null),
                      ''
                    )
                  }
                >
                  + Agregar precio
                </Button>
              )}

              <h6 className="mt-3">Stock mínimo</h6>
              <Form.Group controlId="inv-minimo" className="mb-2" style={{ maxWidth: 260 }}>
                <Form.Label className="small">Con el que arranca cada producto nuevo</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  value={config.stockMinimoPorDefecto}
                  onChange={(e) =>
                    setConfig({ ...config, stockMinimoPorDefecto: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </Form.Group>
              <div className="small fw-semibold mb-1">Cuando una sucursal queda por debajo, avisar:</div>
              <Form.Check
                id="inv-aviso-app"
                label="En la app, a la gente de esa sucursal"
                checked={config.avisoApp}
                onChange={(e) => setConfig({ ...config, avisoApp: e.target.checked })}
              />
              <Form.Check
                id="inv-aviso-email"
                className="mb-3"
                label="Por correo, a los admins"
                checked={config.avisoEmail}
                onChange={(e) => setConfig({ ...config, avisoEmail: e.target.checked })}
              />

              <h6>Códigos</h6>
              <Row className="g-2 mb-3">
                {(['repuesto', 'accesorio', 'servicio'] as const).map((tipo) => (
                  <Col key={tipo} xs={4}>
                    <Form.Group controlId={`inv-prefijo-${tipo}`}>
                      <Form.Label className="small text-capitalize">
                        {tipo === 'repuesto'
                          ? 'Repuestos'
                          : tipo === 'accesorio'
                            ? 'Accesorios'
                            : 'Servicios'}
                      </Form.Label>
                      <Form.Control
                        className="font-mono"
                        maxLength={10}
                        value={config.prefijos[tipo]}
                        onChange={(e) =>
                          setConfig({ ...config, prefijos: { ...config.prefijos, [tipo]: e.target.value } })
                        }
                      />
                    </Form.Group>
                  </Col>
                ))}
              </Row>
              <Button type="submit" disabled={enCurso}>
                {enCurso ? <Spinner size="sm" animation="border" /> : 'Guardar'}
              </Button>
            </Form>
          </Col>
          <Col lg={6}>
            <h6>Categorías</h6>
            <p className="small text-muted">
              Producto o servicio, y repuesto o accesorio, son fijos. Adentro armás las tuyas: Baterías,
              Módulos, Flexs…
            </p>
            {GRUPOS.map(({ grupo, titulo }) => (
              <Categorias
                key={grupo}
                grupo={grupo}
                titulo={titulo}
                categorias={(datos?.categorias ?? []).filter((c) => c.grupo === grupo)}
                onCambio={(mensaje) => {
                  onGuardado(mensaje);
                  recargar();
                }}
                onError={onError}
              />
            ))}
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
}

function Categorias({
  grupo,
  titulo,
  categorias,
  onCambio,
  onError
}: {
  grupo: TipoArticulo;
  titulo: string;
  categorias: CategoriaInventario[];
  onCambio: (mensaje: string) => void;
  onError: (mensaje: string) => void;
}) {
  const [nueva, setNueva] = useState('');
  const { enCurso, ejecutar } = useAccion(onError);

  async function agregar() {
    if (!nueva.trim()) return;
    const ok = await ejecutar(
      () => inventarioApi.crearCategoria(grupo, nueva.trim()),
      'No se pudo crear la categoría'
    );
    if (ok) {
      setNueva('');
      onCambio('Categoría creada');
    }
  }

  async function renombrar(c: CategoriaInventario) {
    const nombre = window.prompt('Nuevo nombre', c.nombre)?.trim();
    if (!nombre || nombre === c.nombre) return;
    const ok = await ejecutar(() => inventarioApi.renombrarCategoria(c.id, nombre), 'No se pudo renombrar');
    if (ok) onCambio('Categoría renombrada');
  }

  async function borrar(c: CategoriaInventario) {
    if (!window.confirm(`¿Borrar la categoría "${c.nombre}"?`)) return;
    const ok = await ejecutar(() => inventarioApi.borrarCategoria(c.id), 'No se pudo borrar');
    if (ok) onCambio('Categoría borrada');
  }

  return (
    <div className="mb-3">
      <div className="fw-semibold small mb-1">{titulo}</div>
      {categorias.map((c) => (
        <div key={c.id} className="d-flex justify-content-between align-items-center border-bottom py-1 ps-2">
          <span>
            {c.nombre} <span className="small text-muted">· {c.articulos}</span>
          </span>
          <span className="d-flex gap-1">
            <Button size="sm" variant="link" onClick={() => renombrar(c)} disabled={enCurso}>
              Renombrar
            </Button>
            {c.articulos === 0 && (
              <Button
                size="sm"
                variant="link"
                className="text-danger"
                onClick={() => borrar(c)}
                disabled={enCurso}
              >
                Borrar
              </Button>
            )}
          </span>
        </div>
      ))}
      <InputGroup size="sm" className="mt-2">
        <Form.Control
          aria-label={`Nueva categoría de ${titulo}`}
          placeholder="Nueva categoría"
          maxLength={100}
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              agregar();
            }
          }}
        />
        <Button variant="outline-primary" onClick={agregar} disabled={enCurso || !nueva.trim()}>
          Agregar
        </Button>
      </InputGroup>
    </div>
  );
}

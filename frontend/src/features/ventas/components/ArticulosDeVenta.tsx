import { useState } from 'react';
import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap';
import { Trash2 } from 'lucide-react';
import * as inventarioApi from '@/features/inventario/api';
import { BADGE_TIPO, ETIQUETA_TIPO } from '@/features/inventario/inventario';
import { BuscadorConSugerencias } from '@/shared/components/BuscadorConSugerencias';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Articulo, Moneda } from '@/shared/types';
import { aNumero, formatearMonto } from '@/shared/utils/dinero';
import { type ArticuloVentaForm, precioDeArticulo } from '../venta-form';

interface ArticulosDeVentaProps {
  articulos: ArticuloVentaForm[];
  moneda: Moneda;
  cotizacion: number;
  onChange: (articulos: ArticuloVentaForm[]) => void;
}

/**
 * Accesorios y repuestos sueltos en la venta, con cantidad y el precio que se
 * elija (Lista, Efectivo, Tarjeta… o uno escrito a mano). Las unidades salen
 * del stock de la sucursal al confirmar, de la entrada más vieja.
 */
export function ArticulosDeVenta({ articulos, moneda, cotizacion, onChange }: ArticulosDeVentaProps) {
  const [texto, setTexto] = useState('');
  const buscado = useDebounce(texto);
  const { datos } = useConsulta(
    () =>
      buscado.trim().length < 2
        ? Promise.resolve(null)
        : inventarioApi.listarArticulos({ tipo: 'productos', search: buscado.trim() }),
    [buscado],
    'No se pudo buscar en el inventario'
  );
  const sugerencias = (datos?.articulos ?? []).filter(
    (a) => (a.cantidad ?? 0) > 0 && !articulos.some((x) => x.articulo.id === a.id)
  );

  function agregar(articulo: Articulo) {
    // Arranca con el primer precio que se pueda pasar a la moneda de la venta.
    const posicion =
      articulo.precios.find((p) => precioDeArticulo(articulo, p.posicion, moneda, cotizacion) !== null)
        ?.posicion ?? null;
    const precio = posicion ? precioDeArticulo(articulo, posicion, moneda, cotizacion) : null;
    onChange([
      ...articulos,
      { articulo, cantidad: '1', precio: precio != null ? String(precio) : '', posicion }
    ]);
    setTexto('');
  }

  function cambiar(i: number, cambios: Partial<ArticuloVentaForm>) {
    onChange(articulos.map((a, j) => (j === i ? { ...a, ...cambios } : a)));
  }

  return (
    <div className="mt-3">
      <BuscadorConSugerencias
        texto={texto}
        onTextoChange={setTexto}
        sugerencias={sugerencias}
        claveDe={(a) => a.id}
        mostrar={(a) => (
          <>
            <span className={`badge ${BADGE_TIPO[a.tipo]} me-2`}>{ETIQUETA_TIPO[a.tipo]}</span>
            {a.nombre}
            <span className="small text-muted"> · hay {a.cantidad}</span>
          </>
        )}
        onElegir={agregar}
        placeholder="Agregar un accesorio o repuesto"
      />
      {articulos.map((a, i) => {
        const conPrecio = a.articulo.precios.filter((p) => p.monto != null && p.moneda);
        return (
          <div key={a.articulo.id} className="border rounded p-2 mt-3">
            <div className="d-flex justify-content-between gap-2">
              <div>
                <span className={`badge ${BADGE_TIPO[a.articulo.tipo]} me-2`}>
                  {ETIQUETA_TIPO[a.articulo.tipo]}
                </span>
                <span className="fw-semibold">{a.articulo.nombre}</span>
                <div className="small text-muted">
                  <span className="font-mono">{a.articulo.codigo}</span> · hay {a.articulo.cantidad}
                </div>
              </div>
              <Button
                variant="link"
                className="text-danger p-0"
                aria-label={`Quitar ${a.articulo.nombre} de la venta`}
                onClick={() => onChange(articulos.filter((_, j) => j !== i))}
              >
                <Trash2 size={18} aria-hidden />
              </Button>
            </div>
            <Row className="g-2 mt-1">
              <Col xs={4} sm={2}>
                <Form.Control
                  type="number"
                  min={1}
                  max={a.articulo.cantidad ?? undefined}
                  aria-label={`Cantidad de ${a.articulo.nombre}`}
                  value={a.cantidad}
                  onChange={(e) => cambiar(i, { cantidad: e.target.value })}
                />
              </Col>
              {conPrecio.length > 0 && (
                <Col xs={8} sm={5}>
                  <Form.Select
                    aria-label={`Precio de ${a.articulo.nombre}`}
                    value={a.posicion ?? ''}
                    onChange={(e) => {
                      const posicion = e.target.value ? Number(e.target.value) : null;
                      const precio = posicion
                        ? precioDeArticulo(a.articulo, posicion, moneda, cotizacion)
                        : null;
                      cambiar(i, { posicion, precio: precio != null ? String(precio) : a.precio });
                    }}
                  >
                    {conPrecio.map((p) => (
                      <option key={p.posicion} value={p.posicion}>
                        {p.nombre} · {formatearMonto(p.monto!, p.moneda!)}
                      </option>
                    ))}
                    <option value="">Otro precio</option>
                  </Form.Select>
                </Col>
              )}
              <Col xs={12} sm={conPrecio.length > 0 ? 5 : 10}>
                <InputGroup>
                  <InputGroup.Text>{moneda}</InputGroup.Text>
                  <Form.Control
                    aria-label={`Precio por unidad de ${a.articulo.nombre}`}
                    inputMode="decimal"
                    value={a.precio}
                    onChange={(e) => cambiar(i, { precio: e.target.value, posicion: null })}
                  />
                  <InputGroup.Text>c/u</InputGroup.Text>
                </InputGroup>
              </Col>
            </Row>
            {aNumero(a.cantidad) > 1 && aNumero(a.precio) > 0 && (
              <div className="small text-muted mt-1 text-end">
                {a.cantidad} × {formatearMonto(aNumero(a.precio), moneda)} ={' '}
                {formatearMonto(aNumero(a.precio) * aNumero(a.cantidad), moneda)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

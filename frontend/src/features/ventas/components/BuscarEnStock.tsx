import { useState } from 'react';
import { Button, ListGroup, Modal } from 'react-bootstrap';
import * as stockApi from '@/features/stock/api';
import { FormularioEquipoStock } from '@/features/stock/pages/EquipoStockPage';
import {
  describirEquipoStock,
  detalleCondicion,
  etiquetaNumero,
  soloDigitos
} from '@/features/stock/stock-form';
import { CampoEscaneable } from '@/shared/components/CampoEscaneable';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { EquipoStock } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';

interface BuscarEnStockProps {
  /** Los que ya están en la venta: no se ofrecen de nuevo. */
  excluir: number[];
  onElegir: (equipo: EquipoStock) => void;
  onError: (mensaje: string) => void;
}

/**
 * Busca un equipo disponible por IMEI, serial, número o modelo, tipeando o
 * escaneando la caja. Si lo escaneado coincide con un solo equipo, se agrega
 * directo. Si no está en el stock, se carga ahí mismo sin perder la venta.
 */
export function BuscarEnStock({ excluir, onElegir, onError }: BuscarEnStockProps) {
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);
  const busqueda = useDebounce(texto.trim(), 300);

  const { datos } = useConsulta(
    () =>
      busqueda.length >= 2
        ? stockApi.listarStock({ search: busqueda, estado: 'disponible' }).then((r) => r.equipos)
        : Promise.resolve([] as EquipoStock[]),
    [busqueda],
    'No se pudo buscar en el stock'
  );
  const resultados = (datos ?? []).filter((e) => !excluir.includes(e.id));

  function elegir(equipo: EquipoStock) {
    onElegir(equipo);
    setTexto('');
  }

  /** Con un código leído (cámara o lector USB), si identifica a un solo equipo, se agrega. */
  async function escaneado(valor: string) {
    setTexto(valor);
    try {
      const { equipos } = await stockApi.listarStock({ search: valor, estado: 'disponible' });
      const digitos = soloDigitos(valor);
      const exactos = equipos.filter(
        (e) =>
          !excluir.includes(e.id) &&
          (e.numeroSerie?.toLowerCase() === valor.toLowerCase() ||
            (digitos.length === 15 && (e.imei === digitos || e.imei2 === digitos)))
      );
      if (exactos.length === 1) elegir(exactos[0]);
    } catch {
      // Queda la búsqueda escrita: los resultados se ven abajo.
    }
  }

  return (
    <>
      <CampoEscaneable
        id="venta-buscar-stock"
        value={texto}
        onChange={setTexto}
        onEscaneado={escaneado}
        onEnter={() => texto.trim() && escaneado(texto.trim())}
        tituloEscaner="Escanear IMEI o serial"
        placeholder="IMEI, serial, #número o modelo"
      />
      {resultados.length > 0 && (
        <ListGroup className="mt-2">
          {resultados.slice(0, 8).map((e) => (
            <ListGroup.Item
              key={e.id}
              action
              onClick={() => elegir(e)}
              className="d-flex justify-content-between align-items-center gap-2"
            >
              <div>
                <div className="fw-semibold">
                  <span className="font-mono text-muted me-2">{etiquetaNumero(e.numero)}</span>
                  {describirEquipoStock(e)}
                </div>
                <div className="small text-muted">
                  {detalleCondicion(e)}
                  {e.imei && ` · IMEI …${e.imei.slice(-5)}`}
                  {e.numeroSerie && ` · ${e.numeroSerie}`}
                </div>
              </div>
              <div className="text-nowrap small">
                {e.precio != null && e.monedaPrecio ? formatearMonto(e.precio, e.monedaPrecio) : 'Sin precio'}
              </div>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {busqueda.length >= 2 && datos && resultados.length === 0 && (
        <p className="small text-muted mt-2 mb-0">No hay equipos disponibles que coincidan.</p>
      )}
      <Button variant="outline-secondary" size="sm" className="mt-2" onClick={() => setCargando(true)}>
        + No está en el stock: cargarlo ahora
      </Button>

      <Modal show={cargando} onHide={() => setCargando(false)} size="lg" fullscreen="md-down">
        <Modal.Header closeButton>
          <Modal.Title as="h5">Cargar equipo al stock</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cargando && (
            <FormularioEquipoStock
              equipo={null}
              onCancelar={() => setCargando(false)}
              onGuardado={(equipo) => {
                setCargando(false);
                if (equipo.estado === 'disponible') elegir(equipo);
                else onError('El equipo se cargó, pero no está disponible para vender.');
              }}
            />
          )}
        </Modal.Body>
      </Modal>
    </>
  );
}

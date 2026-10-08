import { Table } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router';
import { AvisarWhatsApp } from '@/features/ordenes/components/AvisarWhatsApp';
import { convertirDesdeBackend } from '@/shared/utils/fechas';
import { filaClickeable } from '@/shared/utils/filas';
import { datosAvisoDeLista, type ListaDeOrdenes } from '../api';

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const diasDesde = (fecha: string | null) =>
  fecha ? Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / MS_POR_DIA)) : null;

interface TablaOrdenesProps {
  lista: ListaDeOrdenes;
  vacio: string;
  /** Qué fecha mostrar: los días en el estado actual o la fecha pactada. */
  columna: 'dias' | 'pactada';
  conWhatsApp?: boolean;
}

/** Órdenes de las listas del tablero y los reportes, con acceso directo y aviso por WhatsApp. */
export function TablaOrdenes({ lista, vacio, columna, conWhatsApp = false }: TablaOrdenesProps) {
  const navigate = useNavigate();
  if (lista.ordenes.length === 0) return <p className="text-muted small p-3 mb-0">{vacio}</p>;

  return (
    <Table size="sm" hover responsive className="mb-0 align-middle">
      <tbody>
        {lista.ordenes.map((o) => {
          const dias = diasDesde(o.desde);
          return (
            <tr key={o.id} {...filaClickeable(() => navigate(`/ordenes/${o.id}`))}>
              <td>
                <Link to={`/ordenes/${o.id}`} className="font-mono small">
                  {o.numeroOrden}
                </Link>
                <div className="small">
                  {o.clienteNombre} {o.clienteApellido}
                </div>
                <div className="small text-muted">{`${o.marca ?? ''} ${o.modelo ?? ''}`.trim()}</div>
              </td>
              <td className="small text-end text-nowrap">
                {columna === 'pactada' ? (
                  <span className="text-danger">Pactada {convertirDesdeBackend(o.fechaPactada)}</span>
                ) : (
                  dias !== null && (
                    <span className={dias >= 7 ? 'text-warning fw-semibold' : 'text-muted'}>
                      {dias === 0 ? 'hoy' : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`}
                    </span>
                  )
                )}
              </td>
              {conWhatsApp && (
                <td className="text-end" style={{ width: 1 }}>
                  <AvisarWhatsApp datos={datosAvisoDeLista(o)} size="sm" texto="" />
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

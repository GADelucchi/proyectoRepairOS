import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { PackageCheck } from 'lucide-react';
import { listarTiposEquipo } from '@/features/configuracion/api';
import { useAccion } from '@/shared/hooks/useAccion';
import { useConsulta } from '@/shared/hooks/useConsulta';
import type { Orden, TercerizacionRecibida } from '@/shared/types';
import { formatearFecha } from '@/shared/utils/fechas';
import * as ordenesApi from '../../api';

interface RecepcionTercerizadaProps {
  orden: Orden;
  recibida: TercerizacionRecibida;
  onActualizada: (mensaje?: string) => void;
  onError: (mensaje: string) => void;
}

/**
 * En la orden que se le armó a este taller cuando otro le tercerizó un equipo:
 * quién lo manda y, mientras no llegó, el botón para confirmar que lo recibió.
 *
 * Al recibirlo se elige el tipo de equipo entre los de este taller: el que lo
 * manda puede llamarlo "iPhone" y acá ser "Celular", y no se crean tipos nuevos.
 * Con ese tipo se carga el checklist de este taller, sin responder: el chequeo
 * del que lo mandó no se copia. La orden queda en "Recibido", con quien lo
 * recibió como técnico, y se le avisa al taller que lo mandó.
 */
export function RecepcionTercerizada({ orden, recibida, onActualizada, onError }: RecepcionTercerizadaProps) {
  const { enCurso, ejecutar } = useAccion(onError);
  const porRecibir = orden.estado === 'por_recibir';
  const { datos: tipos } = useConsulta(
    () => (porRecibir ? listarTiposEquipo() : Promise.resolve([])),
    [porRecibir],
    'No se pudieron cargar los tipos de equipo'
  );
  const [tipoId, setTipoId] = useState<number | null>(orden.equipo?.tipoEquipo?.id ?? null);
  const quien = recibida.taller ?? 'Otro taller';
  const suOrden = recibida.numeroOrden ? ` (su orden ${recibida.numeroOrden})` : '';

  async function recibir() {
    if (!tipoId) return;
    const ok = await ejecutar(
      () => ordenesApi.recibirTercerizado(orden.id, tipoId),
      'No se pudo registrar la recepción'
    );
    if (ok) onActualizada(`Equipo recibido. Le avisamos a ${quien}. Completá el chequeo de recepción.`);
  }

  if (!porRecibir) {
    return (
      <Alert variant="secondary" className="py-2">
        Equipo tercerizado por <strong>{quien}</strong>
        {suOrden}.
      </Alert>
    );
  }

  return (
    <Alert variant="info">
      <strong>{quien}</strong> te manda este equipo{suOrden} el {formatearFecha(recibida.createdAt)}.
      <div className="small mb-2">
        Todavía no llegó. Cuando lo tengas, elegí con qué tipo de equipo lo cargás y confirmalo: se carga tu
        chequeo de recepción para que lo hagas con tu criterio.
      </div>
      <div className="d-flex gap-2 flex-wrap align-items-center">
        <Form.Select
          aria-label="Tipo de equipo"
          style={{ flex: '1 1 200px', maxWidth: 280 }}
          value={tipoId ?? ''}
          onChange={(e) => setTipoId(Number(e.target.value) || null)}
          disabled={enCurso}
        >
          <option value="">Tipo de equipo…</option>
          {(tipos ?? []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </Form.Select>
        <Button onClick={recibir} disabled={enCurso || !tipoId} className="d-inline-flex gap-2">
          {enCurso ? (
            <Spinner size="sm" animation="border" />
          ) : (
            <>
              <PackageCheck size={18} aria-hidden="true" /> Recibí el equipo
            </>
          )}
        </Button>
      </div>
    </Alert>
  );
}

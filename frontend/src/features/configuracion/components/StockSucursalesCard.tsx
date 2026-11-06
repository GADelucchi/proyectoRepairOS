import { Card, Form } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { useAccion } from '@/shared/hooks/useAccion';
import * as configuracionApi from '../api';

interface StockSucursalesCardProps {
  onError: (mensaje: string) => void;
  onGuardado: (mensaje: string) => void;
}

/** Si cada sucursal ve el stock de equipos de las demás (solo admin). */
export function StockSucursalesCard({ onError, onGuardado }: StockSucursalesCardProps) {
  const { usuario, refrescar } = useAuth();
  const compartido = usuario?.taller?.stockEntreSucursales ?? false;
  const { enCurso, ejecutar } = useAccion(onError);

  async function alternar(valor: boolean) {
    const ok = await ejecutar(async () => {
      await configuracionApi.actualizarTaller({ stockEntreSucursales: valor });
      await refrescar();
    }, 'No se pudo cambiar la opción');
    if (ok)
      onGuardado(valor ? 'Ahora se ve el stock de todas las sucursales' : 'Cada sucursal ve solo su stock');
  }

  return (
    <Card className="mb-4">
      <Card.Header>Stock entre sucursales</Card.Header>
      <Card.Body>
        <Form.Check
          type="switch"
          id="stock-entre-sucursales"
          label="Ver el stock de las otras sucursales"
          checked={compartido}
          disabled={enCurso}
          onChange={(e) => alternar(e.target.checked)}
        />
        <Form.Text className="text-muted">
          Apagado, cada sucursal ve solo lo suyo. Encendido, en Stock se puede elegir otra sucursal o todas.
        </Form.Text>
      </Card.Body>
    </Card>
  );
}

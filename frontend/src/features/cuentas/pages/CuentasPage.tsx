import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { AlertaError } from '@/shared/components/AlertaError';
import { Cargando } from '@/shared/components/Cargando';
import { useConsulta } from '@/shared/hooks/useConsulta';
import { useDebounce } from '@/shared/hooks/useDebounce';
import type { Moneda } from '@/shared/types';
import { formatearMonto } from '@/shared/utils/dinero';
import { formatearFechaHora } from '@/shared/utils/fechas';
import * as cuentasApi from '../api';
import { DetalleCuentaModal } from '../components/DetalleCuentaModal';

/**
 * Cuenta corriente: quién debe y cómo se le descuenta cuando paga.
 *
 * Por defecto solo lista a los que deben, que es la pregunta de todos los días.
 * El detalle de cada cuenta se abre en un modal con el historial completo y el
 * formulario de cobro, para no perder de vista el listado general.
 *
 * Los saldos van por moneda: quien debe pesos y dólares aparece en dos renglones.
 */
export function CuentasPage() {
  const [busqueda, setBusqueda] = useState('');
  const busquedaDebounced = useDebounce(busqueda);
  const [incluirAlDia, setIncluirAlDia] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [clienteAbierto, setClienteAbierto] = useState<number | null>(null);

  const { datos, cargando, error, recargar } = useConsulta(
    () => cuentasApi.listarCuentas({ search: busquedaDebounced || undefined, todos: incluirAlDia }),
    [busquedaDebounced, incluirAlDia],
    'No se pudieron cargar las cuentas'
  );
  const cuentas = datos?.cuentas ?? [];
  const totalesAdeudados = datos?.totalesAdeudados ?? [];

  function handleCobrado(nombre: string, monto: number, saldo: number, moneda: Moneda) {
    setClienteAbierto(null);
    const cobro = `Cobro de ${formatearMonto(monto, moneda)} registrado.`;
    setMensaje(
      saldo > 0
        ? `${cobro} ${nombre} queda debiendo ${formatearMonto(saldo, moneda)}.`
        : `${cobro} ${nombre} queda al día en ${moneda}.`
    );
    recargar();
  }

  return (
    <div>
      <Row className="align-items-center mb-3 g-2">
        <Col md>
          <h2 className="mb-0">Cuenta corriente</h2>
        </Col>
        <Col md="auto">
          <Card body className="py-2">
            <div className="text-muted small">Total adeudado</div>
            {totalesAdeudados.length === 0 ? (
              <div className="fs-4 fw-semibold">{formatearMonto(0)}</div>
            ) : (
              totalesAdeudados.map((t) => (
                <div key={t.moneda} className="fs-4 fw-semibold">
                  {formatearMonto(t.total, t.moneda)}
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      <AlertaError error={error} />
      {mensaje && (
        <Alert variant="success" dismissible onClose={() => setMensaje(null)}>
          {mensaje}
        </Alert>
      )}

      <Row className="align-items-center g-2 mb-3">
        <Col md={6}>
          <Form.Control
            placeholder="Buscar por nombre, DNI o teléfono..."
            aria-label="Buscar cuentas"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </Col>
        <Col md="auto">
          <Form.Check
            type="checkbox"
            id="incluir-al-dia"
            label="Mostrar también los que están al día"
            checked={incluirAlDia}
            onChange={(e) => setIncluirAlDia(e.target.checked)}
          />
        </Col>
      </Row>

      {cargando ? (
        <Cargando />
      ) : cuentas.length === 0 ? (
        <Alert variant="light" className="border">
          {busqueda
            ? 'Ningún cliente coincide con la búsqueda.'
            : incluirAlDia
              ? 'Todavía no hay clientes con cuenta corriente ni movimientos.'
              : 'Nadie debe nada. Todas las cuentas están al día.'}
        </Alert>
      ) : (
        <Table hover responsive className="align-middle">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Teléfono</th>
              <th className="text-end">Saldo</th>
              <th>Último movimiento</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {cuentas.map((cuenta) => (
              <tr key={`${cuenta.clienteId}-${cuenta.moneda}`}>
                <td>
                  {cuenta.apellido}, {cuenta.nombre}
                  {!cuenta.cuentaCorrienteHabilitada && cuenta.saldo > 0 && (
                    <Badge bg="warning" text="dark" className="ms-2">
                      sin cuenta habilitada
                    </Badge>
                  )}
                </td>
                <td className="text-muted">{cuenta.telefono ?? '—'}</td>
                <td className="text-end">
                  {cuenta.saldo < 0 ? (
                    <span className="text-success fw-semibold">
                      {formatearMonto(Math.abs(cuenta.saldo), cuenta.moneda)} a favor
                    </span>
                  ) : (
                    <span className={cuenta.saldo > 0 ? 'text-danger fw-semibold' : 'text-muted'}>
                      {formatearMonto(cuenta.saldo, cuenta.moneda)}
                    </span>
                  )}
                </td>
                <td className="text-muted small">
                  {cuenta.ultimoMovimiento ? formatearFechaHora(cuenta.ultimoMovimiento) : '—'}
                </td>
                <td className="text-end">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => setClienteAbierto(cuenta.clienteId)}
                  >
                    Ver cuenta
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {clienteAbierto !== null && (
        <DetalleCuentaModal
          clienteId={clienteAbierto}
          onCerrar={() => setClienteAbierto(null)}
          onCobrado={handleCobrado}
          onAjusteAplicado={recargar}
        />
      )}
    </div>
  );
}

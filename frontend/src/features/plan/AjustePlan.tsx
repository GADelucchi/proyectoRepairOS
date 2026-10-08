import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/useAuth';
import { apiClient, getApiErrorMessage } from '@/shared/api/client';
import { Cargando } from '@/shared/components/Cargando';
import type { ExcesoDelPlan } from '@/shared/types';
import { formatearFechaHora } from '@/shared/utils/fechas';
import { nombreCompleto } from '@/shared/utils/texto';

interface DatosAjuste {
  exceso: ExcesoDelPlan | null;
  usuarios: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    rol: string;
    ultimoAccesoAt: string | null;
  }[];
  sucursales: { id: number; nombre: string; direccion: string | null }[];
}

const excede = (u: { usados: number; maximo: number | null }) => u.maximo !== null && u.usados > u.maximo;

const cantidad = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

/** "1 sucursal y 2 usuarios": solo los recursos que el plan limita. */
const limites = (e: ExcesoDelPlan) =>
  [
    e.sucursales.maximo !== null && cantidad(e.sucursales.maximo, 'sucursal', 'sucursales'),
    e.usuarios.maximo !== null && cantidad(e.usuarios.maximo, 'usuario', 'usuarios')
  ]
    .filter(Boolean)
    .join(' y ');

/**
 * Pantalla para volver a entrar en el plan cuando el taller quedó excedido
 * (por ejemplo, al bajar de plan). El admin elige qué usuarios y sucursales
 * quedan activos; el resto se da de baja sin perder su historial.
 *
 * Mientras tanto, el resto del sistema no se puede usar: si no, alcanzaría con
 * contratar el plan chico para seguir usando todo lo del grande.
 */
export function AjustePlan() {
  const { usuario, esAdmin, refrescar, logout } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState<DatosAjuste | null>(null);
  const [usuarios, setUsuarios] = useState<number[]>([]);
  const [sucursales, setSucursales] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!esAdmin) return;
    apiClient
      .get<DatosAjuste>('/plan/exceso')
      .then(({ data }) => {
        setDatos(data);
        if (!data.exceso) return;
        // Propuesta inicial: el admin, y después los que usaron la app más recientemente.
        const porUso = [...data.usuarios].sort(
          (a, b) =>
            Number(b.id === usuario?.id) - Number(a.id === usuario?.id) ||
            (b.ultimoAccesoAt ?? '').localeCompare(a.ultimoAccesoAt ?? '')
        );
        setUsuarios(porUso.slice(0, data.exceso.usuarios.maximo ?? porUso.length).map((u) => u.id));
        const actual = data.sucursales.find((s) => s.id === usuario?.sucursalActualId);
        const ordenadas = actual ? [actual, ...data.sucursales.filter((s) => s !== actual)] : data.sucursales;
        setSucursales(ordenadas.slice(0, data.exceso.sucursales.maximo ?? ordenadas.length).map((s) => s.id));
      })
      .catch((err) => setError(getApiErrorMessage(err, 'No se pudo cargar el plan')));
  }, [esAdmin, usuario?.id, usuario?.sucursalActualId]);

  const exceso = usuario?.excesoDelPlan;
  if (!exceso) return null;

  if (!esAdmin) {
    return (
      <Alert variant="warning" className="mt-3">
        <Alert.Heading as="h5">El taller cambió de plan</Alert.Heading>
        El plan <strong>{exceso.plan}</strong> permite menos usuarios o sucursales de los que hay activos. Un
        administrador del taller tiene que elegir cuáles quedan; hasta entonces no se puede usar el sistema.
        <div className="mt-3">
          <Button variant="outline-dark" size="sm" onClick={() => logout()}>
            Salir
          </Button>
        </div>
      </Alert>
    );
  }

  if (!datos) return error ? <Alert variant="danger">{error}</Alert> : <Cargando />;

  const alternar = (lista: number[], setLista: (ids: number[]) => void, id: number) =>
    setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  const ajustaUsuarios = excede(exceso.usuarios);
  const ajustaSucursales = excede(exceso.sucursales);
  const usuariosOk =
    !ajustaUsuarios || (usuarios.length <= exceso.usuarios.maximo! && usuarios.includes(usuario!.id));
  const sucursalesOk =
    !ajustaSucursales || (sucursales.length > 0 && sucursales.length <= exceso.sucursales.maximo!);

  async function confirmar() {
    const bajas =
      (ajustaUsuarios ? exceso!.usuarios.usados - usuarios.length : 0) +
      (ajustaSucursales ? exceso!.sucursales.usados - sucursales.length : 0);
    if (
      !window.confirm(
        `Se van a dar de baja ${bajas} entre usuarios y sucursales. Su historial se conserva. ¿Seguimos?`
      )
    ) {
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      await apiClient.post('/plan/ajustar', {
        ...(ajustaUsuarios ? { usuarios } : {}),
        ...(ajustaSucursales ? { sucursales } : {})
      });
      await refrescar();
      navigate('/inicio', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'No se pudo ajustar el plan'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ maxWidth: 860 }} className="mx-auto">
      <h3>Ajustá el taller a tu plan {exceso.plan}</h3>
      <p className="text-muted">
        Tu plan permite {limites(exceso)} activos. Elegí cuáles quedan: el resto se da de baja, pero sus
        órdenes e historial se conservan y los podés reactivar si cambiás a un plan más grande.
      </p>
      {error && <Alert variant="danger">{error}</Alert>}

      <Row className="g-3">
        {ajustaSucursales && (
          <Col md={6}>
            <Card>
              <Card.Header>
                Sucursales · {sucursales.length} de {exceso.sucursales.maximo}
              </Card.Header>
              <Card.Body>
                {datos.sucursales.map((s) => (
                  <Form.Check
                    key={s.id}
                    type="checkbox"
                    id={`suc-${s.id}`}
                    className="mb-2"
                    checked={sucursales.includes(s.id)}
                    onChange={() => alternar(sucursales, setSucursales, s.id)}
                    label={
                      <>
                        {s.nombre}
                        {s.direccion && <span className="text-muted small"> · {s.direccion}</span>}
                      </>
                    }
                  />
                ))}
              </Card.Body>
            </Card>
          </Col>
        )}
        {ajustaUsuarios && (
          <Col md={6}>
            <Card>
              <Card.Header>
                Usuarios · {usuarios.length} de {exceso.usuarios.maximo}
              </Card.Header>
              <Card.Body>
                {datos.usuarios.map((u) => (
                  <Form.Check
                    key={u.id}
                    type="checkbox"
                    id={`usr-${u.id}`}
                    className="mb-2"
                    checked={usuarios.includes(u.id)}
                    // Quien ajusta no puede darse de baja a sí mismo.
                    disabled={u.id === usuario?.id}
                    onChange={() => alternar(usuarios, setUsuarios, u.id)}
                    label={
                      <>
                        {nombreCompleto(u)}{' '}
                        {u.id === usuario?.id && <span className="text-muted">(vos)</span>}
                        <div className="text-muted small">
                          {u.rol === 'admin' ? 'Admin' : 'Técnico'} · último acceso{' '}
                          {u.ultimoAccesoAt ? formatearFechaHora(u.ultimoAccesoAt) : 'nunca'}
                        </div>
                      </>
                    }
                  />
                ))}
              </Card.Body>
            </Card>
          </Col>
        )}
      </Row>

      <div className="d-flex justify-content-end mt-3">
        <Button onClick={confirmar} disabled={guardando || !usuariosOk || !sucursalesOk}>
          {guardando ? <Spinner size="sm" animation="border" /> : 'Confirmar y seguir'}
        </Button>
      </div>
    </div>
  );
}

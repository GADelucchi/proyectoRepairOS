import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Dropdown, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import type { Notificacion } from '@/shared/types';
import { formatearFechaHora } from '@/shared/utils/fechas';
import * as notificacionesApi from '../api';

/** Cada cuánto se pregunta si llegó algo nuevo. */
const INTERVALO_MS = 60_000;

function IconoCampana() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

/**
 * Campanita del menú: avisos para quien está en sesión (talleres o usuarios
 * nuevos para la administración de la plataforma, autorizaciones pendientes
 * para los admins de cada taller).
 *
 * El número se consulta cada minuto; la lista, recién al abrirla.
 */
export function Campanita() {
  const navigate = useNavigate();
  const [noLeidas, setNoLeidas] = useState(0);
  const [avisos, setAvisos] = useState<Notificacion[] | null>(null);
  const [abierta, setAbierta] = useState(false);

  const contar = useCallback(
    () =>
      notificacionesApi
        .contarNoLeidas()
        .then(setNoLeidas)
        // Un fallo puntual no debe ensuciar la pantalla: se reintenta solo.
        .catch(() => undefined),
    []
  );

  useEffect(() => {
    contar();
    const timer = setInterval(contar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, [contar]);

  function alternar(mostrar: boolean) {
    setAbierta(mostrar);
    if (!mostrar) return;
    setAvisos(null);
    notificacionesApi
      .listarNotificaciones()
      .then(setAvisos)
      .catch(() => setAvisos([]));
  }

  async function abrirAviso(aviso: Notificacion) {
    setAbierta(false);
    if (!aviso.leidaEn) {
      await notificacionesApi.marcarLeida(aviso.id).catch(() => undefined);
      contar();
    }
    if (aviso.link) navigate(aviso.link);
  }

  async function marcarTodas() {
    await notificacionesApi.marcarTodasLeidas().catch(() => undefined);
    setAvisos(
      (previos) => previos?.map((a) => ({ ...a, leidaEn: a.leidaEn ?? new Date().toISOString() })) ?? null
    );
    setNoLeidas(0);
  }

  return (
    <Dropdown align="end" show={abierta} onToggle={alternar}>
      <Dropdown.Toggle
        as={Button}
        variant="link"
        className="text-light position-relative px-2 campanita"
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'}
      >
        <IconoCampana />
        {noLeidas > 0 && (
          <Badge pill bg="danger" className="position-absolute top-0 start-100 translate-middle">
            {noLeidas > 99 ? '99+' : noLeidas}
          </Badge>
        )}
      </Dropdown.Toggle>

      <Dropdown.Menu className="p-0 shadow" style={{ width: 340, maxWidth: '90vw' }}>
        <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
          <strong className="small">Notificaciones</strong>
          {noLeidas > 0 && (
            <Button size="sm" variant="link" className="p-0 small" onClick={marcarTodas}>
              Marcar todas como leídas
            </Button>
          )}
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {avisos === null ? (
            <div className="text-center py-3">
              <Spinner size="sm" animation="border" />
            </div>
          ) : avisos.length === 0 ? (
            <p className="text-muted small text-center py-3 mb-0">No tenés notificaciones.</p>
          ) : (
            avisos.map((aviso) => (
              <Dropdown.Item
                key={aviso.id}
                as="button"
                className={`border-bottom py-2 text-wrap ${aviso.leidaEn ? '' : 'notificacion-nueva'}`}
                onClick={() => abrirAviso(aviso)}
              >
                <div className="d-flex gap-2">
                  {!aviso.leidaEn && <span className="punto-notificacion mt-2" aria-label="Sin leer" />}
                  <div className="min-w-0">
                    <div className="small fw-semibold">{aviso.titulo}</div>
                    {aviso.mensaje && <div className="small text-muted">{aviso.mensaje}</div>}
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {formatearFechaHora(aviso.createdAt)}
                    </div>
                  </div>
                </div>
              </Dropdown.Item>
            ))
          )}
        </div>
      </Dropdown.Menu>
    </Dropdown>
  );
}

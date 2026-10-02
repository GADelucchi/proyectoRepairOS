import { useEffect, useState } from 'react';
import { Badge } from 'react-bootstrap';
import * as solicitudesApi from '../api';

/** Cada cuánto se vuelve a preguntar si hay pedidos esperando. */
const INTERVALO_MS = 60_000;

/**
 * Cuántas autorizaciones esperan resolución.
 *
 * Se consulta cada tanto porque el pedido llega mientras el cliente espera en el
 * mostrador: si el supervisor tuviera que entrar a mirar la pantalla por las
 * dudas, el aviso no serviría de nada.
 */
export function AvisoAutorizaciones() {
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    let activo = true;

    const consultar = () =>
      solicitudesApi
        .contarPendientes()
        .then((total) => {
          if (activo) setPendientes(total);
        })
        // Un fallo puntual no debe ensuciar la pantalla: se reintenta solo.
        .catch(() => undefined);

    consultar();
    const timer = setInterval(consultar, INTERVALO_MS);

    return () => {
      activo = false;
      clearInterval(timer);
    };
  }, []);

  if (pendientes === 0) return null;

  return (
    <Badge bg="warning" text="dark" className="ms-1">
      {pendientes}
    </Badge>
  );
}

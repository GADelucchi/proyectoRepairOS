import { Spinner } from 'react-bootstrap';

/** Indicador de carga centrado. `pantallaCompleta` para cuando todavía no hay layout. */
export function Cargando({ pantallaCompleta = false }: { pantallaCompleta?: boolean }) {
  return (
    <div
      className={`d-flex justify-content-center align-items-center ${pantallaCompleta ? 'vh-100' : 'py-5'}`}
    >
      <Spinner animation="border" role="status">
        <span className="visually-hidden">Cargando…</span>
      </Spinner>
    </div>
  );
}

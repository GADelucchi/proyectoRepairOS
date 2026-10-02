import { Card } from 'react-bootstrap';
import type { Cliente } from '@/shared/types';
import { nombreCompleto } from '@/shared/utils/texto';

export function ClienteCard({ cliente }: { cliente?: Cliente }) {
  return (
    <Card className="h-100">
      <Card.Header>Cliente</Card.Header>
      <Card.Body>
        {cliente ? (
          <>
            <strong>{nombreCompleto(cliente)}</strong>
            <div>DNI/CUIT: {cliente.dniCuit ?? '-'}</div>
            <div>Teléfono: {cliente.telefono ?? '-'}</div>
            <div>Email: {cliente.email ?? '-'}</div>
            {cliente.esGremio && cliente.nombreGremio && <div>Gremio: {cliente.nombreGremio}</div>}
          </>
        ) : (
          '-'
        )}
      </Card.Body>
    </Card>
  );
}

import { Alert, Button } from 'react-bootstrap';
import { useAuth } from '@/features/auth/useAuth';
import { linkWhatsApp } from '@/shared/utils/whatsapp';

const ETIQUETA = {
  usuarios: { singular: 'usuario activo', plural: 'usuarios activos' },
  sucursales: { singular: 'sucursal activa', plural: 'sucursales activas' }
} as const;

/**
 * Cuánto del plan usa el taller. Con el plan lleno, ofrece pedir el cambio de
 * plan por WhatsApp (el backend igual frena el alta que lo supere).
 * No muestra nada durante la prueba o si el plan no tiene tope.
 */
export function UsoDelPlanAviso({ recurso }: { recurso: 'usuarios' | 'sucursales' }) {
  const { usuario } = useAuth();
  const uso = usuario?.usoDelPlan?.[recurso];
  if (!uso || uso.maximo === null) return null;

  const plan = usuario?.suscripcion?.plan?.nombre ?? '';
  const { singular, plural } = ETIQUETA[recurso];
  const lleno = uso.usados >= uso.maximo;
  const whatsapp = usuario?.suscripcion?.contactoWhatsapp;
  const email = usuario?.suscripcion?.contacto;
  const mensaje = `Hola, quiero cambiar el plan del taller "${usuario?.taller?.nombre ?? ''}" en RepairOS para tener más ${plural.split(' ')[0]}.`;

  if (!lleno) {
    return (
      <p className="text-muted small">
        Usás {uso.usados} de {uso.maximo} {uso.maximo === 1 ? singular : plural} del plan {plan}.
      </p>
    );
  }

  return (
    <Alert variant="warning" className="d-flex flex-wrap align-items-center justify-content-between gap-2">
      <span>
        Tu plan <strong>{plan}</strong> incluye hasta {uso.maximo} {uso.maximo === 1 ? singular : plural} y ya
        los estás usando. Para sumar más, cambiá de plan.
      </span>
      {whatsapp ? (
        <Button
          size="sm"
          variant="success"
          href={linkWhatsApp(whatsapp, mensaje)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Cambiar de plan por WhatsApp
        </Button>
      ) : (
        email && (
          <Button
            size="sm"
            variant="outline-dark"
            href={`mailto:${email}?body=${encodeURIComponent(mensaje)}`}
          >
            Pedir cambio de plan
          </Button>
        )
      )}
    </Alert>
  );
}

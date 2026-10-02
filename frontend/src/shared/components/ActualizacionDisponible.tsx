import { useRegisterSW } from 'virtual:pwa-register/react';
import { Alert, Button } from 'react-bootstrap';

/**
 * Avisos del service worker.
 *
 * `offlineReady` confirma que la app quedó instalada y abre sin conexión.
 * `needRefresh` aparece cuando se publicó una versión nueva mientras la pestaña
 * estaba abierta; recargar la aplica.
 */
export function ActualizacionDisponible() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  return (
    <div
      className="position-fixed bottom-0 end-0 p-3"
      style={{ zIndex: 1080, maxWidth: 380 }}
      role="status"
      aria-live="polite"
    >
      <Alert
        variant={needRefresh ? 'primary' : 'success'}
        dismissible
        onClose={() => {
          setOfflineReady(false);
          setNeedRefresh(false);
        }}
        className="shadow"
      >
        {needRefresh ? (
          <>
            <div className="mb-2">Hay una versión nueva de RepairOS.</div>
            <Button size="sm" onClick={() => updateServiceWorker(true)}>
              Actualizar ahora
            </Button>
          </>
        ) : (
          'RepairOS quedó disponible para usar sin conexión.'
        )}
      </Alert>
    </div>
  );
}

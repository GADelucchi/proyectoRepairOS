# Landing de RepairOS

Sitio público de marketing, separado de la aplicación.

- **Este sitio** (`repairos.app`) es lo único que se indexa en Google.
- **La app** (`app.repairos.app`) va con `noindex`: es privada y está detrás de login.

Es HTML y CSS estáticos, sin build ni dependencias: se sube tal cual a Netlify,
Vercel, Cloudflare Pages o un bucket S3. Todo el CSS va embebido en el `<head>`
a propósito, para que la página pinte en un solo request.

## Antes de publicar

Buscá `repairos.app` y `TU_` en `index.html` y reemplazá:

1. **Dominio real** en `canonical`, `og:url` y el JSON-LD (también en `sitemap.xml`).
2. **Email y WhatsApp** de contacto (`TU_EMAIL`, `TU_NUMERO`).
3. **Capturas reales** de la aplicación en la sección "Cómo funciona" (hoy hay
   un marcador). Salen bien tomándolas a 1440px de ancho.
4. **ID de analítica**, si vas a medir.

Los precios ya están cargados: Taller $44.999 y Cadena $64.999 por mes. Si los cambiás,
acordate de actualizarlos **en dos lugares**: las tarjetas HTML y el bloque `offers` del
JSON-LD del final. Si quedan desincronizados, Google muestra el precio del JSON-LD (el
que no ve el visitante) y eso sí es motivo de penalización.

No inventes testimonios ni cantidad de clientes: Google penaliza las reseñas
falsas marcadas como datos estructurados, y es un riesgo legal.

## Por qué vive fuera de `frontend/`

La landing y la aplicación tienen requisitos opuestos: la landing tiene que ser indexable
y la app lleva `noindex`. Compartir origen obligaría a un `robots.txt` con reglas finas,
a acotar el scope del service worker para que no cachee la landing, y a rebuildear la PWA
cada vez que se corrige una coma del copy. Separadas, cada una se despliega sola.

## Después de publicar

1. Dar de alta el sitio en [Google Search Console](https://search.google.com/search-console)
   y enviar `sitemap.xml`.
2. Verificar el resultado enriquecido con el
   [test de resultados enriquecidos](https://search.google.com/test/rich-results).
3. Comprobar la preview del link con el
   [depurador de Facebook](https://developers.facebook.com/tools/debug/).

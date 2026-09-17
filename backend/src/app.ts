import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { limitadorGeneral } from './middlewares/rateLimit';

export const app = express();

// Detrás de un proxy (Nginx, Railway, Render) hace falta para que req.ip sea la
// IP real del cliente y no la del proxy: sin esto el rate limiting es inútil.
if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // React-Bootstrap inyecta estilos en línea; las fuentes son de Google.
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", ...env.corsAllowedOrigins],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: env.nodeEnv === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false
  })
);

app.use(
  cors({
    origin: env.corsAllowedOrigins,
    credentials: true
  })
);
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

if (env.storage.driver === 'local') {
  app.use('/uploads', express.static(path.resolve(process.cwd(), env.storage.local.uploadsDir)));
}

app.use('/api', limitadorGeneral, routes);

app.use(notFoundHandler);
app.use(errorHandler);

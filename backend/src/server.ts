import { app } from './app';
import { env } from './config/env';
import { connectDatabase } from './config/database';
import './models';

async function start(): Promise<void> {
  await connectDatabase();
  const server = app.listen(env.port, () => {
    console.log(`RepairOS API escuchando en http://localhost:${env.port}`);
  });

  // El fallo al tomar el puerto llega como evento del server, no como rechazo
  // de la promesa, así que sin esto el proceso moría dejando en pantalla el
  // mensaje de éxito de arriba.
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `✘ El puerto ${env.port} ya está ocupado por otro proceso. ` +
          `Liberalo (lsof -nP -iTCP:${env.port} -sTCP:LISTEN) o cambiá PORT en el .env.`
      );
    } else {
      console.error('✘ El servidor no pudo iniciarse:', err.message);
    }
    process.exit(1);
  });
}

start().catch((err) => {
  console.error('No se pudo iniciar el servidor:', err);
  process.exit(1);
});

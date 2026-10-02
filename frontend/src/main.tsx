import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from '@/app/App';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { ActualizacionDisponible } from '@/shared/components/ActualizacionDisponible';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <ActualizacionDisponible />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

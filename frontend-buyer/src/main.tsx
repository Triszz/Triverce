import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import './index.css';
import App from './App.tsx';
import { AppProviders } from './components/AppProviders';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Toaster richColors position="top-right" />
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);

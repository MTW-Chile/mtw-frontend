import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'
import { ToastContainer } from './components/ui/ToastContainer.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Fuera del ErrorBoundary a proposito: sigue mostrando toasts aunque
        el resto de la app se haya caido y el ErrorBoundary la haya
        reemplazado por su pantalla de error. */}
    <ToastContainer />
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

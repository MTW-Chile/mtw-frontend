import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ui/ErrorBoundary.tsx'
import { ToastContainer } from './components/ui/ToastContainer.tsx'

// Scrollear la pagina con el mouse sobre un <input type="number"> enfocado
// cambia su valor en vez de scrollear -- un campo numerico focuseado "atrapa"
// la rueda del mouse por defecto en todos los navegadores. Global en vez de
// un handler por input: hay docenas de input type="number" en la app, y el
// bug es el mismo en todos. Quita el foco apenas se detecta scroll sobre
// uno -- no previene el scroll de la pagina, solo evita que ese input
// reaccione a la rueda.
document.addEventListener(
  'wheel',
  () => {
    const activo = document.activeElement as HTMLElement | null;
    if (activo?.tagName === 'INPUT' && (activo as HTMLInputElement).type === 'number') {
      activo.blur();
    }
  },
  { passive: true }
);

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

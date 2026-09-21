import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Red de seguridad a nivel de toda la app -- sin esto, una excepcion sin
 * capturar en CUALQUIER componente (ej. una tabla que no esperaba un campo
 * null) desmonta todo el árbol de React y deja la pantalla en blanco/negra
 * sin ningún aviso, obligando a recargar a ciegas. Con esto al menos queda
 * un mensaje y un botón para recargar.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Error no capturado en la UI:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
          <div className="max-w-sm text-center space-y-3">
            <h1 className="text-sm font-black text-slate-900">Ocurrió un error inesperado</h1>
            <p className="text-xs text-slate-500">
              Algo falló al mostrar esta pantalla. Recargar la página debería solucionarlo. Si vuelve a pasar,
              avísale al administrador con lo que estabas haciendo justo antes.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-[#E34A26] text-xs font-bold text-white hover:bg-[#c93f1f] transition-colors cursor-pointer"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

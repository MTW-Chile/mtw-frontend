import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { suscribirToasts, quitarToast, type ToastItem } from '../../lib/toast';

// Notificaciones de error en la esquina inferior derecha -- pensado como
// herramienta de debug (pedido explicito): cualquier query/mutation que
// falle en CUALQUIER parte de la app (ver queryCache/mutationCache en
// App.tsx) termina mostrandose aca, ademas del manejo de error puntual que
// ya tenga esa pantalla (no se intenta deduplicar -- para debug, ver de mas
// es mejor que no ver). Vive FUERA del ErrorBoundary en main.tsx para
// seguir mostrandose aunque el resto de la app se haya caido.
export const ToastContainer: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => suscribirToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-[min(92vw,380px)] pointer-events-none">
      {items.map((item) => {
        // 'info' (confirmaciones, ej. "documento vinculado") no debe verse
        // como un error: mismo contenedor, otro color e icono. Los errores
        // quedan exactamente como antes.
        const esInfo = item.tipo === 'info';
        return (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-xl border shadow-lg p-3 text-xs flex items-start gap-2 animate-fade-in ${
              esInfo ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {esInfo ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-500" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-bold break-words">{item.mensaje}</p>
              {item.detalle && (
                <p className={`text-[10px] mt-0.5 break-words font-mono ${esInfo ? 'text-emerald-700/80' : 'text-rose-600/80'}`}>
                  {item.detalle}
                </p>
              )}
            </div>
            <button
              onClick={() => quitarToast(item.id)}
              className={`shrink-0 ${esInfo ? 'text-emerald-400 hover:text-emerald-700' : 'text-rose-400 hover:text-rose-700'}`}
              title="Cerrar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

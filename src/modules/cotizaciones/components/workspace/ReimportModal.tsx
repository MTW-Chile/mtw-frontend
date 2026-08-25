import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ReimportModalProps {
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ReimportModal: React.FC<ReimportModalProps> = ({
  isOpen,
  isPending,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border bg-white border-amber-300">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="text-center space-y-1.5">
          <h3 className="text-base font-bold text-slate-900">¿Reimportar desde HETMO?</h3>
          <p className="text-xs text-slate-600">
            Esta acción volverá a leer los datos crudos desde SQL Server. Si realizaste modificaciones personalizadas de precios o sustituciones en esta versión, se restablecerán a los valores originales de fábrica.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isPending ? 'animate-spin' : ''}`} />
            <span>{isPending ? 'Reimportando...' : 'Sí, Reimportar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

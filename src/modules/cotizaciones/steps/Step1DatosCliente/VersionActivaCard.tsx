import React from 'react';
import { GitBranch, Loader2 } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';

interface VersionActivaCardProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  selectedVersionIdx: number;
  onSelectVersion: (index: number) => void;
  isSaving: boolean;
}

// Confirmacion explicita de que version de HETMO se va a presupuestar.
// Antes de esto, la unica forma de saber/cambiar la version activa eran
// las pestañas chicas en el header (y solo si habia mas de una version
// sincronizada) - facil de pasar por alto antes de arrancar a cotizar.
export const VersionActivaCard: React.FC<VersionActivaCardProps> = ({
  proyecto,
  activeVersion,
  selectedVersionIdx,
  onSelectVersion,
  isSaving,
}) => {
  const hayVariasVersiones = proyecto.versiones.length > 1;

  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
          <GitBranch className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
            Versión a Presupuestar
          </div>
          <div className="text-sm font-bold text-slate-900">
            Revisión {activeVersion?.versionNumero ?? '—'}
            {activeVersion?.fechaDocumento && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                ({new Date(activeVersion.fechaDocumento).toLocaleDateString('es-CL')})
              </span>
            )}
          </div>
        </div>
      </div>

      {hayVariasVersiones ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl p-1 bg-slate-100 border border-slate-200">
            {proyecto.versiones.map((v, idx) => (
              <button
                key={v.id}
                onClick={() => onSelectVersion(idx)}
                disabled={isSaving}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                  selectedVersionIdx === idx
                    ? 'bg-[#E34A26] text-white font-bold shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rev {v.versionNumero}
              </button>
            ))}
          </div>
          {isSaving && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
        </div>
      ) : (
        <span className="text-xs text-slate-500">
          Única versión sincronizada desde HETMO para esta obra.
        </span>
      )}
    </div>
  );
};

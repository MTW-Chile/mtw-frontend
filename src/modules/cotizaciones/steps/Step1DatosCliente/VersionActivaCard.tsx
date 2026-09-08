import React, { useEffect, useState } from 'react';
import { GitBranch, Loader2, Hash } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';

interface VersionActivaCardProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  selectedVersionIdx: number;
  onSelectVersion: (index: number) => void;
  isSaving: boolean;
  numeroInterno: string;
  onGuardarNumeroInterno: (numero: string) => void;
  isSavingNumeroInterno: boolean;
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
  numeroInterno,
  onGuardarNumeroInterno,
  isSavingNumeroInterno,
}) => {
  const hayVariasVersiones = proyecto.versiones.length > 1;

  // Draft local del "numero" que la persona escribe -- solo se guarda al
  // perder foco o con Enter (mismo patron que PrecioEditable en la
  // Analitica), no en cada tecla. Se resetea si numeroInterno cambia desde
  // afuera (otra pestaña, o al cambiar de proyecto).
  const [draftNumero, setDraftNumero] = useState(numeroInterno);
  useEffect(() => setDraftNumero(numeroInterno), [numeroInterno]);
  const confirmarNumero = () => {
    if (draftNumero.trim() !== numeroInterno.trim()) onGuardarNumeroInterno(draftNumero);
  };

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200/80 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
            <GitBranch className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Versión a Presupuestar
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-900">
              Revisión {activeVersion?.versionNumero ?? '—'}
              {activeVersion?.fechaDocumento && (
                <span className="ml-2 text-[11px] sm:text-xs font-normal text-slate-500">
                  ({new Date(activeVersion.fechaDocumento).toLocaleDateString('es-CL')})
                </span>
              )}
            </div>
          </div>
        </div>

        {hayVariasVersiones ? (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center rounded-xl p-1 bg-slate-100 border border-slate-200">
              {proyecto.versiones.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => onSelectVersion(idx)}
                  disabled={isSaving}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer ${
                    selectedVersionIdx === idx
                      ? 'bg-[#E34A26] text-white font-bold shadow-xs'
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
          <span className="text-[11px] sm:text-xs text-slate-500">
            Única versión sincronizada desde HETMO para esta obra.
          </span>
        )}
      </div>

      {/* Numero de presupuesto INTERNO de MTW -- distinto al de HETMO.
          Siempre "numero-version": la persona solo escribe el numero, la
          version se pega sola de la Revision activa de arriba. */}
      <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
          <Hash className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            Número de Presupuesto Interno (MTW)
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={draftNumero}
              onChange={(e) => setDraftNumero(e.target.value)}
              onBlur={confirmarNumero}
              onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
              placeholder="Ej: 4521"
              className="w-28 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#E34A26] focus:bg-white"
            />
            {isSavingNumeroInterno && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
            {draftNumero.trim() && (
              <span className="text-[11px] sm:text-xs font-mono text-slate-500 truncate">
                → <strong className="text-slate-800">{draftNumero.trim()}-{activeVersion?.versionNumero ?? '—'}</strong>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

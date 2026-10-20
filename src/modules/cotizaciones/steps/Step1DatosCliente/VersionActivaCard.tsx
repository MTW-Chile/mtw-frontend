import React, { useEffect, useState } from 'react';
import { GitBranch, Loader2, Hash, RotateCcw, Building2 } from 'lucide-react';
import type { Proyecto, ProyectoVersion } from '../../../../types';
import { Segmentado } from '../../../../components/ui/Segmentado';
import { Button } from '../../../../components/ui/Button';
import { InputCompacto } from '../../../../components/ui/Campos';

interface VersionActivaCardProps {
  proyecto: Proyecto;
  activeVersion?: ProyectoVersion;
  selectedVersionIdx: number;
  onSelectVersion: (index: number) => void;
  isSaving: boolean;
  numeroInterno: string;
  onGuardarNumeroInterno: (numero: string) => void;
  isSavingNumeroInterno: boolean;
  onGuardarObra: (obra: string) => void;
  isSavingObra: boolean;
  onOpenReimport: () => void;
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
  onGuardarObra,
  isSavingObra,
  onOpenReimport,
}) => {
  const hayVariasVersiones = proyecto.versiones.length > 1;

  // Nombre de la obra: viene de HETMO, pero puede venir mal escrito. Mismo
  // patrón que el número interno: borrador local, se guarda al salir del campo.
  const [draftObra, setDraftObra] = useState(proyecto.obra || '');
  useEffect(() => setDraftObra(proyecto.obra || ''), [proyecto.obra]);
  const confirmarObra = () => {
    const limpia = draftObra.trim();
    if (!limpia) {
      setDraftObra(proyecto.obra || '');
      return;
    }
    if (limpia !== (proyecto.obra || '').trim()) onGuardarObra(limpia);
  };

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
    <section className="rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-6 space-y-5">
      {/* Cabecera: revisión activa + selector de revisión + reimportar */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Versión a presupuestar</div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h2 className="text-base font-extrabold text-slate-900">Revisión {activeVersion?.versionNumero ?? '—'}</h2>
              {activeVersion?.fechaDocumento && (
                <span className="text-xs text-slate-500">
                  del {new Date(activeVersion.fechaDocumento).toLocaleDateString('es-CL')}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {hayVariasVersiones ? (
            <Segmentado
              etiqueta="Revisión"
              valor={selectedVersionIdx}
              onChange={onSelectVersion}
              opciones={proyecto.versiones.map((v, idx) => ({ value: idx, label: `Rev ${v.versionNumero}`, disabled: isSaving }))}
            />
          ) : (
            <span className="text-xs text-slate-500">Única versión sincronizada desde HETMO</span>
          )}
          {isSaving && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}

          <Button
            variant="outline"
            size="sm"
            onClick={onOpenReimport}
            disabled={activeVersion?.esCongelado}
            leftIcon={<RotateCcw className="w-3.5 h-3.5 text-amber-600" />}
            title={
              activeVersion?.esCongelado
                ? 'La versión está congelada: no se puede reimportar'
                : 'Restablecer presupuesto leyendo los datos originales de HETMO'
            }
          >
            Reimportar HETMO
          </Button>
        </div>
      </div>

      {/* Nombre de la obra: corregible si HETMO lo trajo mal */}
      <div className="pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 sm:gap-6 sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold leading-tight">
            Nombre de la
            <br />
            obra
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <InputCompacto
            aria-label="Nombre de la obra"
            type="text"
            value={draftObra}
            onChange={(e) => setDraftObra(e.target.value)}
            onBlur={confirmarObra}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            maxLength={200}
            placeholder="Nombre de la obra"
            className="flex-1 min-w-0 sm:max-w-md text-sm! py-2! font-semibold"
          />
          {isSavingObra && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
        </div>
      </div>

      {/* Número de presupuesto interno (MTW): el número lo escribe la persona, la revisión se agrega sola */}
      <div className="pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 sm:gap-6 sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <Hash className="w-4 h-4" />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold leading-tight">
            Número de presupuesto
            <br />
            interno (MTW)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <InputCompacto
            aria-label="Número interno"
            type="text"
            value={draftNumero}
            onChange={(e) => setDraftNumero(e.target.value)}
            onBlur={confirmarNumero}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            placeholder="Ej: 4521"
            className="w-36 text-sm! py-2! font-mono font-bold"
          />
          {isSavingNumeroInterno && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />}
          {draftNumero.trim() && (
            <span className="text-xs text-slate-500">
              se presupuesta como <strong className="font-mono text-slate-800">{draftNumero.trim()}-{activeVersion?.versionNumero ?? '—'}</strong>
            </span>
          )}
        </div>
      </div>
    </section>
  );
};

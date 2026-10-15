import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Check, Loader2 } from 'lucide-react';
import type { Ventana, CorreccionTravesano } from '../../../../types';
import { toWindowLine } from '../../components/drawing/ventanaAdapter';
import * as core from '../../components/drawing/geometryCore';
import { guardarCorreccionDibujo } from './correccionDibujo';

interface TravesanosEditorProps {
  ventana: Ventana;
  /** Travesaños válidos del borrador (null si no difieren de lo guardado): el modal los aplica al dibujo en vivo. */
  onDraftChange: (draft: CorreccionTravesano[] | null) => void;
  onSaved: (updated: Ventana) => void;
}

interface PanoOpcion {
  numero: number | null;
  label: string;
  ancho: number;
  alto: number;
}

/** Travesaños manuales (los que HETMO no comunica), embebido en EditarLineaModal. */
export const TravesanosEditor: React.FC<TravesanosEditorProps> = ({ ventana, onDraftChange, onSaved }) => {
  const [draft, setDraft] = useState<CorreccionTravesano[]>(
    () => (ventana.correccionGeometria?.travesanos ?? []).map((t) => ({ ...t }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paños donde se puede poner un travesaño: cada paño de una línea
  // compuesta, o la línea completa si es de un solo paño.
  const { panos, permiteVerticalSinPano } = useMemo(() => {
    const line = toWindowLine(ventana);
    const composite = line ? (core.compositePanels(line) as { panels: { number: number; width: number; height: number }[] } | null) : null;
    if (composite) {
      return {
        permiteVerticalSinPano: true,
        panos: composite.panels.map<PanoOpcion>((p) => ({
          numero: p.number,
          label: `Paño ${Number.isInteger(p.number) ? p.number : 'ciego'} · ${Math.round(p.width)}×${Math.round(p.height)} mm`,
          ancho: p.width,
          alto: p.height,
        })),
      };
    }
    // Sin hojas (ventana fija) el vertical es una división del vidrio; con
    // hojas habría que decidir en cuál va, y HETMO tampoco lo modela así.
    const fija = line
      ? (core.sourceComponents(line) as { apertura: number }[]).every((c) => core.apertureDefinition(line, c.apertura).family === 'fixed')
      : false;
    return {
      permiteVerticalSinPano: fija,
      panos: [{ numero: null, label: `Ventana completa · ${ventana.anchoMm}×${ventana.altoMm} mm`, ancho: ventana.anchoMm, alto: ventana.altoMm }],
    };
  }, [ventana]);

  const panoDe = (t: CorreccionTravesano) => panos.find((p) => p.numero === (t.panel ?? null)) ?? panos[0];
  const errorDe = (t: CorreccionTravesano): string | null => {
    const limite = t.eje === 'horizontal' ? panoDe(t).alto : panoDe(t).ancho;
    if (!(t.cota > 0)) return 'Ingresa una cota mayor a 0';
    if (t.cota >= limite) return `Debe ser menor a ${Math.round(limite)} mm`;
    return null;
  };
  const hayErrores = draft.some((t) => errorDe(t));

  const update = (i: number, patch: Partial<CorreccionTravesano>) =>
    setDraft((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));

  const guardados = useMemo(() => JSON.stringify(ventana.correccionGeometria?.travesanos ?? []), [ventana.correccionGeometria?.travesanos]);
  const dirty = JSON.stringify(draft) !== guardados;
  useEffect(() => {
    onDraftChange(dirty ? draft.filter((t) => !errorDe(t)) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, draft, onDraftChange]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      onSaved(await guardarCorreccionDibujo(ventana, { travesanos: draft }));
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Error al conectar con la API.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
            {draft.length === 0 && (
              <p className="text-sm text-slate-500">Sin travesaños manuales. Agrega uno con el botón de abajo.</p>
            )}
            {draft.map((t, i) => {
              const msg = errorDe(t);
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={t.eje}
                      onChange={(e) => update(i, { eje: e.target.value as CorreccionTravesano['eje'] })}
                      className="text-xs font-semibold border border-slate-200 rounded-lg px-2 py-1.5"
                    >
                      <option value="horizontal">Horizontal</option>
                      <option value="vertical" disabled={!permiteVerticalSinPano}>Vertical</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={t.cota || ''}
                      onChange={(e) => update(i, { cota: Number(e.target.value) })}
                      className="w-28 text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                      placeholder="mm"
                    />
                    <span className="text-[11px] text-slate-400 flex-1">
                      {t.eje === 'horizontal' ? 'desde arriba' : 'desde la izquierda'}
                    </span>
                    <button
                      onClick={() => setDraft((prev) => prev.filter((_, idx) => idx !== i))}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                      aria-label="Quitar travesaño"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {panos.length > 1 && (
                    <select
                      value={t.panel ?? ''}
                      onChange={(e) => update(i, { panel: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5"
                    >
                      {panos.map((p) => (
                        <option key={String(p.numero)} value={p.numero ?? ''}>{p.label}</option>
                      ))}
                    </select>
                  )}
                  {msg && <p className="text-[11px] text-rose-600 font-medium">{msg}</p>}
                </div>
              );
            })}
            <button
              onClick={() => setDraft((prev) => [...prev, { eje: 'horizontal', cota: 0, panel: panos[0].numero }])}
              className="text-xs font-semibold flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-brand-600 hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar travesaño
            </button>
            {!permiteVerticalSinPano && (
              <p className="text-[11px] text-slate-400">El travesaño vertical solo está disponible en ventanas fijas o compuestas.</p>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
        <p className="text-xs text-rose-600 font-medium">{error}</p>
        <button
          onClick={handleSave}
          disabled={isSaving || hayErrores || !dirty}
          className="px-4 py-1.5 text-xs font-bold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer ml-auto"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Guardar travesaños
        </button>
      </div>
    </div>
  );
};

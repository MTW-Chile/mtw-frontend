import React, { useState } from 'react';
import { AlertCircle, ArrowRightLeft, Loader2 } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import type { Material, MaterialAnalitica } from '../../../../types';
import { MaterialPicker } from '../Step2Lineas/MaterialPicker';
import { Modal } from '../../../../components/ui/Modal';
import { Aviso } from '../../../../components/ui/Aviso';

interface ReemplazarMaterialModalProps {
  original: MaterialAnalitica;
  // Líneas de la versión que contienen este material (HETMO o agregado a mano).
  lineasAfectadas: number;
  // Códigos de las partidas ya aprobadas: ni el material que sale ni el que entra pueden pertenecer a ellas.
  partidasAprobadas: string[];
  isPending: boolean;
  error: string | null;
  onConfirm: (nuevo: Material) => void;
  onClose: () => void;
}

/**
 * Reemplazo de un material en TODA la versión, desde la Analítica. Cada línea
 * que lo contiene cambia su receta por el material elegido, con la misma
 * cantidad pendiente. Ver reemplazarMaterialEnVersion en api/client.ts.
 */
export const ReemplazarMaterialModal: React.FC<ReemplazarMaterialModalProps> = ({
  original,
  lineasAfectadas,
  partidasAprobadas,
  isPending,
  error,
  onConfirm,
  onClose,
}) => {
  const [selected, setSelected] = useState<Material | null>(null);

  // Misma regla que aplica mtw-api: solo un material que se mide igual (misma
  // medición y unidad de consumo, la cantidad se traspasa sin conversión) y de
  // una partida no aprobada.
  const aprobadas = new Set(partidasAprobadas);
  const unidadOriginal = original.unidadConsumo.simbolo;
  const filtrar = (m: Material) =>
    m.formato?.medicion === original.medicion &&
    m.formato?.unidadConsumo.codigo === original.unidadConsumo.codigo &&
    !aprobadas.has(m.tipoProducto?.partida?.codigo ?? '');

  const cambiaPartida = selected !== null && selected.tipoProducto?.partida?.codigo !== original.partida.codigo;

  return (
    <Modal
      titulo="Reemplazar material"
      subtitulo="Cambia el material en todas las líneas de la versión"
      icono={ArrowRightLeft}
      onClose={onClose}
      cerrable={!isPending}
      pie={
        <Modal.Pie>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!selected || isPending}
            onClick={() => selected && onConfirm(selected)}
            leftIcon={isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
          >
            {`Reemplazar en ${lineasAfectadas} ${lineasAfectadas === 1 ? 'línea' : 'líneas'}`}
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Material actual</div>
        <div className="text-[11px] font-semibold text-slate-900">{original.skuInterno}</div>
        <div className="text-xs text-slate-700 leading-snug">{original.descripcion}</div>
        <div className="text-[11px] text-slate-500">
          {original.partida.nombre} · {original.tipoProducto.nombre} · {lineasAfectadas} {lineasAfectadas === 1 ? 'línea' : 'líneas'} de la versión
        </div>
      </div>

      {!selected ? (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Nuevo material (maestro)</div>
          <MaterialPicker onSelect={setSelected} filtrar={filtrar} placeholder={`Buscar material en ${unidadOriginal || 'la misma unidad'}…`} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Nuevo material</div>
          <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-brand-600/30 bg-brand-600/5">
            <div className="min-w-0">
              <div className="font-mono font-semibold text-[11px] text-slate-900">{selected.skuInterno}</div>
              <div className="text-xs text-slate-700 leading-snug">{selected.descripcion}</div>
              <div className="text-[11px] text-slate-500">
                {selected.tipoProducto?.partida?.nombre ?? '—'} · {selected.tipoProducto?.nombre ?? '—'}
              </div>
            </div>
            <Button variant="link" size="sm" onClick={() => setSelected(null)} disabled={isPending} className="shrink-0">
              Cambiar
            </Button>
          </div>
        </div>
      )}

      {cambiaPartida && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            El material nuevo es de otra partida ({selected?.tipoProducto?.partida?.nombre}): su costo pasa a sumarse en esa partida
            de la Analítica.
          </span>
        </div>
      )}

      <p className="text-[11px] text-slate-500">
        Solo se ofrecen materiales que se miden en <strong className="text-slate-700">{unidadOriginal}</strong>, de partidas
        no aprobadas. La cantidad pendiente de cada línea se traspasa al material nuevo, y su precio toma el último precio del maestro.
        Lo que ya se reemplazó en una línea por otro material no cambia.
      </p>
    </Modal>
  );
};

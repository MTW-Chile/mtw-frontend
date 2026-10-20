import React, { useMemo, useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { Proyecto } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';
import { Buscador } from '../../../components/ui/Buscador';
import { Casilla, InputCompacto } from '../../../components/ui/Campos';

/**
 * Elegir ventanas de la cotización (versión activa) para recotizarlas en un
 * adicional, con cuántas unidades de cada una. Lo elegido reemplaza lo que el
 * adicional tenía.
 */
export const ElegirVentanasModal: React.FC<{
  proyecto: Proyecto;
  pendiente: boolean;
  error: string | null;
  onConfirmar: (ventanas: { ventanaId: string; unidades: number }[]) => void;
  onClose: () => void;
}> = ({ proyecto, pendiente, error, onConfirmar, onClose }) => {
  const version = useMemo(
    () => proyecto.versiones.find((v) => v.hetmoId === proyecto.versionActivaHetmoId) ?? proyecto.versiones[0],
    [proyecto]
  );
  const ventanas = version?.ventanas ?? [];
  const [elegidas, setElegidas] = useState<Record<string, number>>({});
  const [busqueda, setBusqueda] = useState('');
  const filtradas = ventanas.filter((v) => !busqueda.trim() || `${v.modelo} ${v.descripcionCorta ?? ''} ${v.lineaHetmo}`.toLowerCase().includes(busqueda.toLowerCase()));
  const total = Object.values(elegidas).reduce((a, b) => a + b, 0);

  return (
    <Modal
      titulo="Ventanas a recotizar"
      subtitulo="De la cotización (versión activa); se cotizan con precios y divisas vigentes"
      icono={LayoutGrid}
      ancho="lg"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <span className="text-[11px] text-slate-500">{total} unidades elegidas</span>
          <div className="flex gap-2.5">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={total === 0}
              isLoading={pendiente}
              onClick={() => onConfirmar(Object.entries(elegidas).map(([ventanaId, unidades]) => ({ ventanaId, unidades })))}
            >
              Recotizar
            </Button>
          </div>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}
      <Buscador valor={busqueda} onChange={setBusqueda} placeholder="Buscar por modelo o línea…" />
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
        {filtradas.map((v) => {
          const marcada = elegidas[v.id] !== undefined;
          return (
            <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <Casilla
                className="min-w-0"
                checked={marcada}
                onChange={(si) =>
                  setElegidas((prev) => {
                    const { [v.id]: _, ...resto } = prev;
                    return si ? { ...prev, [v.id]: v.unidades } : resto;
                  })
                }
                label={
                  <>
                <span className="min-w-0">
                  <span className="font-semibold text-slate-800">{v.modelo}</span>
                  <span className="text-slate-400"> · línea {v.lineaHetmo} · {Number(v.anchoMm)} × {Number(v.altoMm)} mm</span>
                </span>
                  </>
                }
              />
              <span className="flex items-center gap-1.5 shrink-0">
                <InputCompacto
                  aria-label={`Unidades de ${v.modelo}`}
                  type="number"
                  min={1}
                  max={v.unidades}
                  disabled={!marcada}
                  value={marcada ? elegidas[v.id] : ''}
                  onChange={(e) => setElegidas((prev) => ({ ...prev, [v.id]: Math.min(v.unidades, Math.max(1, Math.round(Number(e.target.value) || 1))) }))}
                  className="w-16 text-right"
                />
                <span className="text-slate-400">de {v.unidades}</span>
              </span>
            </li>
          );
        })}
        {filtradas.length === 0 && <li className="px-3 py-6 text-center text-slate-400 text-xs">Sin ventanas.</li>}
      </ul>
    </Modal>
  );
};

import React, { useState } from 'react';
import { X, PackageCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { registrarRecepcionOC, getTiposDocumento, type RecepcionOCItemCreado } from '../../api/client';
import type { OrdenCompra } from '../../types';

interface RecepcionarOCModalProps {
  ordenCompra: OrdenCompra;
  onClose: () => void;
}

interface FilaItem {
  ordenCompraItemId: string;
  descripcion: string;
  unidadMedida: string;
  pedido: number;
  yaRecibido: number;
  pendiente: number;
}

/**
 * Registra lo que Bodega efectivamente recibió de una OC (ENVIADA o
 * RECIBIDA_PARCIAL) -- POST /ordenes-compra/:id/recepciones, que ya
 * mueve stock/UnidadMaterial solo. Cada ítem recibido queda con un
 * código único (RecepcionOCItem.numero, ver mtw-api) que se muestra al
 * confirmar, para poder rotular físicamente lo que llegó.
 */
export const RecepcionarOCModal: React.FC<RecepcionarOCModalProps> = ({ ordenCompra, onClose }) => {
  const queryClient = useQueryClient();
  const { data: tiposDocumento } = useQuery({ queryKey: ['tiposDocumento'], queryFn: getTiposDocumento });
  const [tipoDocumentoId, setTipoDocumentoId] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [creados, setCreados] = useState<RecepcionOCItemCreado[] | null>(null);

  const tipoDocumentoElegido = tiposDocumento?.data.find((t) => t.id === tipoDocumentoId);

  const filas: FilaItem[] = ordenCompra.items.map((item) => {
    const yaRecibido = (item.recepciones || []).reduce((s, r) => s + Number(r.cantidadRecibida), 0);
    const pendiente = Math.max(0, Number(item.cantidad) - yaRecibido);
    return {
      ordenCompraItemId: item.id,
      descripcion: item.descripcion,
      unidadMedida: item.unidadMedida,
      pedido: Number(item.cantidad),
      yaRecibido,
      pendiente,
    };
  });

  const [cantidades, setCantidades] = useState<Record<string, string>>(
    Object.fromEntries(filas.map((f) => [f.ordenCompraItemId, f.pendiente > 0 ? String(f.pendiente) : '']))
  );

  const mutation = useMutation({
    mutationFn: () => {
      const items = filas
        .map((f) => ({ ordenCompraItemId: f.ordenCompraItemId, cantidadRecibida: parseFloat(cantidades[f.ordenCompraItemId] || '0') }))
        .filter((i) => i.cantidadRecibida > 0);
      if (items.length === 0) throw new Error('Cargá al menos una cantidad recibida.');
      // Obligatorio -- no hay recepcion "sin papel". No hay intermedios:
      // los dos van juntos, ver mismo chequeo en mtw-api.
      if (!tipoDocumentoId || !numeroDocumento.trim()) {
        throw new Error('Tipo de documento y su número son obligatorios.');
      }
      return registrarRecepcionOC(ordenCompra.id, {
        tipoDocumentoId,
        numeroDocumento: numeroDocumento.trim(),
        notas: notas.trim() || undefined,
        items,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ordenesCompra'] });
      queryClient.invalidateQueries({ queryKey: ['bodegaProyecto'] });
      queryClient.invalidateQueries({ queryKey: ['bodegaGlobal'] });
      setCreados(data.recepcion.items);
    },
    onError: (err: any) => setError(err?.response?.data?.error || err?.message || 'No se pudo registrar la recepción.'),
  });

  const hayAlgunaCantidad = Object.values(cantidades).some((v) => parseFloat(v || '0') > 0);
  const documentoCompleto = !!tipoDocumentoId && !!numeroDocumento.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">Recepcionar OC {ordenCompra.numero}</h2>
              <p className="text-[11px] text-slate-500">{ordenCompra.proveedor?.nombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {creados ? (
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-bold">Recepción registrada</span>
            </div>
            <p className="text-xs text-slate-500">
              Cada ítem recibido quedó con un código único -- podés usarlo para rotular físicamente lo que llegó.
            </p>
            <div className="space-y-1.5">
              {creados.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="font-mono font-bold text-xs text-slate-800">{c.codigo}</span>
                  <span className="text-xs text-slate-500">{c.cantidadRecibida.toLocaleString('es-CL')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Select
                label="Tipo de documento"
                options={[
                  { value: '', label: 'Selecciona...' },
                  ...(tiposDocumento?.data.map((t) => ({ value: t.id, label: t.nombre })) || []),
                ]}
                value={tipoDocumentoId}
                onChange={(e) => setTipoDocumentoId(e.target.value)}
                required
              />
              <Input
                label={`N° de ${tipoDocumentoElegido?.nombre.toLowerCase() || 'documento'}`}
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                required
              />
            </div>
            <p className="text-[11px] text-slate-400">Toda recepción necesita un documento de respaldo -- factura o guía de despacho.</p>
            <Input label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />

            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Ítems</span>
              {filas.map((f) => (
                <div key={f.ordenCompraItemId} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{f.descripcion}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      pedido {f.pedido} · recibido {f.yaRecibido} · pendiente {f.pendiente} {f.unidadMedida}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={f.pendiente}
                    value={cantidades[f.ordenCompraItemId] ?? ''}
                    onChange={(e) => setCantidades((prev) => ({ ...prev, [f.ordenCompraItemId]: e.target.value }))}
                    disabled={f.pendiente <= 0}
                    className="w-24 text-right text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-[#E34A26] disabled:bg-slate-100 disabled:text-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          {creados ? (
            <Button onClick={onClose}>Listo</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button
                isLoading={mutation.isPending}
                disabled={!hayAlgunaCantidad || !documentoCompleto}
                onClick={() => {
                  setError(null);
                  mutation.mutate();
                }}
              >
                Confirmar recepción
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

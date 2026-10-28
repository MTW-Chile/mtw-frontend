import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { guardarConfiguracionCobro } from '../../../api/client';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Aviso } from '../../../components/ui/Aviso';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ConfiguracionCobro, ConfiguracionCobroObra, HitoCobro, Proyecto } from '../../../types';
import { HITOS_COBRO } from '../../../types';
import { AYUDA_HITO, ETIQUETA_HITO } from '../obra/estadoVentana';

const CAMPO_HITO: Record<HitoCobro, keyof ConfiguracionCobro> = { MARCO: 'pctMarco', HOJA: 'pctHoja', R1: 'pctR1', RF: 'pctRF' };

/**
 * Cómo se le cobra al cliente en esta obra: el % de cada hito (suman 100) y
 * el anticipo y la retención pactados por contrato. Cambiarla no toca los
 * estados de pago ya armados (sus ítems son un snapshot).
 */
export const ConfiguracionCobroModal: React.FC<{ proyecto: Proyecto; actual: ConfiguracionCobroObra; onClose: () => void }> = ({ proyecto, actual, onClose }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ConfiguracionCobro>({
    pctMarco: actual.pctMarco,
    pctHoja: actual.pctHoja,
    pctR1: actual.pctR1,
    pctRF: actual.pctRF,
    anticipoPct: actual.anticipoPct,
    retencionPct: actual.retencionPct,
  });
  const sumaHitos = Math.round((form.pctMarco + form.pctHoja + form.pctR1 + form.pctRF) * 100) / 100;
  const set = (campo: keyof ConfiguracionCobro, v: string) => setForm((f) => ({ ...f, [campo]: Math.min(100, Math.max(0, Number(v) || 0)) }));

  const guardar = useMutation({
    mutationFn: () => guardarConfiguracionCobro(proyecto.id, form),
    onSuccess: (c) => {
      queryClient.setQueryData(['configuracionCobro', proyecto.id], c);
      queryClient.invalidateQueries({ queryKey: ['estadosPagoDisponibles', proyecto.id] });
      mostrarToast('Configuración de cobro guardada.', { tipo: 'info' });
      onClose();
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  return (
    <Modal
      icono={SlidersHorizontal}
      titulo="Configuración de cobro de la obra"
      subtitulo={proyecto.obra}
      ancho="lg"
      onClose={onClose}
      cerrable={!guardar.isPending}
      pie={
        <Modal.Pie inicio={<span className={sumaHitos === 100 ? 'text-slate-500' : 'text-red-600 font-semibold'}>Hitos: {sumaHitos.toLocaleString('es-CL')} %{sumaHitos === 100 ? '' : ' · deben sumar 100 %'}</span>}>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={sumaHitos !== 100} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar
          </Button>
        </Modal.Pie>
      }
    >
      <div className="space-y-4">
        {!actual.personalizada && <Aviso tono="info" sinIcono>Esta obra todavía usa los valores por defecto de Configuración › Comercial. Al guardar quedan fijados para la obra.</Aviso>}
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Hitos de cobro por ventana</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {HITOS_COBRO.map((h) => (
              <Input key={h} label={ETIQUETA_HITO[h]} type="number" min={0} max={100} step="any" sufijo="%" value={form[CAMPO_HITO[h]]} onChange={(e) => set(CAMPO_HITO[h], e.target.value)} helperText={AYUDA_HITO[h]} className="text-right tabular-nums" />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Pactado por contrato</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Devolución de anticipo" type="number" min={0} max={100} step="any" sufijo="%" value={form.anticipoPct} onChange={(e) => set('anticipoPct', e.target.value)} helperText="Se descuenta del avance en cada estado de pago." className="text-right tabular-nums" />
            <Input label="Retención" type="number" min={0} max={100} step="any" sufijo="%" value={form.retencionPct} onChange={(e) => set('retencionPct', e.target.value)} helperText="Lo que el cliente retiene de cada estado de pago." className="text-right tabular-nums" />
          </div>
        </div>
        <p className="text-[11px] text-slate-500">Los estados de pago ya armados no cambian: sus montos son un snapshot. El IVA se toma de Configuración › Comercial.</p>
      </div>
    </Modal>
  );
};

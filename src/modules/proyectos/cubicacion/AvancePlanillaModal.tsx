import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FastForward, FileSpreadsheet, Upload } from 'lucide-react';
import { avanzarEstadoConPlanilla } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';
import { Input } from '../../../components/ui/Input';
import { InputArchivo } from '../../../components/ui/InputArchivo';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ReporteAvancePlanilla } from '../../../types';
import { lineasAvancePlanilla } from './utils';

interface Props {
  proyectoId: string;
  onClose: () => void;
  onAvanzado: (reporte: ReporteAvancePlanilla) => void;
}

// Fecha local de hoy (no la de UTC: de noche en Chile ya es mañana en UTC).
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Lista: React.FC<{ titulo: string; ayuda: string; items: string[] }> = ({ titulo, ayuda, items }) => (
  <details className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" open={items.length <= 12}>
    <summary className="flex items-center gap-1.5 cursor-pointer font-bold">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {titulo} ({items.length})
    </summary>
    <p className="mt-1">{ayuda}</p>
    <ul className="list-disc pl-5 mt-1 space-y-0.5 max-h-56 overflow-y-auto">
      {items.map((a, i) => (
        <li key={i}>{a}</li>
      ))}
    </ul>
  </details>
);

/**
 * Avance del estado de una obra que entró al ERP ya en ejecución, desde su planilla de control: la planilla anota por
 * marco y hoja qué se despachó (y cuándo) y qué está instalado. Primero se muestra lo que se va a generar (despachos
 * de regularización sin guía, uno por fecha, ya recibidos en obra, e instalaciones sin foto) y recién al confirmar se
 * aplica. Las ventanas con avance y sin documento de fabricación no se avanzan: se listan para buscar su documento.
 * Volver a subir la planilla solo agrega lo que avanzó. No toca estados de pago, guías ni bodega.
 */
export const AvancePlanillaModal: React.FC<Props> = ({ proyectoId, onClose, onAvanzado }) => {
  const queryClient = useQueryClient();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<ReporteAvancePlanilla | null>(null);
  const [fecha, setFecha] = useState(hoy());

  const avisar = (e: unknown) => {
    const { mensaje, detalle } = extraerErrorParaToast(e);
    mostrarToast(mensaje, { detalle });
  };

  const revisar = useMutation({
    mutationFn: (a: File) => avanzarEstadoConPlanilla(proyectoId, a, { aplicar: false }),
    onSuccess: ({ reporte }) => setPrevia(reporte),
    onError: (e) => {
      setArchivo(null);
      avisar(e);
    },
  });

  const aplicar = useMutation({
    mutationFn: () => avanzarEstadoConPlanilla(proyectoId, archivo!, { aplicar: true, fecha }),
    onSuccess: ({ reporte }) => {
      for (const clave of ['cubicacion', 'cubicacionEstructura', 'cubicacionUnidades', 'instalacion', 'despachos', 'proyectoDetail', 'resumenObra']) {
        queryClient.invalidateQueries({ queryKey: [clave, proyectoId] });
      }
      queryClient.invalidateQueries({ queryKey: ['despachos'] });
      onAvanzado(reporte);
    },
    onError: avisar,
  });

  const elegir = ([a]: File[]) => {
    if (!a) return;
    if (!/\.xlsx$/i.test(a.name)) {
      mostrarToast('La planilla debe ser un archivo Excel (.xlsx).', { tipo: 'info' });
      return;
    }
    setPrevia(null);
    setArchivo(a);
    revisar.mutate(a);
  };

  const r = previa;
  const nadaQueHacer = !!r && r.avanzan.total === 0;
  // Planilla de otra obra, o que todavía no se sube en Cubicación: casi nada calza y la API no la aplica.
  const noCalza = !!r && r.sinVentana.length > r.conAvance / 2;

  return (
    <Modal
      titulo="Avanzar estado con la planilla"
      subtitulo="Deja despachado, recibido e instalado lo que la planilla ya anota, por marco y hoja"
      icono={FastForward}
      ancho="lg"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!r || nadaQueHacer || noCalza || !fecha || revisar.isPending} isLoading={aplicar.isPending} onClick={() => aplicar.mutate()}>
            {r && r.avanzan.total > 0 ? `Avanzar ${r.avanzan.total.toLocaleString('es-CL')} ventana${r.avanzan.total === 1 ? '' : 's'}` : 'Avanzar'}
          </Button>
        </Modal.Pie>
      }
    >
      <p className="text-xs text-slate-600">
        Sube la planilla de control vigente de la obra. Se leen sus columnas de <strong>despacho</strong> (fecha del marco y de la hoja) e <strong>instalación</strong> (marco y hoja) y se genera lo
        que falte: despachos de regularización sin guía, ya recibidos en obra, e instalaciones sin foto. Antes de aplicar verás el resumen. No se generan guías, estados de pago ni
        movimientos de bodega.
      </p>

      <InputArchivo accept=".xlsx" onArchivos={elegir} etiqueta="Elegir la planilla de control" data-testid="planilla-avance">
        {(abrir) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant={archivo ? 'outline' : 'primary'} size="sm" leftIcon={<Upload className="w-3.5 h-3.5" />} isLoading={revisar.isPending} disabled={aplicar.isPending} onClick={abrir}>
              {archivo ? 'Elegir otra planilla' : 'Elegir la planilla de control'}
            </Button>
            {archivo && (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 min-w-0">
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span className="truncate">{archivo.name}</span>
              </span>
            )}
          </div>
        )}
      </InputArchivo>

      {revisar.isPending && <p className="text-xs text-slate-500" role="status">Leyendo la planilla y comparándola con la obra…</p>}

      {r && (
        <div className="space-y-3" data-testid="previa-avance">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 space-y-1">
            {lineasAvancePlanilla(r).map((l, i) => (
              <p key={i} className={i === 0 ? 'font-bold text-slate-900' : undefined}>
                {l}
              </p>
            ))}
          </div>

          {noCalza && (
            <Aviso tono="advertencia">
              Más de la mitad de las filas con avance no tienen ventana en esta obra. Revisa que sea la planilla de esta obra y que ya esté subida con «Subir planilla de control».
            </Aviso>
          )}

          {r.faltaDocumento.length > 0 && (
            <Lista
              titulo="Falta su documento de fabricación"
              ayuda="La planilla las da por despachadas o instaladas, pero en el ERP no tienen documento de fabricación: no se avanzan. Busca su documento, vincúlalo en Fases y documentos y vuelve a subir la planilla."
              items={r.faltaDocumento}
            />
          )}
          {r.sinVentana.length > 0 && !noCalza && (
            <Lista titulo="Filas sin ventana en la cubicación" ayuda="Tienen avance en la planilla y no existe una ventana con ese código en ese lugar: no se avanzan." items={r.sinVentana} />
          )}
          {r.avisos.length > 0 && <Lista titulo="Avisos" ayuda="Ventanas que no quedan exactamente como dice la planilla." items={r.avisos} />}

          {!nadaQueHacer && !noCalza && (
            <Input
              label="Fecha para lo que la planilla no fecha"
              id="avance-fecha"
              type="date"
              max={hoy()}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              helperText={`La planilla no anota cuándo se instaló cada ventana: las instalaciones quedan con esta fecha${r.sinFechaDespacho > 0 ? `, igual que ${r.sinFechaDespacho.toLocaleString('es-CL')} línea(s) de despacho que figuran instaladas sin fecha de despacho` : ''}. Los demás despachos llevan la fecha de la planilla.`}
            />
          )}
        </div>
      )}
    </Modal>
  );
};

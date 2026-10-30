import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FastForward } from 'lucide-react';
import { avanzarEstadoVentanas } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';
import { Input } from '../../../components/ui/Input';
import { Textarea, OpcionesTarjeta } from '../../../components/ui/Campos';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { EstadoDestinoAvance, ReporteAvanceVentanas, SeleccionFaseCubicacion } from '../../../types';
import { etiqueta } from './estilos';
import { SelectorFaseDesdeCubicacion } from './SelectorFaseDesdeCubicacion';
import { useVocabulario } from './useVocabulario';

interface Props {
  proyectoId: string;
  onClose: () => void;
  onAvanzado: (reporte: ReporteAvanceVentanas) => void;
}

const OPCIONES: { value: EstadoDestinoAvance; label: string; ayuda: string }[] = [
  { value: 'DESPACHADA', label: 'Despachadas', ayuda: 'Salieron de la fábrica. Se genera un despacho sin guía.' },
  { value: 'RECIBIDA', label: 'Recibidas en obra', ayuda: 'Además se registra el acuse de recibo en la obra.' },
  { value: 'INSTALADA', label: 'Instaladas', ayuda: 'Además quedan certificadas como instaladas, sin foto.' },
];

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Avance masivo para una obra que entró al ERP ya en ejecución: se eligen torres, pisos,
 * departamentos o ventanas y hasta qué estado llegan. El sistema genera lo que falte de cada
 * paso (despacho de regularización sin guía, recepción, instalación sin foto), así el estado
 * sigue saliendo de los mismos documentos de siempre. No toca estados de pago ni guías.
 */
export const AvanzarEstadoModal: React.FC<Props> = ({ proyectoId, onClose, onAvanzado }) => {
  const voc = useVocabulario(proyectoId);
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const [seleccion, setSeleccion] = useState<SeleccionFaseCubicacion>({});
  const [resumenSeleccion, setResumenSeleccion] = useState('nada seleccionado todavía');
  const [hasta, setHasta] = useState<EstadoDestinoAvance>('INSTALADA');
  const [fecha, setFecha] = useState(hoy());
  const [notas, setNotas] = useState('');

  const hayAlgoSeleccionado =
    (seleccion.torreIds?.length || 0) + (seleccion.pisoIds?.length || 0) + (seleccion.unidadIds?.length || 0) + (seleccion.ventanaIndividualizadaIds?.length || 0) > 0;

  const avanzar = useMutation({
    mutationFn: () => avanzarEstadoVentanas(proyectoId, { seleccion, hasta, fecha: fecha ? new Date(`${fecha}T12:00:00`).toISOString() : undefined, notas: notas.trim() || undefined }),
    onSuccess: ({ reporte }) => {
      for (const clave of ['cubicacion', 'cubicacionEstructura', 'cubicacionUnidades', 'instalacion', 'despachos', 'proyectoDetail', 'resumenObra']) {
        queryClient.invalidateQueries({ queryKey: [clave, proyectoId] });
      }
      queryClient.invalidateQueries({ queryKey: ['despachos'] });
      onAvanzado(reporte);
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const confirmarYAvanzar = async () => {
    const destino = OPCIONES.find((o) => o.value === hasta)!.label.toLowerCase();
    if (await confirmar({ titulo: `¿Dejar como ${destino} las ventanas seleccionadas?`, mensaje: `${resumenSeleccion}. Se generan los documentos de regularización que falten; no se puede deshacer en bloque.`, confirmar: 'Avanzar' })) {
      avanzar.mutate();
    }
  };

  return (
    <Modal
      titulo="Avanzar el estado de las ventanas"
      subtitulo="Para una obra que ya estaba en ejecución: despachadas, recibidas o instaladas, de una vez"
      icono={FastForward}
      ancho="lg"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!hayAlgoSeleccionado} isLoading={avanzar.isPending} onClick={confirmarYAvanzar}>
            Avanzar
          </Button>
        </Modal.Pie>
      }
    >
      <Aviso tono="advertencia" sinIcono>
        Cada ventana parte del estado que informa su documento de fabricación y avanza hasta el que elijas. Las que ya estén más adelante no se tocan; las separadas en marco y hoja se
        omiten (se avanzan desde su ficha). No se generan guías, fotos ni estados de pago.
      </Aviso>

      <div>
        <p className={etiqueta}>Selecciona {voc.contenedor}s, pisos, {voc.unidades} o ventanas sueltas</p>
        <SelectorFaseDesdeCubicacion
          proyectoId={proyectoId}
          onChange={(s, resumen) => {
            setSeleccion(s);
            setResumenSeleccion(resumen);
          }}
        />
        <p className="text-[11px] text-slate-500 mt-1">Seleccionado: {resumenSeleccion}.</p>
      </div>

      <OpcionesTarjeta legend="Hasta qué estado" valor={hasta} onChange={setHasta} opciones={OPCIONES} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Fecha" id="avance-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} helperText="Queda en el despacho, la recepción y la instalación." />
        <Textarea label="Notas (opcional)" id="avance-notas" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={500} placeholder="Ej. regularización de obra iniciada antes del ERP" />
      </div>
    </Modal>
  );
};

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Factory } from 'lucide-react';
import { aplicarPropuestaCubicacionFabricacion, getPropuestaCubicacionFabricacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';
import { Cargando, ErrorCarga, EstadoVacio } from '../../../components/ui/Estados';
import { Lista, FilaLista } from '../../../components/ui/Lista';
import { Casilla } from '../../../components/ui/Campos';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { FilaPropuestaCubicacion, ReporteAplicacionPropuesta } from '../../../types';
import { formatoMm, textoEstadoFabricacion, varianteEstadoFabricacion } from '../fabricacion/utils';

interface Props {
  proyectoId: string;
  onClose: () => void;
  onAplicada: (reporte: ReporteAplicacionPropuesta) => void;
}

/**
 * Importar a la cubicación las ventanas de los documentos de fabricación de una obra legacy:
 * cada ventana del lote entra con su tipo (el código del modelo), su medida final y su documento,
 * sin posición. Dónde va cada una se decide después en el cubicador visual, filtrando por documento.
 */
export const ImportarFabricacionModal: React.FC<Props> = ({ proyectoId, onClose, onAplicada }) => {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['propuestaFabricacion', proyectoId], queryFn: () => getPropuestaCubicacionFabricacion(proyectoId) });
  const [excluidos, setExcluidos] = useState<Set<string>>(new Set());

  const documentos = useMemo(() => (data?.documentos ?? []).filter((d) => d.ventanas.length > 0), [data]);
  const elegidos = documentos.filter((d) => !excluidos.has(d.fabricacionId));
  const totalVentanas = elegidos.reduce((s, d) => s + d.ventanas.reduce((x, v) => x + v.unidades, 0), 0);

  const importar = useMutation({
    mutationFn: () => {
      // Sin posición: tipo y documento vienen del lote; torre, piso y depto se asignan en el cubicador visual.
      const ventanas: FilaPropuestaCubicacion[] = elegidos.flatMap((d) =>
        d.ventanas.map((v) => ({ fabricacionVentanaId: v.fabricacionVentanaId, codigo: v.codigo, torre: '', piso: null, unidad: null, especial: false, ubicacion: null }))
      );
      return aplicarPropuestaCubicacionFabricacion(proyectoId, ventanas);
    },
    onSuccess: ({ reporte }) => {
      queryClient.invalidateQueries({ queryKey: ['propuestaFabricacion', proyectoId] });
      onAplicada(reporte);
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const alternar = (id: string, incluir: boolean) =>
    setExcluidos((s) => {
      const n = new Set(s);
      if (incluir) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Modal
      titulo="Importar ventanas de fabricación"
      subtitulo={data ? `${data.resumen.ventanas} ventana(s) fabricada(s) todavía fuera de la cubicación` : undefined}
      icono={Factory}
      ancho="lg"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={totalVentanas === 0} isLoading={importar.isPending} onClick={() => importar.mutate()}>
            Importar {totalVentanas} ventana(s)
          </Button>
        </Modal.Pie>
      }
    >
      {isLoading ? (
        <Cargando texto="Leyendo los documentos de fabricación…" />
      ) : isError || !data ? (
        <ErrorCarga que="los documentos" onReintentar={refetch} />
      ) : documentos.length === 0 ? (
        <EstadoVacio icono={Factory} titulo="No hay ventanas por importar" descripcion="Todas las ventanas de los documentos vinculados ya están en la cubicación, o la obra no tiene documentos de fabricación todavía (Fases y documentos › Vincular documentos)." />
      ) : (
        <div className="space-y-4">
          <Aviso tono="info" sinIcono>
            Cada ventana entra con su tipo (el código del modelo del lote), la medida con que se fabricó y su documento, sin posición. Después las ubicas en el cubicador visual, filtrando
            por documento.
          </Aviso>

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <Lista>
              {documentos.map((d) => {
                const n = d.ventanas.reduce((x, v) => x + v.unidades, 0);
                return (
                  <FilaLista
                    key={d.fabricacionId}
                    inicio={<Casilla checked={!excluidos.has(d.fabricacionId)} onChange={(v) => alternar(d.fabricacionId, v)} aria-label={`Importar ${d.nombre || d.descripcion || d.hetmoId}`} />}
                    titulo={d.nombre || d.descripcion || `Documento ${d.hetmoId}`}
                    insignias={
                      <Badge size="sm" variant={varianteEstadoFabricacion(d.estadoHetmo)}>
                        {textoEstadoFabricacion(d.estadoHetmo, d.estadoGlosa)}
                      </Badge>
                    }
                  >
                    <span className="font-mono">
                      {n} ventana(s)
                      {d.nombre && d.descripcion && d.nombre !== d.descripcion ? ` · HETMO: ${d.descripcion}` : ''} · N° {d.numero ?? '—'}
                    </span>
                  </FilaLista>
                );
              })}
            </Lista>
          </div>

          {data.tipos.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tipos que se crean o reutilizan</p>
              <div className="flex flex-wrap gap-1.5">
                {data.tipos.map((t) => (
                  <Badge key={t.codigo} size="sm" variant={t.existente ? 'outline' : 'brand'} title={`${t.sistema} · ${formatoMm(t.anchoMm)} × ${formatoMm(t.altoMm)} mm${t.cuadros !== null ? ` · ${t.cuadros} hoja(s)` : ''}`}>
                    {t.codigo} · {t.ventanas}
                    {t.existente ? ' · ya existe' : ''}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
};

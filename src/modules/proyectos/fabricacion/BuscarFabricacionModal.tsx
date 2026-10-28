import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Link2 } from 'lucide-react';
import { buscarFabricacionesHetmo, vincularFabricacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Casilla } from '../../../components/ui/Campos';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import { BREAKPOINT_DESKTOP } from '../../../lib/designSystem';
import type { FabricacionHetmoBusqueda, ResultadoVinculoFabricacion } from '../../../types';
import { formatoFechaHora, textoEstadoFabricacion, textoVinculacionCubicacion, textoVinculosMultiples, varianteEstadoFabricacion } from './utils';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { Modal } from '../../../components/ui/Modal';
import { Buscador } from '../../../components/ui/Buscador';

interface Props {
  proyectoId: string;
  onClose: () => void;
}

// Busca documentos de fabricacion de HETMO (los sueltos de una obra manual,
// por ejemplo "EX_P21") y los vincula a esta obra. Sin texto, lista los mas
// recientes. Un documento ya vinculado a otra obra no se puede vincular.
// Una obra manual tiene varios documentos (uno por piso): se marcan los que
// correspondan y se vinculan de una vez; cada uno se lee de HETMO por su
// cuenta, asi que uno que falle no frena a los demas.
export const BuscarFabricacionModal: React.FC<Props> = ({ proyectoId, onClose }) => {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState<number[]>([]);
  // Mientras se vinculan, cual va (para la fila) y cuales ya quedaron.
  const [enCurso, setEnCurso] = useState<number | null>(null);

  // Espera a que termine de escribir antes de consultar a HETMO.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto.trim()), 400);
    return () => clearTimeout(t);
  }, [texto]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['hetmoFabricaciones', busqueda],
    queryFn: () => buscarFabricacionesHetmo({ q: busqueda || undefined, limite: 100 }),
    staleTime: 1000 * 30,
    refetchInterval: false,
  });

  const lotes = useMemo(() => data ?? [], [data]);
  const disponibles = useMemo(() => lotes.filter((l) => !l.vinculadoA).map((l) => l.hetmo), [lotes]);
  // Solo cuentan los marcados que siguen en la lista y sin vincular (la busqueda puede cambiar).
  const marcados = seleccion.filter((h) => disponibles.includes(h));

  const vincular = useMutation({
    mutationFn: async (hetmoIds: number[]) => {
      const resultados: ResultadoVinculoFabricacion[] = [];
      const fallidos: string[] = [];
      for (const hetmoId of hetmoIds) {
        setEnCurso(hetmoId);
        try {
          resultados.push(await vincularFabricacion(proyectoId, hetmoId));
          setSeleccion((s) => s.filter((h) => h !== hetmoId));
        } catch (e) {
          const lote = lotes.find((l) => l.hetmo === hetmoId);
          fallidos.push(`${lote?.descripcion || `HETMO ${hetmoId}`}: ${extraerErrorParaToast(e).mensaje}`);
        }
      }
      setEnCurso(null);
      return { resultados, fallidos };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['fabricaciones', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['hetmoFabricaciones'] });
    },
    onSuccess: ({ resultados, fallidos }) => {
      if (resultados.length === 1 && fallidos.length === 0) {
        const r = resultados[0];
        mostrarToast(
          `Documento vinculado: ${r.ventanas.nuevas} ventana(s) leídas${r.advertencias.length ? `. ${r.advertencias.join(' ')}` : ''}` +
            (r.vinculacionCubicacion ? ` ${textoVinculacionCubicacion(r.vinculacionCubicacion)}` : '.'),
          { tipo: 'info' }
        );
        return;
      }
      mostrarToast(textoVinculosMultiples(resultados, fallidos), { tipo: fallidos.length ? 'error' : 'info' });
    },
  });

  const alternar = (hetmoId: number, marcar: boolean) => setSeleccion((s) => (marcar ? [...new Set([...s, hetmoId])] : s.filter((h) => h !== hetmoId)));
  const todosMarcados = disponibles.length > 0 && disponibles.every((h) => marcados.includes(h));

  const accion = (l: FabricacionHetmoBusqueda) => {
    if (l.vinculadoA) {
      const aqui = l.vinculadoA.id === proyectoId;
      return (
        <span className="text-[11px] text-slate-500" title={l.vinculadoA.obra}>
          {aqui ? 'Ya vinculado a esta obra' : `Vinculado a ${l.vinculadoA.obra}`}
        </span>
      );
    }
    if (enCurso === l.hetmo) return <Loader2 className="w-4 h-4 animate-spin text-brand-600" aria-label="Vinculando" />;
    return (
      <Casilla
        checked={marcados.includes(l.hetmo)}
        disabled={vincular.isPending}
        onChange={(v) => alternar(l.hetmo, v)}
        aria-label={`Marcar ${l.descripcion || `documento ${l.hetmo}`} para vincular`}
      />
    );
  };

  const etiquetaVenta = (l: FabricacionHetmoBusqueda) =>
    l.hetmo_venta
      ? `Venta ${l.hetmo_venta}${l.venta_fase ? ` · fase ${l.venta_fase}` : ''}${l.hetmo_madre ? ` (madre ${l.hetmo_madre})` : ''}`
      : 'Sin documento de venta';

  return (
    <Modal
      titulo="Vincular documentos de fabricación"
      subtitulo="Busca por descripción (ej. EX_P21), referencia o número, marca los documentos de esta obra y vincúlalos de una vez. Los datos se leen de HETMO; no se modifica nada allá."
      ancho="xl"
      onClose={onClose}
      cuerpoClassName="flex flex-col flex-1 min-h-0 pt-4"
      pie={
        <Modal.Pie
          inicio={
            disponibles.length > 0 && (
              <Casilla
                checked={todosMarcados}
                disabled={vincular.isPending}
                onChange={(v) => setSeleccion(v ? disponibles : [])}
                label={`Marcar los ${disponibles.length} disponibles de la lista`}
              />
            )
          }
        >
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={vincular.isPending}>
            {marcados.length ? 'Cancelar' : 'Cerrar'}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Link2 className="w-3.5 h-3.5" />}
            disabled={marcados.length === 0}
            isLoading={vincular.isPending}
            onClick={() => vincular.mutate(marcados)}
          >
            {marcados.length > 1 ? `Vincular ${marcados.length} documentos` : 'Vincular documento'}
          </Button>
        </Modal.Pie>
      }
    >
      <div className="px-5 pb-3 shrink-0">
        <Buscador autoFocus valor={texto} onChange={setTexto} placeholder="Buscar documento de fabricación…" cargando={isFetching} />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 min-h-[12rem]">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="p-8 text-center rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            No se pudo consultar HETMO. Intenta de nuevo en unos minutos.
          </div>
        ) : lotes.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs">
            {busqueda ? 'Ningún documento de fabricación coincide con la búsqueda.' : 'HETMO no devolvió documentos de fabricación.'}
          </div>
        ) : isDesktop ? (
          <Tabla>
            <Thead>
              <Tr className="border-b border-slate-100 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <Th className="pr-3 font-bold w-8"></Th>
                <Th className="pr-3 font-bold">Documento</Th>
                <Th className="pr-3 font-bold">Estado</Th>
                <Th className="pr-3 font-bold">Documento de venta</Th>
                <Th className="pr-3 font-bold">Fecha</Th>
              </Tr>
            </Thead>
            <Tbody>
              {lotes.map((l) => (
                <Tr
                  key={l.hetmo}
                  className={`border-b border-slate-50 align-middle ${!l.vinculadoA && !vincular.isPending ? 'cursor-pointer hover:bg-slate-50/70' : ''} ${marcados.includes(l.hetmo) ? 'bg-brand-50/40' : ''}`}
                  onClick={() => !l.vinculadoA && !vincular.isPending && alternar(l.hetmo, !marcados.includes(l.hetmo))}
                >
                  <Td className="pr-3 w-8" onClick={(e) => e.stopPropagation()}>{accion(l)}</Td>
                  <Td className="pr-3 min-w-0">
                    <div className="font-bold text-slate-900 truncate max-w-[16rem]" title={l.descripcion ?? ''}>
                      {l.descripcion || '(sin descripción)'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      N° {l.numero ?? '—'}
                      {l.referencia ? ` · ref. ${l.referencia}` : ''} · HETMO {l.hetmo}
                    </div>
                  </Td>
                  <Td className="pr-3">
                    <Badge size="sm" variant={varianteEstadoFabricacion(l.estado_documento)}>
                      {textoEstadoFabricacion(l.estado_documento, l.estado_glosa_pantalla || l.estado_glosa)}
                    </Badge>
                  </Td>
                  <Td className="pr-3 text-[11px] text-slate-600">{etiquetaVenta(l)}</Td>
                  <Td className="pr-3 text-[11px] text-slate-500 whitespace-nowrap">{formatoFechaHora(l.fecha)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Tabla>
        ) : (
          <div className="divide-y divide-slate-100">
            {lotes.map((l) => (
              <div key={l.hetmo} className={`py-3 space-y-1.5 ${marcados.includes(l.hetmo) ? 'bg-brand-50/40 -mx-5 px-5' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="shrink-0 pt-0.5 min-w-6">{accion(l)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold text-slate-900 truncate">{l.descripcion || '(sin descripción)'}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      N° {l.numero ?? '—'} · HETMO {l.hetmo}
                    </div>
                  </div>
                  <Badge size="sm" variant={varianteEstadoFabricacion(l.estado_documento)}>
                    {textoEstadoFabricacion(l.estado_documento, l.estado_glosa_pantalla || l.estado_glosa)}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 pl-8">{etiquetaVenta(l)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

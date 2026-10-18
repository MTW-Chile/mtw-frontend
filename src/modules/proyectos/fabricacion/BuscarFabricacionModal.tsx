import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Link2, Search } from 'lucide-react';
import { buscarFabricacionesHetmo, vincularFabricacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { mostrarToast } from '../../../lib/toast';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import { BREAKPOINT_DESKTOP } from '../../../lib/designSystem';
import type { FabricacionHetmoBusqueda } from '../../../types';
import { formatoFechaHora, textoEstadoFabricacion, textoVinculacionCubicacion, varianteEstadoFabricacion } from './utils';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { Modal } from '../../../components/ui/Modal';

interface Props {
  proyectoId: string;
  onClose: () => void;
}

// Busca documentos de fabricacion de HETMO (los sueltos de una obra manual,
// por ejemplo "EX_P21") y los vincula a esta obra. Sin texto, lista los mas
// recientes. Un documento ya vinculado a otra obra no se puede vincular.
export const BuscarFabricacionModal: React.FC<Props> = ({ proyectoId, onClose }) => {
  const queryClient = useQueryClient();
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');

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

  const vincular = useMutation({
    mutationFn: (hetmoId: number) => vincularFabricacion(proyectoId, hetmoId),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['fabricaciones', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['hetmoFabricaciones'] });
      mostrarToast(
        `Documento vinculado: ${r.ventanas.nuevas} ventana(s) leídas${r.advertencias.length ? `. ${r.advertencias.join(' ')}` : ''}` +
          (r.vinculacionCubicacion ? ` ${textoVinculacionCubicacion(r.vinculacionCubicacion)}` : '.'),
        { tipo: 'info' }
      );
    },
  });

  const lotes = data ?? [];

  const accion = (l: FabricacionHetmoBusqueda) => {
    if (l.vinculadoA) {
      const aqui = l.vinculadoA.id === proyectoId;
      return (
        <span className="text-[11px] text-slate-500" title={l.vinculadoA.obra}>
          {aqui ? 'Ya vinculado a esta obra' : `Vinculado a ${l.vinculadoA.obra}`}
        </span>
      );
    }
    const enCurso = vincular.isPending && vincular.variables === l.hetmo;
    return (
      <Button
        size="sm"
        variant="primary"
        leftIcon={<Link2 className="w-3.5 h-3.5" />}
        isLoading={enCurso}
        disabled={vincular.isPending}
        onClick={() => vincular.mutate(l.hetmo)}
      >
        Vincular
      </Button>
    );
  };

  const etiquetaVenta = (l: FabricacionHetmoBusqueda) =>
    l.hetmo_venta
      ? `Venta ${l.hetmo_venta}${l.venta_fase ? ` · fase ${l.venta_fase}` : ''}${l.hetmo_madre ? ` (madre ${l.hetmo_madre})` : ''}`
      : 'Sin documento de venta';

  return (
    <Modal
      titulo="Vincular documento de fabricación"
      subtitulo="Busca por descripción (ej. EX_P21), referencia o número. Los datos se leen de HETMO; no se modifica nada allá."
      ancho="xl"
      onClose={onClose}
    >
      <div className="px-5 pb-3 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar documento de fabricación..."
            maxLength={100}
            className="w-full pl-9 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600"
          />
          {isFetching && <Loader2 className="w-4 h-4 text-slate-400 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
        </div>
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
                <Th className="pr-3 font-bold">Documento</Th>
                <Th className="pr-3 font-bold">Estado</Th>
                <Th className="pr-3 font-bold">Documento de venta</Th>
                <Th className="pr-3 font-bold">Fecha</Th>
                <Th alinear="derecha" className="font-bold"></Th>
              </Tr>
            </Thead>
            <Tbody>
              {lotes.map((l) => (
                <Tr key={l.hetmo} className="border-b border-slate-50 align-middle">
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
                  <Td alinear="derecha">{accion(l)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Tabla>
        ) : (
          <div className="divide-y divide-slate-100">
            {lotes.map((l) => (
              <div key={l.hetmo} className="py-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{l.descripcion || '(sin descripción)'}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      N° {l.numero ?? '—'} · HETMO {l.hetmo}
                    </div>
                  </div>
                  <Badge size="sm" variant={varianteEstadoFabricacion(l.estado_documento)}>
                    {textoEstadoFabricacion(l.estado_documento, l.estado_glosa_pantalla || l.estado_glosa)}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500">{etiquetaVenta(l)}</div>
                <div>{accion(l)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
};

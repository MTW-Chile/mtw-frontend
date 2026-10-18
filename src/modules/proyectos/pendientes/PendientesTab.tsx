import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Loader2, Paperclip, Plus } from 'lucide-react';
import { getPendientes, getPendientesTodos } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { useMediaQuery } from '../../../lib/useMediaQuery';
import { BREAKPOINT_DESKTOP } from '../../../lib/designSystem';
import type { DestinoPendiente, EstadoPendiente, ObraPendiente, Proyecto } from '../../../types';
import { formatoFechaHora } from '../fabricacion/utils';
import { NuevoPendienteModal } from './NuevoPendienteModal';
import { PendienteDetalleModal } from './PendienteDetalleModal';
import {
  DESTINOS_PENDIENTE,
  ESTADOS_PENDIENTE,
  ETIQUETA_DESTINO,
  ETIQUETA_ESTADO,
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  codigoPendiente,
  contarPorEstado,
  referenciaPendiente,
  textoEstadoPendiente,
  textoRectificacion,
  varianteEstadoPendiente,
} from './utils';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';
import { SelectCompacto } from '../../../components/ui/Campos';
import { Buscador } from '../../../components/ui/Buscador';
import { Segmentado } from '../../../components/ui/Segmentado';
import { BotonFila } from '../../../components/ui/Lista';

interface Props {
  // Sin obra: visor central con los pendientes de todas las obras.
  proyecto?: Proyecto;
}


// Seccion "Control de pendientes" de una obra: lo que falta o fallo (ventanas,
// hojas, vidrios, materiales), levantado por Fabricacion o por la supervision en
// obra. Cada pendiente va a Compras o a Fabricacion, sigue sus etapas y lo
// resuelve quien lo creo. Sin `proyecto` es el visor central (Pendientes en
// obra del Sidebar): todos los pendientes de todas las obras, con su obra.
export const PendientesTab: React.FC<Props> = ({ proyecto }) => {
  const isDesktop = useMediaQuery(BREAKPOINT_DESKTOP);
  const [estado, setEstado] = useState<EstadoPendiente | ''>('');
  const [destino, setDestino] = useState<DestinoPendiente | ''>('');
  const [texto, setTexto] = useState('');
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState<ObraPendiente | null>(null);
  const [obraId, setObraId] = useState('');
  const central = !proyecto;

  const { data, isLoading, isError } = useQuery({
    queryKey: proyecto ? ['pendientes', proyecto.id] : ['pendientes', 'todas'],
    queryFn: () => (proyecto ? getPendientes(proyecto.id) : getPendientesTodos()),
  });
  // Obras con pendientes, para filtrar el visor central.
  const obras = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const p of data ?? []) if (p.proyecto) mapa.set(p.proyecto.id, p.proyecto.obra);
    return [...mapa].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [data]);
  const todos = useMemo(() => data ?? [], [data]);
  const conteo = useMemo(() => contarPorEstado(todos), [todos]);

  const visibles = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return todos.filter((p) => {
      if (estado && p.estado !== estado) return false;
      if (destino && p.destino !== destino) return false;
      if (obraId && p.proyectoId !== obraId) return false;
      if (!t) return true;
      return `${codigoPendiente(p.numero)} ${p.descripcion} ${referenciaPendiente(p)} ${p.proyecto?.obra ?? ''}`.toLowerCase().includes(t);
    });
  }, [todos, estado, destino, texto, obraId]);
  const codigoObra = (p: ObraPendiente) => (p.proyecto ? p.proyecto.codigoInterno || `PRJ-${p.proyecto.numeroPresupuesto}` : '');

  const filas = (p: ObraPendiente) => ({
    codigo: codigoPendiente(p.numero),
    referencia: referenciaPendiente(p),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">{central ? 'Pendientes en obra' : 'Control de pendientes'}</h2>
          <p className="text-xs text-slate-500 max-w-xl">
            {central
              ? 'Todos los pendientes de todas las obras: lo que falta o falló, su área, su estado y quién lo solicitó. Se crean desde cada obra.'
              : 'Lo que falta o falló en esta obra, solicitado desde la obra o desde la fábrica. Cada pendiente va solo al área que corresponde (técnica o fábrica) y lo resuelve quien lo solicitó.'}
          </p>
        </div>
        {proyecto && (
          <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setCreando(true)}>
            Nuevo pendiente
          </Button>
        )}
      </div>

      {/* Resumen por estado: cada uno filtra la lista */}
      <Segmentado
        etiqueta="Filtrar por estado"
        valor={estado}
        onChange={(v) => setEstado(v === estado ? '' : v)}
        opciones={[{ value: '' as const, label: 'Todos' }, ...ESTADOS_PENDIENTE.map((e) => ({ value: e, label: ETIQUETA_ESTADO[e], contador: conteo[e] }))]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Buscador
          className="flex-1 min-w-[12rem]"
          valor={texto}
          onChange={setTexto}
          placeholder={central ? 'Buscar por obra, número, descripción o ventana…' : 'Buscar por número, descripción o ventana…'}
          etiqueta="Buscar pendientes"
        />
        {central && (
          <SelectCompacto value={obraId} onChange={(e) => setObraId(e.target.value)} aria-label="Filtrar por obra" className="max-w-[16rem]">
            <option value="">Todas las obras</option>
            {obras.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </SelectCompacto>
        )}
        <SelectCompacto value={destino} onChange={(e) => setDestino(e.target.value as DestinoPendiente | '')} aria-label="Filtrar por área">
          <option value="">Todas las áreas</option>
          {DESTINOS_PENDIENTE.map((d) => (
            <option key={d} value={d}>
              {ETIQUETA_DESTINO[d]}
            </option>
          ))}
        </SelectCompacto>
      </div>

      {isLoading ? (
        <div className="p-12 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          No se pudieron cargar los pendientes. Intenta de nuevo en unos minutos.
        </div>
      ) : todos.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-1">
          <ClipboardList className="w-6 h-6 text-slate-300 mx-auto" />
          <p className="font-bold text-slate-700">{central ? 'No hay pendientes en ninguna obra.' : 'Esta obra aún no tiene pendientes.'}</p>
          <p>{central ? 'Se registran desde el Control de pendientes de cada obra.' : 'Usa "Nuevo pendiente" para registrar lo que falta o falló en una ventana, hoja, vidrio o material.'}</p>
        </div>
      ) : visibles.length === 0 ? (
        <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs">Ningún pendiente coincide con los filtros.</div>
      ) : isDesktop ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <Tabla>
            <Thead>
              <Tr className="border-b border-slate-100 bg-slate-50/70 text-left text-slate-500 uppercase tracking-wider text-[10px]">
                <Th className="font-bold">N°</Th>
                {central && <Th className="font-bold">Obra</Th>}
                <Th className="font-bold">Pendiente</Th>
                <Th className="font-bold">Motivo</Th>
                <Th className="font-bold">Área</Th>
                <Th className="font-bold">Estado</Th>
                <Th className="font-bold">Solicitante</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visibles.map((p) => {
                const f = filas(p);
                return (
                  <Tr key={p.id} onClick={() => setAbierto(p)} className="border-b border-slate-50 hover:bg-slate-50/70 cursor-pointer">
                    <Td className="font-mono font-bold text-slate-600 whitespace-nowrap">{f.codigo}</Td>
                    {central && (
                      <Td className="max-w-[14rem]">
                        <div className="font-semibold text-slate-800 truncate" title={p.proyecto?.obra}>
                          {p.proyecto?.obra}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">{codigoObra(p)}</div>
                      </Td>
                    )}
                    <Td className="min-w-0 max-w-[26rem]">
                      <div className="font-bold text-slate-900 truncate" title={p.descripcion}>
                        <Badge size="sm" variant="outline" className="mr-1.5 align-middle">
                          {ETIQUETA_TIPO[p.tipo]}
                        </Badge>
                        {p.descripcion}
                        {!!p._count?.adjuntos && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 align-middle" title={`${p._count.adjuntos} adjunto(s)`}>
                            <Paperclip className="w-3 h-3" />
                            {p._count.adjuntos}
                          </span>
                        )}
                      </div>
                      {f.referencia && <div className="text-[11px] text-slate-500 truncate">{f.referencia}</div>}
                      {textoRectificacion(p) && <div className="text-[11px] font-bold text-brand-700 truncate">{textoRectificacion(p)}</div>}
                    </Td>
                    <Td className="text-slate-600 whitespace-nowrap">{ETIQUETA_MOTIVO[p.motivo]}</Td>
                    <Td className="text-slate-600 whitespace-nowrap">{ETIQUETA_DESTINO[p.destino]}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge size="sm" variant={varianteEstadoPendiente(p.estado)}>
                        {textoEstadoPendiente(p)}
                      </Badge>
                    </Td>
                    <Td className="text-[11px] text-slate-500 whitespace-nowrap">
                      {p.reportadoPor?.nombre || '—'}
                      <div>{formatoFechaHora(p.fechaReporte)}</div>
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Tabla>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm divide-y divide-slate-100">
          {visibles.map((p) => {
            const f = filas(p);
            return (
              <BotonFila key={p.id} onClick={() => setAbierto(p)} className="px-4! py-3.5! space-y-1.5">
                {central && <p className="text-[11px] font-semibold text-slate-500 truncate">{p.proyecto?.obra} · {codigoObra(p)}</p>}
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-xs text-slate-600">{f.codigo}</span>
                  <Badge size="sm" variant={varianteEstadoPendiente(p.estado)}>
                    {textoEstadoPendiente(p)}
                  </Badge>
                </div>
                <p className="text-sm font-bold text-slate-900 break-words">
                  {p.descripcion}
                  {!!p._count?.adjuntos && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-slate-400 align-middle">
                      <Paperclip className="w-3 h-3" />
                      {p._count.adjuntos}
                    </span>
                  )}
                </p>
                {f.referencia && <p className="text-[11px] text-slate-500">{f.referencia}</p>}
                {textoRectificacion(p) && <p className="text-[11px] font-bold text-brand-700">{textoRectificacion(p)}</p>}
                <p className="text-[11px] text-slate-500">
                  {ETIQUETA_TIPO[p.tipo]} · {ETIQUETA_MOTIVO[p.motivo]} · {ETIQUETA_DESTINO[p.destino]}
                </p>
              </BotonFila>
            );
          })}
        </div>
      )}

      {creando && proyecto && <NuevoPendienteModal proyecto={proyecto} onClose={() => setCreando(false)} onCreado={() => setCreando(false)} />}
      {abierto && <PendienteDetalleModal proyectoId={abierto.proyectoId} pendienteId={abierto.id} onClose={() => setAbierto(null)} />}
    </div>
  );
};

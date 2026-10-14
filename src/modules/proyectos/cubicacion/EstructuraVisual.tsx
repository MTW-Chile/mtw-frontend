import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Copy, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { asignarVentanasCubicacion, editarUnidadCubicacion, eliminarLugarCubicacion, getEstructuraCubicacion, quitarPosicionVentanaCubicacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { Cubicacion, NodoTorreCubicacion, TipoCubicacion, UnidadCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { AsignarModal, ArmarEdificioModal, CopiarPisoModal, DeptosModal, PisosModal, RenombrarTorreModal, TorreModal } from './EstructuraModales';
import { UnidadModal } from './UnidadModal';
import { mensajeAsignacion, textoTorre } from './utils';

interface Props {
  proyectoId: string;
  cubicacion: Cubicacion;
  tipos: TipoCubicacion[];
}

type Lugar = { torre: string; piso: number; dpto: number };
type ModalAbierto =
  | { tipo: 'armar' }
  | { tipo: 'torre' }
  | { tipo: 'renombrar'; torre: string }
  | { tipo: 'pisos'; torre: string; sugerido: number }
  | { tipo: 'deptos'; torre: string; piso?: number }
  | { tipo: 'copiar'; torre: NodoTorreCubicacion; piso: number }
  | { tipo: 'asignar'; lugar: Lugar }
  | { tipo: 'ventana'; unidad: UnidadCubicacion };

const aviso = (e: unknown) => {
  const { mensaje, detalle } = extraerErrorParaToast(e);
  mostrarToast(mensaje, { detalle });
};

const numeroDepto = (piso: number, dpto: number) => `${piso}${String(dpto).padStart(2, '0')}`;
const claveLugar = (l: Lugar) => `${l.torre}|${l.piso}|${l.dpto}`;
const contarVentanas = (t: NodoTorreCubicacion) => t.pisos.reduce((s, p) => s + p.deptos.reduce((x, d) => x + d.ventanas.length, 0), 0);

// Cubicador visual: se arma el edificio (torres -> pisos -> departamentos) y se le van asignando las ventanas
// del presupuesto. Escribe los mismos campos que la planilla Excel (torre, piso, depto, ubicacion), asi que la
// planilla, la lista de ventanas y el informe para HETMO salen identicos.
export const EstructuraVisual: React.FC<Props> = ({ proyectoId, cubicacion, tipos }) => {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalAbierto | null>(null);
  const [activo, setActivo] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');

  const { data, isLoading, isError } = useQuery({ queryKey: ['cubicacion', proyectoId, 'estructura'], queryFn: () => getEstructuraCubicacion(proyectoId) });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['cubicacion', proyectoId] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyectoId] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyectoId] });
  };

  const ventanasTipos = tipos.filter((t) => !t.esAreaComun).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  const tipoActivo = ventanasTipos.find((t) => t.id === activo) ?? null;
  const visibles = ventanasTipos.filter((t) => !buscar.trim() || `${t.codigo} ${t.sistema}`.toLowerCase().includes(buscar.trim().toLowerCase()));

  const asignarUna = useMutation({
    mutationFn: ({ lugar, tipo, exceder }: { lugar: Lugar; tipo: TipoCubicacion; exceder: boolean }) =>
      asignarVentanasCubicacion(proyectoId, { ...lugar, tipoId: tipo.id, cantidad: 1, excederContratadas: exceder }),
    onSuccess: (r, v) => {
      if (r.faltan > 0) mostrarToast(mensajeAsignacion(r, v.tipo.codigo), { tipo: 'info' });
      refrescar();
    },
    onError: aviso,
  });
  const mover = useMutation({
    mutationFn: ({ id, lugar }: { id: string; lugar: Lugar }) => editarUnidadCubicacion(id, { torre: lugar.torre || null, piso: lugar.piso, dpto: lugar.dpto }),
    onSuccess: refrescar,
    onError: aviso,
  });
  const quitar = useMutation({ mutationFn: (id: string) => quitarPosicionVentanaCubicacion(id), onSuccess: refrescar, onError: aviso });
  const eliminar = useMutation({
    mutationFn: (p: { torre: string; piso?: number; dpto?: number }) => eliminarLugarCubicacion(proyectoId, p),
    onSuccess: (r) => {
      if (r.ventanasSinPosicion > 0) mostrarToast(`${r.ventanasSinPosicion} ventana(s) volvieron a "por ubicar".`, { tipo: 'info' });
      refrescar();
    },
    onError: aviso,
  });

  const agregarUna = (lugar: Lugar, tipo: TipoCubicacion) => {
    const exceder = tipo.saldo <= 0;
    if (exceder && !window.confirm(`Ya están ubicadas todas las ${tipo.codigo} contratadas (${tipo.cantidadContratada}). ¿Agregar una de más igualmente?`)) return;
    asignarUna.mutate({ lugar, tipo, exceder });
  };

  const soltarEnDepto = (e: React.DragEvent, lugar: Lugar) => {
    e.preventDefault();
    setSobre(null);
    const dato = e.dataTransfer.getData('text/plain');
    if (dato.startsWith('tipo:')) {
      const tipo = ventanasTipos.find((t) => t.id === dato.slice(5));
      if (tipo) agregarUna(lugar, tipo);
    } else if (dato.startsWith('ventana:')) {
      mover.mutate({ id: dato.slice(8), lugar });
    }
  };
  const soltarEnPool = (e: React.DragEvent) => {
    e.preventDefault();
    setSobre(null);
    const dato = e.dataTransfer.getData('text/plain');
    if (dato.startsWith('ventana:')) quitar.mutate(dato.slice(8));
  };

  const confirmarEliminar = (texto: string, p: { torre: string; piso?: number; dpto?: number }) => {
    if (window.confirm(`${texto}\n\nSus ventanas no se borran: vuelven a "por ubicar".`)) eliminar.mutate(p);
  };

  if (isLoading) {
    return (
      <div className="p-10 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className="p-6 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">No se pudo cargar la estructura. Intenta de nuevo en unos minutos.</div>;
  }

  const vacia = data.torres.length === 0;
  const base = { proyectoId, onClose: () => setModal(null), onHecho: refrescar };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 max-w-3xl">
          Arma el edificio y ubica cada ventana. Arrastra un tipo de la izquierda a un departamento (o elige uno y usa <b>+ 1</b>); arrastra una ventana a otro departamento para moverla, o de vuelta a la
          izquierda para sacarla. Es la misma información que la planilla Excel.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" leftIcon={<Building2 className="w-3.5 h-3.5" />} onClick={() => setModal({ tipo: 'armar' })}>
            {vacia ? 'Armar el edificio' : 'Ampliar el edificio'}
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModal({ tipo: 'torre' })}>
            Agregar torre
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[17rem_1fr] gap-4 items-start">
        {/* Ventanas por ubicar */}
        <aside
          className={`rounded-2xl bg-white border shadow-sm p-3 space-y-2 lg:sticky lg:top-4 ${sobre === 'pool' ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200'}`}
          onDragOver={(e) => {
            e.preventDefault();
            setSobre('pool');
          }}
          onDragLeave={() => setSobre(null)}
          onDrop={soltarEnPool}
          data-testid="pool-ventanas"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Por ubicar</p>
            <Badge size="sm" variant={data.sinPosicion > 0 ? 'warning' : 'success'}>
              {data.sinPosicion > 0 ? `${data.sinPosicion} ventanas` : 'todas ubicadas'}
            </Badge>
          </div>
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar V01, corredera…" aria-label="Buscar tipo de ventana" className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs" />
          <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-0.5">
            {visibles.length === 0 && <p className="text-xs text-slate-400 py-3 text-center">No hay tipos.</p>}
            {visibles.map((t) => {
              const completo = t.saldo <= 0;
              return (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', `tipo:${t.id}`)}
                  onClick={() => setActivo(activo === t.id ? null : t.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setActivo(activo === t.id ? null : t.id);
                  }}
                  aria-pressed={activo === t.id}
                  data-testid={`pool-tipo-${t.codigo}`}
                  title={`${t.codigo} · ${t.sistema}`}
                  className={`rounded-xl border px-2.5 py-2 cursor-grab active:cursor-grabbing select-none ${
                    activo === t.id ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300' : completo ? 'border-slate-100 bg-slate-50 opacity-60' : 'border-slate-200 bg-white hover:border-brand-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{t.codigo}</span>
                    <span className={`text-[10px] font-bold ${completo ? 'text-emerald-700' : 'text-amber-700'}`}>{completo ? 'completo' : `${t.saldo} por ubicar`}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{t.sistema}</p>
                  {t.anchoPlanoMm != null && (
                    <p className="text-[10px] font-mono text-slate-400">
                      {formatoMm(t.anchoPlanoMm)} × {formatoMm(t.altoPlanoMm)} · {t.cantidadContratada} contratadas
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {tipoActivo && (
            <p className="text-[11px] text-brand-700">
              Elegido: <b className="font-mono">{tipoActivo.codigo}</b>. Usa <b>+ 1</b> en un departamento para agregarla.
            </p>
          )}
        </aside>

        {/* Edificio */}
        <div className="space-y-4 min-w-0">
          {vacia ? (
            <div className="p-10 text-center rounded-2xl bg-white border border-dashed border-slate-300 text-slate-500 text-xs space-y-3" data-testid="estructura-vacia">
              <Building2 className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">Aún no hay torres, pisos ni departamentos.</p>
              <p className="max-w-md mx-auto">Crea la estructura de una vez (por ejemplo 2 torres de 12 pisos con 6 departamentos) y luego ve ubicando las ventanas.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" leftIcon={<Building2 className="w-3.5 h-3.5" />} onClick={() => setModal({ tipo: 'armar' })}>
                  Armar el edificio
                </Button>
                <Button variant="outline" size="sm" onClick={() => setModal({ tipo: 'pisos', torre: '', sugerido: 1 })}>
                  Agregar pisos (obra sin torres)
                </Button>
              </div>
            </div>
          ) : (
            data.torres.map((torre) => {
              const ultimo = torre.pisos.length ? Math.max(...torre.pisos.map((p) => p.piso)) : 0;
              return (
                <section key={torre.nombre} className="rounded-2xl bg-white border border-slate-200 shadow-sm" data-testid={`torre-${torre.nombre || 'sin'}`}>
                  <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-black text-slate-900">{textoTorre(torre.nombre)}</h3>
                      <span className="text-[11px] text-slate-500">
                        {torre.pisos.length} piso(s) · {contarVentanas(torre)} ventana(s)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <button type="button" onClick={() => setModal({ tipo: 'pisos', torre: torre.nombre, sugerido: ultimo + 1 })} className="px-2 py-1 rounded-lg text-brand-700 hover:bg-brand-50 cursor-pointer">
                        + Pisos
                      </button>
                      <button type="button" onClick={() => setModal({ tipo: 'deptos', torre: torre.nombre })} className="px-2 py-1 rounded-lg text-brand-700 hover:bg-brand-50 cursor-pointer">
                        + Deptos en todos los pisos
                      </button>
                      <button type="button" onClick={() => setModal({ tipo: 'renombrar', torre: torre.nombre })} className="p-1.5 text-slate-400 hover:text-brand-600 cursor-pointer" aria-label={`Cambiar nombre de ${textoTorre(torre.nombre)}`} title="Cambiar nombre">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmarEliminar(`¿Quitar ${textoTorre(torre.nombre).toLowerCase()} con todos sus pisos y departamentos?`, { torre: torre.nombre })}
                        className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        aria-label={`Quitar ${textoTorre(torre.nombre)}`}
                        title="Quitar la torre"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </header>

                  {torre.pisos.length === 0 ? (
                    <p className="px-4 py-5 text-xs text-slate-400">Esta torre aún no tiene pisos.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {[...torre.pisos].reverse().map((piso) => (
                        <div key={piso.piso} className="px-4 py-3 flex flex-col sm:flex-row gap-3" data-testid={`piso-${torre.nombre || 'sin'}-${piso.piso}`}>
                          <div className="sm:w-28 shrink-0">
                            <p className="text-sm font-black text-slate-800">Piso {piso.piso}</p>
                            <div className="flex flex-wrap gap-x-2 text-[11px]">
                              <button type="button" onClick={() => setModal({ tipo: 'deptos', torre: torre.nombre, piso: piso.piso })} className="text-brand-700 hover:underline cursor-pointer">
                                + depto
                              </button>
                              {piso.deptos.length > 0 && (
                                <button type="button" onClick={() => setModal({ tipo: 'copiar', torre, piso: piso.piso })} className="inline-flex items-center gap-0.5 text-brand-700 hover:underline cursor-pointer" title="Copiar este piso a otros">
                                  <Copy className="w-3 h-3" /> copiar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => confirmarEliminar(`¿Quitar el piso ${piso.piso} de la ${textoTorre(torre.nombre).toLowerCase()}?`, { torre: torre.nombre, piso: piso.piso })}
                                className="text-slate-400 hover:text-rose-600 cursor-pointer"
                                aria-label={`Quitar el piso ${piso.piso} (${textoTorre(torre.nombre)})`}
                              >
                                quitar
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 flex-1 min-w-0 content-start">
                            {piso.deptos.length === 0 && <p className="text-xs text-slate-400 py-2">Sin departamentos.</p>}
                            {piso.deptos.map((depto) => {
                              const lugar: Lugar = { torre: torre.nombre, piso: piso.piso, dpto: depto.dpto };
                              const clave = claveLugar(lugar);
                              return (
                                <div
                                  key={depto.dpto}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    setSobre(clave);
                                  }}
                                  onDragLeave={() => setSobre((s) => (s === clave ? null : s))}
                                  onDrop={(e) => soltarEnDepto(e, lugar)}
                                  data-testid={`depto-${torre.nombre || 'sin'}-${piso.piso}-${depto.dpto}`}
                                  className={`rounded-xl border p-2 min-w-0 ${sobre === clave ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-100' : 'border-slate-200 bg-slate-50/50'}`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1.5">
                                    <span className="text-xs font-black text-slate-800 font-mono">{numeroDepto(piso.piso, depto.dpto)}</span>
                                    <div className="flex items-center gap-0.5">
                                      {tipoActivo && (
                                        <button
                                          type="button"
                                          onClick={() => agregarUna(lugar, tipoActivo)}
                                          className="px-1.5 py-0.5 rounded-md bg-brand-600 text-white text-[10px] font-bold cursor-pointer hover:bg-brand-700"
                                          title={`Agregar una ${tipoActivo.codigo} a este departamento`}
                                        >
                                          + 1 {tipoActivo.codigo}
                                        </button>
                                      )}
                                      <button type="button" onClick={() => setModal({ tipo: 'asignar', lugar })} className="p-1 text-slate-400 hover:text-brand-600 cursor-pointer" aria-label={`Agregar ventanas al depto ${numeroDepto(piso.piso, depto.dpto)} (${textoTorre(torre.nombre)})`} title="Agregar ventanas…">
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => confirmarEliminar(`¿Quitar el departamento ${numeroDepto(piso.piso, depto.dpto)}?`, { torre: torre.nombre, piso: piso.piso, dpto: depto.dpto })}
                                        className="p-1 text-slate-300 hover:text-rose-600 cursor-pointer"
                                        aria-label={`Quitar el depto ${numeroDepto(piso.piso, depto.dpto)} (${textoTorre(torre.nombre)})`}
                                        title="Quitar el departamento"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {depto.ventanas.length === 0 && <span className="text-[11px] text-slate-400">arrastra ventanas aquí</span>}
                                    {depto.ventanas.map((v) => (
                                      <div
                                        key={v.id}
                                        draggable
                                        onDragStart={(e) => e.dataTransfer.setData('text/plain', `ventana:${v.id}`)}
                                        data-testid="ventana-chip"
                                        title={`${v.nomenclatura ?? ''} · ${v.sistema}${v.rectificada ? ` · fabricación ${formatoMm(v.anchoFabricacionMm)} × ${formatoMm(v.altoFabricacionMm)}` : ' · sin rectificar'}`}
                                        className={`group inline-flex items-center gap-1 rounded-lg border pl-1.5 pr-0.5 py-0.5 text-[11px] cursor-grab active:cursor-grabbing select-none ${
                                          v.rectificada ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'
                                        }`}
                                      >
                                        <button type="button" onClick={() => setModal({ tipo: 'ventana', unidad: v })} className="inline-flex items-baseline gap-1 cursor-pointer" aria-label={`Editar ${v.nomenclatura ?? v.codigo}`}>
                                          <b className="font-mono">{v.codigo}</b>
                                          {v.ubicacion && <span className="text-slate-500 max-w-[5.5rem] truncate">{v.ubicacion}</span>}
                                        </button>
                                        <button type="button" onClick={() => quitar.mutate(v.id)} className="p-0.5 text-slate-300 hover:text-rose-600 cursor-pointer" aria-label={`Sacar ${v.nomenclatura ?? v.codigo} del departamento`} title="Sacar del departamento">
                                          <X className="w-3 h-3" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
          <p className="text-[11px] text-slate-400">
            Verde = ventana ya rectificada (con rasgo medido). Toca una ventana para editar su ubicación, tipo y rasgo. Las áreas comunes no se ubican por departamento: están en la pestaña Ventanas.
          </p>
        </div>
      </div>

      {modal?.tipo === 'armar' && <ArmarEdificioModal {...base} />}
      {modal?.tipo === 'torre' && <TorreModal {...base} />}
      {modal?.tipo === 'renombrar' && <RenombrarTorreModal {...base} torre={modal.torre} />}
      {modal?.tipo === 'pisos' && <PisosModal {...base} torre={modal.torre} sugerido={modal.sugerido} />}
      {modal?.tipo === 'deptos' && <DeptosModal {...base} torre={modal.torre} piso={modal.piso} />}
      {modal?.tipo === 'copiar' && <CopiarPisoModal {...base} torre={modal.torre} piso={modal.piso} />}
      {modal?.tipo === 'asignar' && <AsignarModal {...base} {...modal.lugar} tipos={tipos} tipoInicial={activo ?? undefined} />}
      {modal?.tipo === 'ventana' && <UnidadModal proyectoId={proyectoId} cubicacion={cubicacion} tipos={tipos} unidad={modal.unidad} onClose={() => setModal(null)} />}
    </div>
  );
};

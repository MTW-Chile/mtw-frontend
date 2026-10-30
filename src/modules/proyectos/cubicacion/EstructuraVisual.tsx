import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Copy, Home, Layers, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { asignarVentanasCubicacion, eliminarLugarCubicacion, eliminarUbicacionCubicacion, getEstructuraCubicacion, getFabricacionesProyecto, moverVentanaCubicacion, quitarPosicionVentanaCubicacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ConfigCubicacion, NodoDeptoCubicacion, NodoTorreCubicacion, TipoCubicacion, UnidadCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { CrearFaseDesdeCubicacionModal } from './CrearFaseDesdeCubicacionModal';
import { ArmarCasaModal, AsignarModal, ArmarEdificioModal, CopiarCasaModal, CopiarPisoModal, DeptosModal, PisosModal, RecintosModal, RenombrarModal, RenombrarTorreModal, TorreModal, UbicacionesModal, UnidadEspecialModal } from './EstructuraModales';
import { UnidadModal } from './UnidadModal';
import { mensajeAsignacion } from './utils';
import { vocabulario, type Vocabulario } from './vocabulario';
import { useConfirmar } from '../../../components/ui/Confirmar';
import { IconButton } from '../../../components/ui/IconButton';
import { ActivadorEdicion } from '../../../components/ui/ActivadorEdicion';
import { Buscador } from '../../../components/ui/Buscador';
import { SelectCompacto } from '../../../components/ui/Campos';
import { nombreDocumento } from '../fabricacion/utils';

interface Props {
  proyectoId: string;
  cubicacion: ConfigCubicacion;
  tipos: TipoCubicacion[];
  // Para "Crear fase con esta selección" -- sin version activa (obra sin
  // presupuesto) esa accion no aplica, no deberia llegar a pasar hoy porque
  // el cubicador quedo exclusivo de obras cotizadas, pero se guarda igual.
  versionId?: string;
  /** Obra legacy: las ventanas vienen de los documentos de fabricación con su medida final; filtro por documento. */
  legacy?: boolean;
}

// Destino de asignar/mover una ventana: siempre una Unidad (depto o especial) ya existente en el arbol.
type Destino = { unidadId: string; torre: string; nombreUnidad: string; recintos?: string[]; ubicacion?: string };
// Objetivo de "quitar": una torre, un piso, o un depto/unidad especial puntual.
type Objetivo = { torreId: string; pisoId?: string; unidadId?: string };

type ModalAbierto =
  | { tipo: 'armar' }
  | { tipo: 'torre' }
  | { tipo: 'renombrar'; torreId: string; nombreActual: string }
  | { tipo: 'pisos'; torreId: string; nombreTorre: string; sugerido: number }
  | { tipo: 'deptos'; torreId: string; nombreTorre: string; pisoNumero?: number }
  | { tipo: 'recintos'; nombreTorre: string; pisoNumero: number }
  | { tipo: 'copiarCasa'; torre: NodoTorreCubicacion }
  | { tipo: 'especial'; torreId: string }
  | { tipo: 'copiar'; torre: NodoTorreCubicacion; pisoNumero: number }
  | { tipo: 'asignar'; destino: Destino }
  | { tipo: 'ubicaciones'; destino: Destino }
  | { tipo: 'renombrar-lugar'; que: 'unidad' | 'ubicacion'; id: string; nombreActual: string }
  | { tipo: 'ventana'; unidad: UnidadCubicacion }
  | { tipo: 'crearFase' };

const aviso = (e: unknown) => {
  const { mensaje, detalle } = extraerErrorParaToast(e);
  mostrarToast(mensaje, { detalle });
};

const contarVentanas = (t: NodoTorreCubicacion) =>
  t.pisos.reduce((s, p) => s + p.deptos.reduce((x, d) => x + d.ventanas.length, 0), 0) + t.especiales.reduce((s, u) => s + u.ventanas.length, 0);

// Una carpeta (depto o unidad especial): misma tarjeta para ambos.
const TarjetaUnidad: React.FC<{
  voc: Vocabulario;
  nodo: NodoDeptoCubicacion;
  torre: string;
  tipoActivo: TipoCubicacion | null;
  sobre: string | null;
  onSobre: (id: string | null) => void;
  // `ubicacion`: el recinto del departamento donde cayó o se agregó (undefined = el departamento entero).
  onDrop: (e: React.DragEvent, ubicacion?: string) => void;
  onAgregarUna: (ubicacion?: string) => void;
  onAbrirAsignar: (ubicacion?: string) => void;
  onNuevaUbicacion: () => void;
  onQuitarUbicacion: (recintoId: string) => void;
  onRenombrar: () => void;
  onRenombrarUbicacion: (recinto: { id: string; nombre: string }) => void;
  onQuitar: () => void;
  onEditarVentana: (v: UnidadCubicacion) => void;
  onQuitarVentana: (id: string) => void;
  legacy?: boolean;
}> = ({ voc, nodo, torre, tipoActivo, sobre, onSobre, onDrop, onAgregarUna, onAbrirAsignar, onNuevaUbicacion, onQuitarUbicacion, onRenombrar, onRenombrarUbicacion, onQuitar, onEditarVentana, onQuitarVentana, legacy }) => {
  // Un departamento puede tener ubicaciones (recintos); una casa no: ahí el recinto es la unidad misma.
  const conUbicaciones = voc.modo === 'EDIFICIO' && nodo.recintos.length > 0;
  const nombresRecintos = new Set(nodo.recintos.map((r) => r.nombre.toLowerCase()));
  const chip = (v: UnidadCubicacion, mostrarUbicacion: boolean) => (
    <div
      key={v.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', `ventana:${v.id}`)}
      data-testid="ventana-chip"
      title={
        legacy
          ? `${v.nomenclatura ?? ''} · ${v.sistema} · ${formatoMm(v.anchoFabricacionMm ?? v.anchoPlanoMm)} × ${formatoMm(v.altoFabricacionMm ?? v.altoPlanoMm)}${v.documento ? ` · ${v.documento.nombre}` : ''}`
          : `${v.nomenclatura ?? ''} · ${v.sistema}${v.rectificada ? ` · fabricación ${formatoMm(v.anchoFabricacionMm)} × ${formatoMm(v.altoFabricacionMm)}` : ' · sin rectificar'}`
      }
      className={`group inline-flex items-center gap-1 rounded-lg border pl-1.5 pr-0.5 py-0.5 text-[11px] cursor-grab active:cursor-grabbing select-none ${
        !legacy && v.rectificada ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      <ActivadorEdicion onClick={() => onEditarVentana(v)} etiqueta={`Editar ${v.nomenclatura ?? v.codigo}`} className="items-baseline!">
        <b className="font-mono">{v.nomenclatura ?? v.codigo}</b>
        {mostrarUbicacion && v.ubicacion && <span className="text-slate-500 max-w-[5.5rem] truncate ml-1">{v.ubicacion}</span>}
      </ActivadorEdicion>
      <IconButton icono={X} etiqueta={`Sacar ${v.nomenclatura ?? v.codigo}`} tono="peligro" onClick={() => onQuitarVentana(v.id)} />
    </div>
  );
  // Una zona donde se pueden soltar ventanas y tipos: el departamento entero o uno de sus recintos.
  const zona = (clave: string, titulo: string | null, ventanas: UnidadCubicacion[], ubicacion: string | undefined, quitar?: () => void, renombrar?: () => void) => (
    <div
      key={clave}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSobre(clave);
      }}
      onDragLeave={() => onSobre(null)}
      onDrop={(e) => {
        e.stopPropagation();
        onDrop(e, ubicacion);
      }}
      data-testid={`ubicacion-${nodo.nombre}-${titulo ?? 'sin'}`}
      className={`rounded-lg border border-dashed p-1.5 min-w-0 ${sobre === clave ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-white/60'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{titulo ?? 'Sin ubicación'}</span>
        <div className="flex items-center gap-0.5">
          {tipoActivo && titulo !== null && (
            <Button size="sm" onClick={() => onAgregarUna(ubicacion)} title={`Agregar una ${tipoActivo.codigo} en ${titulo}`}>+ 1 {tipoActivo.codigo}</Button>
          )}
          {titulo !== null && <IconButton icono={Plus} etiqueta={`Agregar ventanas a ${titulo} (${nodo.nombre})`} tono="marca" onClick={() => onAbrirAsignar(ubicacion)} />}
          {renombrar && <IconButton icono={Pencil} etiqueta={`Cambiar nombre de la ubicación ${titulo} de ${nodo.nombre}`} tono="marca" onClick={renombrar} />}
          {quitar && <IconButton icono={X} etiqueta={`Quitar la ubicación ${titulo} de ${nodo.nombre}`} tono="peligro" onClick={quitar} />}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {ventanas.length === 0 && <span className="text-[11px] text-slate-400">arrastra ventanas aquí</span>}
        {ventanas.map((v) => chip(v, false))}
      </div>
    </div>
  );
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onSobre(nodo.id);
      }}
      onDragLeave={() => onSobre(null)}
      onDrop={(e) => onDrop(e)}
      data-testid={`depto-${torre || 'sin'}-${nodo.nombre}`}
      className={`rounded-xl border p-2 min-w-0 ${sobre === nodo.id ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-100' : 'border-slate-200 bg-slate-50/50'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className={`text-xs font-black text-slate-800 ${voc.modo === 'CASA' ? '' : 'font-mono'}`}>{nodo.nombre}</span>
        <div className="flex items-center gap-0.5">
          {tipoActivo && !conUbicaciones && (
            <Button size="sm" onClick={() => onAgregarUna()} title={`Agregar una ${tipoActivo.codigo} a este ${voc.unidad}`}>+ 1 {tipoActivo.codigo}</Button>
          )}
          {!conUbicaciones && <IconButton icono={Plus} etiqueta={`Agregar ventanas a ${nodo.nombre} (${voc.textoTorre(torre)})`} tono="marca" onClick={() => onAbrirAsignar()} />}
          <IconButton icono={Pencil} etiqueta={`Cambiar nombre de ${nodo.nombre} (${voc.textoTorre(torre)})`} tono="marca" onClick={onRenombrar} />
          <IconButton icono={X} etiqueta={`Quitar ${nodo.nombre} (${voc.textoTorre(torre)})`} tono="peligro" onClick={onQuitar} />
        </div>
      </div>
      {conUbicaciones ? (
        <div className="space-y-1.5">
          {nodo.recintos.map((r) => zona(`${nodo.id}:${r.id}`, r.nombre, nodo.ventanas.filter((v) => (v.ubicacion ?? '').toLowerCase() === r.nombre.toLowerCase()), r.nombre, () => onQuitarUbicacion(r.id), () => onRenombrarUbicacion(r)))}
          {(() => {
            const otras = nodo.ventanas.filter((v) => !v.ubicacion || !nombresRecintos.has(v.ubicacion.toLowerCase()));
            return otras.length > 0 ? zona(`${nodo.id}:sin`, null, otras, undefined) : null;
          })()}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {nodo.ventanas.length === 0 && <span className="text-[11px] text-slate-400">arrastra ventanas aquí</span>}
          {nodo.ventanas.map((v) => chip(v, voc.modo === 'EDIFICIO'))}
        </div>
      )}
      {voc.modo === 'EDIFICIO' && (
        <Button variant="link" size="sm" onClick={onNuevaUbicacion} title="Dividir el departamento en ubicaciones (DORM 1, ESTAR…)">
          + ubicación
        </Button>
      )}
    </div>
  );
};

// Cubicador visual: se arma el edificio (torres -> pisos -> departamentos) y se le van asignando las ventanas
// del presupuesto. Escribe las mismas unidades que la planilla Excel (torre, piso, depto, ubicacion), asi que
// la planilla, la lista de ventanas y el informe para HETMO salen identicos.
export const EstructuraVisual: React.FC<Props> = ({ proyectoId, cubicacion, tipos, versionId, legacy }) => {
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalAbierto | null>(null);
  const [activo, setActivo] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  // Legacy: filtro por documento de fabricación ('' = todos). Los documentos traen el nombre nuevo (y el de HETMO como referencia).
  const [documentoId, setDocumentoId] = useState('');
  const documentos = useQuery({ queryKey: ['fabricaciones', proyectoId], queryFn: () => getFabricacionesProyecto(proyectoId), enabled: !!legacy });
  const voc = vocabulario(cubicacion.modo);
  // Casa cuando se cubica por casa; edificio si no.
  const IconoEstructura = voc.modo === 'CASA' ? Home : Building2;

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
    mutationFn: ({ destino, tipo, exceder }: { destino: Destino; tipo: TipoCubicacion; exceder: boolean }) =>
      asignarVentanasCubicacion(proyectoId, { unidadId: destino.unidadId, tipoId: tipo.id, cantidad: 1, ubicacion: destino.ubicacion ?? null, excederContratadas: exceder }),
    onSuccess: (r, v) => {
      if (r.faltan > 0) mostrarToast(mensajeAsignacion(r, v.tipo.codigo), { tipo: 'info' });
      refrescar();
    },
    onError: aviso,
  });
  // Arrastrar una ventana a otro lugar (o a otra ubicación del mismo departamento).
  const mover = useMutation({
    mutationFn: ({ id, destino }: { id: string; destino: Destino }) =>
      moverVentanaCubicacion(proyectoId, { ventanaId: id, unidadId: destino.unidadId, ...(destino.ubicacion !== undefined ? { ubicacion: destino.ubicacion } : {}) }),
    onSuccess: refrescar,
    onError: aviso,
  });
  const quitarUbicacion = useMutation({
    mutationFn: (recintoId: string) => eliminarUbicacionCubicacion(proyectoId, recintoId),
    onSuccess: (r) => {
      if (r.ventanasSinUbicacion > 0) mostrarToast(`${r.ventanasSinUbicacion} ventana(s) quedaron sin ubicación (siguen en el departamento).`, { tipo: 'info' });
      refrescar();
    },
    onError: aviso,
  });
  const quitar = useMutation({ mutationFn: (id: string) => quitarPosicionVentanaCubicacion(id), onSuccess: refrescar, onError: aviso });
  const eliminar = useMutation({
    mutationFn: (p: Objetivo) => eliminarLugarCubicacion(proyectoId, p),
    onSuccess: (r) => {
      if (r.ventanasSinPosicion > 0) mostrarToast(`${r.ventanasSinPosicion} ventana(s) volvieron a "por ubicar".`, { tipo: 'info' });
      refrescar();
    },
    onError: aviso,
  });

  const agregarUna = async (destino: Destino, tipo: TipoCubicacion) => {
    const exceder = tipo.saldo <= 0;
    if (exceder && !(await confirmar({ titulo: `¿Agregar una ${tipo.codigo} de más?`, mensaje: `Ya están ubicadas todas las contratadas (${tipo.cantidadContratada}).`, confirmar: 'Agregar' }))) return;
    asignarUna.mutate({ destino, tipo, exceder });
  };

  const soltarEnDepto = (e: React.DragEvent, destino: Destino, ubicacion?: string) => {
    destino = ubicacion === undefined ? destino : { ...destino, ubicacion };
    e.preventDefault();
    setSobre(null);
    const dato = e.dataTransfer.getData('text/plain');
    if (dato.startsWith('tipo:')) {
      const tipo = ventanasTipos.find((t) => t.id === dato.slice(5));
      if (tipo) agregarUna(destino, tipo);
    } else if (dato.startsWith('ventana:')) {
      mover.mutate({ id: dato.slice(8), destino });
    }
  };
  const soltarEnPool = (e: React.DragEvent) => {
    e.preventDefault();
    setSobre(null);
    const dato = e.dataTransfer.getData('text/plain');
    if (dato.startsWith('ventana:')) quitar.mutate(dato.slice(8));
  };

  const confirmarEliminar = async (texto: string, p: Objetivo) => {
    if (await confirmar({ titulo: texto, mensaje: 'Sus ventanas no se borran: vuelven a "por ubicar".', confirmar: 'Eliminar', peligro: true })) eliminar.mutate(p);
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
  const base = { proyectoId, voc, onClose: () => setModal(null), onHecho: refrescar };
  // Con un documento elegido solo se muestran sus ventanas (los departamentos quedan igual).
  const deDocumento = (vs: UnidadCubicacion[]) => (documentoId ? vs.filter((v) => v.documento?.id === documentoId) : vs);
  const torres = documentoId
    ? data.torres.map((t) => ({
        ...t,
        pisos: t.pisos.map((p) => ({ ...p, deptos: p.deptos.map((d) => ({ ...d, ventanas: deDocumento(d.ventanas) })) })),
        especiales: t.especiales.map((d) => ({ ...d, ventanas: deDocumento(d.ventanas) })),
      }))
    : data.torres;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 max-w-3xl">
          {voc.ayuda}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" leftIcon={<IconoEstructura className="w-3.5 h-3.5" />} onClick={() => setModal({ tipo: 'armar' })}>
            {vacia ? voc.armar : voc.ampliar}
          </Button>
          <Button variant="outline" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setModal({ tipo: 'torre' })}>
            {voc.agregarContenedor}
          </Button>
          {legacy && (
            <SelectCompacto value={documentoId} onChange={(e) => setDocumentoId(e.target.value)} aria-label="Filtrar por documento de fabricación" className="max-w-[16rem]">
              <option value="">Todos los documentos</option>
              {(documentos.data ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {nombreDocumento(f)}
                </option>
              ))}
            </SelectCompacto>
          )}
          {versionId && !legacy && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Layers className="w-3.5 h-3.5" />}
              onClick={() => setModal({ tipo: 'crearFase' })}
              title={`Selecciona ${voc.contenedor}s, pisos, ${voc.unidades} o ventanas ya cubicadas para crear una fase de fabricación`}
            >
              Crear fase con selección
            </Button>
          )}
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
          <Buscador compacto valor={buscar} onChange={setBuscar} placeholder="Buscar V01, corredera…" etiqueta="Buscar tipo de ventana" />
          <div className="max-h-[60dvh] overflow-y-auto space-y-1.5 pr-0.5">
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
              Elegido: <b className="font-mono">{tipoActivo.codigo}</b>. Usa <b>+ 1</b> en {voc.modo === 'CASA' ? 'un recinto' : 'un departamento'} para agregarla.
            </p>
          )}
        </aside>

        {/* Edificio */}
        <div className="space-y-4 min-w-0">
          {vacia ? (
            <div className="p-10 text-center rounded-2xl bg-white border border-dashed border-slate-300 text-slate-500 text-xs space-y-3" data-testid="estructura-vacia">
              <IconoEstructura className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">{voc.tituloVacio}</p>
              <p className="max-w-md mx-auto">{voc.textoVacio}</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" leftIcon={<IconoEstructura className="w-3.5 h-3.5" />} onClick={() => setModal({ tipo: 'armar' })}>
                  {voc.armar}
                </Button>
              </div>
            </div>
          ) : (
            torres.map((torre) => {
              const ultimo = torre.pisos.length ? Math.max(...torre.pisos.map((p) => p.numero)) : 0;
              return (
                <section key={torre.id} className="rounded-2xl bg-white border border-slate-200 shadow-sm" data-testid={`torre-${torre.nombre || 'sin'}`}>
                  <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                      <IconoEstructura className="w-4 h-4 text-slate-400" />
                      <h3 className="text-sm font-black text-slate-900">{voc.textoTorre(torre.nombre)}</h3>
                      <span className="text-[11px] text-slate-500">
                        {torre.pisos.length} piso(s) · {contarVentanas(torre)} ventana(s)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      <Button variant="ghost" size="sm" onClick={() => setModal({ tipo: 'pisos', torreId: torre.id, nombreTorre: torre.nombre, sugerido: ultimo + 1 })}>+ Pisos</Button>
                      {voc.modo === 'EDIFICIO' && (
                        <Button variant="ghost" size="sm" onClick={() => setModal({ tipo: 'deptos', torreId: torre.id, nombreTorre: torre.nombre })}>+ Deptos en todos los pisos</Button>
                      )}
                      {voc.modo === 'CASA' && torre.pisos.length > 0 && (
                        <Button variant="ghost" size="sm" leftIcon={<Copy className="w-3.5 h-3.5" />} onClick={() => setModal({ tipo: 'copiarCasa', torre })} title="Crear casas nuevas iguales a esta">Copiar casa</Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setModal({ tipo: 'especial', torreId: torre.id })}>{voc.modo === 'CASA' ? '+ Exterior' : '+ Unidad especial'}</Button>
                      <IconButton icono={Pencil} etiqueta={`Cambiar nombre de ${voc.textoTorre(torre.nombre)}`} tono="marca" onClick={() => setModal({ tipo: 'renombrar', torreId: torre.id, nombreActual: torre.nombre })} />
                      <IconButton icono={Trash2} etiqueta={`Quitar ${voc.textoTorre(torre.nombre)}`} tono="peligro" onClick={() => confirmarEliminar(`¿Quitar ${voc.textoTorre(torre.nombre).toLowerCase()} con todos sus pisos y ${voc.unidades}?`, { torreId: torre.id })} />
                    </div>
                  </header>

                  {torre.especiales.length > 0 && (
                    <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap gap-2">
                      {torre.especiales.map((u) => (
                        <TarjetaUnidad
                          key={u.id}
                          nodo={u}
                          voc={voc}
                          torre={torre.nombre}
                          tipoActivo={tipoActivo}
                          sobre={sobre}
                          onSobre={setSobre}
                          onDrop={(e, ubicacion) => soltarEnDepto(e, { unidadId: u.id, torre: torre.nombre, nombreUnidad: u.nombre }, ubicacion)}
                          onAgregarUna={(ubicacion) => tipoActivo && agregarUna({ unidadId: u.id, torre: torre.nombre, nombreUnidad: u.nombre, ubicacion }, tipoActivo)}
                          onAbrirAsignar={(ubicacion) => setModal({ tipo: 'asignar', destino: { unidadId: u.id, torre: torre.nombre, nombreUnidad: u.nombre, recintos: u.recintos.map((r) => r.nombre), ubicacion } })}
                          onNuevaUbicacion={() => setModal({ tipo: 'ubicaciones', destino: { unidadId: u.id, torre: torre.nombre, nombreUnidad: u.nombre } })}
                          onQuitarUbicacion={(id) => quitarUbicacion.mutate(id)}
                          onRenombrar={() => setModal({ tipo: 'renombrar-lugar', que: 'unidad', id: u.id, nombreActual: u.nombre })}
                          onRenombrarUbicacion={(r) => setModal({ tipo: 'renombrar-lugar', que: 'ubicacion', id: r.id, nombreActual: r.nombre })}
                          onQuitar={() => confirmarEliminar(`¿Quitar la unidad "${u.nombre}"?`, { torreId: torre.id, unidadId: u.id })}
                          onEditarVentana={(v) => setModal({ tipo: 'ventana', unidad: v })}
                          onQuitarVentana={(id) => quitar.mutate(id)}
                          legacy={legacy}
                        />
                      ))}
                    </div>
                  )}

                  {torre.pisos.length === 0 ? (
                    <p className="px-4 py-5 text-xs text-slate-400">Esta {voc.contenedor} aún no tiene pisos.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {[...torre.pisos].reverse().map((piso) => (
                        <div key={piso.id} className="px-4 py-3 flex flex-col sm:flex-row gap-3" data-testid={`piso-${torre.nombre || 'sin'}-${piso.numero}`}>
                          <div className="sm:w-28 shrink-0">
                            <p className="text-sm font-black text-slate-800">Piso {piso.numero}</p>
                            <div className="flex flex-wrap gap-x-2 text-[11px]">
                              <Button
                                variant="link"
                                size="sm"
                                onClick={() => setModal(voc.modo === 'CASA' ? { tipo: 'recintos', nombreTorre: torre.nombre, pisoNumero: piso.numero } : { tipo: 'deptos', torreId: torre.id, nombreTorre: torre.nombre, pisoNumero: piso.numero })}
                              >
                                + {voc.unidadCorta}
                              </Button>
                              {piso.deptos.length > 0 && (
                                <Button variant="link" size="sm" leftIcon={<Copy className="w-3.5 h-3.5" />} onClick={() => setModal({ tipo: 'copiar', torre, pisoNumero: piso.numero })} title="Copiar este piso a otros">copiar</Button>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => confirmarEliminar(`¿Quitar el piso ${piso.numero} de ${voc.elContenedor}?`, { torreId: torre.id, pisoId: piso.id })} aria-label={`Quitar el piso ${piso.numero} (${voc.textoTorre(torre.nombre)})`} className="text-rose-600! hover:bg-rose-50!">quitar</Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 flex-1 min-w-0 content-start">
                            {piso.deptos.length === 0 && <p className="text-xs text-slate-400 py-2">Sin {voc.unidades}.</p>}
                            {piso.deptos.map((depto) => (
                              <TarjetaUnidad
                                key={depto.id}
                                nodo={depto}
                                voc={voc}
                                torre={torre.nombre}
                                tipoActivo={tipoActivo}
                                sobre={sobre}
                                onSobre={setSobre}
                                onDrop={(e, ubicacion) => soltarEnDepto(e, { unidadId: depto.id, torre: torre.nombre, nombreUnidad: depto.nombre }, ubicacion)}
                                onAgregarUna={(ubicacion) => tipoActivo && agregarUna({ unidadId: depto.id, torre: torre.nombre, nombreUnidad: depto.nombre, ubicacion }, tipoActivo)}
                                onAbrirAsignar={(ubicacion) => setModal({ tipo: 'asignar', destino: { unidadId: depto.id, torre: torre.nombre, nombreUnidad: depto.nombre, recintos: depto.recintos.map((r) => r.nombre), ubicacion } })}
                                onNuevaUbicacion={() => setModal({ tipo: 'ubicaciones', destino: { unidadId: depto.id, torre: torre.nombre, nombreUnidad: depto.nombre } })}
                                onQuitarUbicacion={(id) => quitarUbicacion.mutate(id)}
                                onRenombrar={() => setModal({ tipo: 'renombrar-lugar', que: 'unidad', id: depto.id, nombreActual: depto.nombre })}
                                onRenombrarUbicacion={(r) => setModal({ tipo: 'renombrar-lugar', que: 'ubicacion', id: r.id, nombreActual: r.nombre })}
                                onQuitar={() => confirmarEliminar(`¿Quitar el ${voc.unidad} ${depto.nombre}?`, { torreId: torre.id, pisoId: piso.id, unidadId: depto.id })}
                                onEditarVentana={(v) => setModal({ tipo: 'ventana', unidad: v })}
                                onQuitarVentana={(id) => quitar.mutate(id)}
                                legacy={legacy}
                              />
                            ))}
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
            {legacy ? 'Toca una ventana para editar su ubicación y tipo; su medida es la del documento de fabricación.' : 'Verde = ventana ya rectificada (con rasgo medido). Toca una ventana para editar su ubicación, tipo y rasgo.'}
          </p>
        </div>
      </div>

      {modal?.tipo === 'armar' && (voc.modo === 'CASA' ? <ArmarCasaModal {...base} casas={data.torres.map((t) => t.nombre)} /> : <ArmarEdificioModal {...base} />)}
      {modal?.tipo === 'torre' && <TorreModal {...base} />}
      {modal?.tipo === 'renombrar' && <RenombrarTorreModal {...base} torreId={modal.torreId} nombreActual={modal.nombreActual} />}
      {modal?.tipo === 'pisos' && <PisosModal {...base} torre={modal.nombreTorre} sugerido={modal.sugerido} />}
      {modal?.tipo === 'deptos' && <DeptosModal {...base} torre={modal.nombreTorre} piso={modal.pisoNumero} />}
      {modal?.tipo === 'recintos' && <RecintosModal {...base} torre={modal.nombreTorre} piso={modal.pisoNumero} />}
      {modal?.tipo === 'copiarCasa' && <CopiarCasaModal {...base} torre={modal.torre} />}
      {modal?.tipo === 'especial' && <UnidadEspecialModal {...base} torreId={modal.torreId} />}
      {modal?.tipo === 'copiar' && <CopiarPisoModal {...base} torre={modal.torre} piso={modal.pisoNumero} />}
      {modal?.tipo === 'asignar' && <AsignarModal {...base} unidadId={modal.destino.unidadId} torre={modal.destino.torre} nombreUnidad={modal.destino.nombreUnidad} recintos={modal.destino.recintos} ubicacionInicial={modal.destino.ubicacion} tipos={tipos} tipoInicial={activo ?? undefined} />}
      {modal?.tipo === 'renombrar-lugar' && (
        <RenombrarModal {...base} que={modal.que} id={modal.id} nombreActual={modal.nombreActual} etiquetaTexto={modal.que === 'ubicacion' ? 'Nombre de la ubicación' : `Nombre del ${voc.unidad}`} />
      )}
      {modal?.tipo === 'ubicaciones' && <UbicacionesModal {...base} unidadId={modal.destino.unidadId} torre={modal.destino.torre} nombreUnidad={modal.destino.nombreUnidad} />}
      {modal?.tipo === 'ventana' && <UnidadModal proyectoId={proyectoId} cubicacion={cubicacion} tipos={tipos} unidad={modal.unidad} legacy={legacy} onClose={() => setModal(null)} />}
      {modal?.tipo === 'crearFase' && versionId && <CrearFaseDesdeCubicacionModal proyectoId={proyectoId} versionId={versionId} onClose={() => setModal(null)} />}
    </div>
  );
};

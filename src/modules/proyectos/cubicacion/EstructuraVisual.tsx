import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronsDownUp, ChevronsUpDown, Copy, Home, Layers, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { asignarVentanasCubicacion, eliminarLugarCubicacion, eliminarUbicacionCubicacion, getEstructuraCubicacion, getFabricacionesProyecto, moverVentanaCubicacion, quitarPosicionVentanaCubicacion } from '../../../api/client';
import { Badge } from '../../../components/ui/Badge';
import { BotonColapsar } from '../../../components/ui/BotonColapsar';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { ConfigCubicacion, NodoDeptoCubicacion, NodoTorreCubicacion, TipoCubicacion, UnidadCubicacion, Proyecto } from '../../../types';
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
  /** Legacy: ventana elegida en el panel (se ubica con el botón del departamento, sin arrastrar). */
  seleccion?: Set<string>;
  onAlternarSeleccion?: (id: string) => void;
  /** Ids que se arrastran juntos si `id` está marcada; si no, solo `id`. */
  datosArrastre?: (id: string) => string;
  onUbicarActiva?: (ubicacion?: string) => void;
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
}> = ({ voc, nodo, torre, tipoActivo, seleccion, onAlternarSeleccion, datosArrastre, onUbicarActiva, onDrop, onAgregarUna, onAbrirAsignar, onNuevaUbicacion, onQuitarUbicacion, onRenombrar, onRenombrarUbicacion, onQuitar, onEditarVentana, onQuitarVentana, legacy }) => {
  // Resaltado del destino al arrastrar: estado de ESTA tarjeta. Si viviera en el padre, cada vez que el cursor
  // cambia de departamento se re-dibujaría todo el edificio (cientos de tarjetas y ventanas) y el navegador, al
  // no recibir respuesta a tiempo, deja de aceptar el soltar: con edificios altos «no pasaba nada».
  const [sobre, onSobre] = useState<string | null>(null);
  // Un departamento puede tener ubicaciones (recintos); una casa no: ahí el recinto es la unidad misma.
  const conUbicaciones = voc.modo === 'EDIFICIO' && nodo.recintos.length > 0;
  const nombresRecintos = new Set(nodo.recintos.map((r) => r.nombre.toLowerCase()));
  const chip = (v: UnidadCubicacion, mostrarUbicacion: boolean) => (
    <div
      key={v.id}
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', datosArrastre ? datosArrastre(v.id) : `ventana:${v.id}`)}
      // Ctrl, Cmd o Shift + clic marca la ventana para arrastrar varias juntas (sin abrir su edición).
      onClickCapture={(e) => {
        if (onAlternarSeleccion && (e.ctrlKey || e.metaKey || e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          onAlternarSeleccion(v.id);
        }
      }}
      aria-selected={seleccion?.has(v.id) ?? false}
      data-testid="ventana-chip"
      title={
        legacy
          ? `${v.nomenclatura ?? ''} · ${v.sistema} · ${formatoMm(v.anchoFabricacionMm ?? v.anchoPlanoMm)} × ${formatoMm(v.altoFabricacionMm ?? v.altoPlanoMm)}${v.documento ? ` · ${v.documento.nombre}` : ''}`
          : `${v.nomenclatura ?? ''} · ${v.sistema}${v.rectificada ? ` · fabricación ${formatoMm(v.anchoFabricacionMm)} × ${formatoMm(v.altoFabricacionMm)}` : ' · sin rectificar'}`
      }
      className={`group inline-flex items-center gap-1 rounded-lg border pl-1.5 pr-0.5 py-0.5 text-[11px] cursor-grab active:cursor-grabbing select-none ${
        seleccion?.has(v.id) ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-300 text-brand-900' : !legacy && v.rectificada ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'
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
        onSobre(null);
        onDrop(e, ubicacion);
      }}
      data-testid={`ubicacion-${nodo.nombre}-${titulo ?? 'sin'}`}
      className={`rounded-lg border border-dashed p-1.5 min-w-0 ${sobre === clave ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200 bg-white/60'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo ?? 'Sin ubicación'}</span>
        <div className="flex items-center gap-0.5">
          {tipoActivo && titulo !== null && (
            <Button size="sm" onClick={() => onAgregarUna(ubicacion)} title={`Agregar una ${tipoActivo.codigo} en ${titulo}`}>+ 1 {tipoActivo.codigo}</Button>
          )}
          {!!seleccion?.size && titulo !== null && onUbicarActiva && (
            <Button size="sm" onClick={() => onUbicarActiva(ubicacion)} title={`Ubicar ${seleccion.size} ventana(s) en ${titulo}`}>Ubicar aquí{seleccion.size > 1 ? ` (${seleccion.size})` : ''}</Button>
          )}
          {titulo !== null && <IconButton icono={Plus} etiqueta={`Agregar ventanas a ${titulo} (${nodo.nombre})`} tono="marca" onClick={() => onAbrirAsignar(ubicacion)} />}
          {renombrar && <IconButton icono={Pencil} etiqueta={`Cambiar nombre de la ubicación ${titulo} de ${nodo.nombre}`} tono="marca" onClick={renombrar} />}
          {quitar && <IconButton icono={X} etiqueta={`Quitar la ubicación ${titulo} de ${nodo.nombre}`} tono="peligro" onClick={quitar} />}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {ventanas.length === 0 && <span className="text-[11px] text-slate-500">arrastra ventanas aquí</span>}
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
      onDrop={(e) => {
        onSobre(null);
        onDrop(e);
      }}
      data-testid={`depto-${torre || 'sin'}-${nodo.nombre}`}
      className={`rounded-xl border p-2 min-w-0 ${sobre === nodo.id ? 'border-brand-400 bg-brand-50/50 ring-2 ring-brand-100' : 'border-slate-200 bg-slate-50/50'}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <span className={`text-xs font-black text-slate-800 ${voc.modo === 'CASA' ? '' : 'font-mono'}`}>{nodo.nombre}</span>
        <div className="flex items-center gap-0.5">
          {tipoActivo && !conUbicaciones && (
            <Button size="sm" onClick={() => onAgregarUna()} title={`Agregar una ${tipoActivo.codigo} a este ${voc.unidad}`}>+ 1 {tipoActivo.codigo}</Button>
          )}
          {!!seleccion?.size && !conUbicaciones && onUbicarActiva && (
            <Button size="sm" onClick={() => onUbicarActiva()} title={`Ubicar ${seleccion.size} ventana(s) en ${nodo.nombre}`}>Ubicar aquí{seleccion.size > 1 ? ` (${seleccion.size})` : ''}</Button>
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
          {nodo.ventanas.length === 0 && <span className="text-[11px] text-slate-500">arrastra ventanas aquí</span>}
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
// Contenedor con scroll más cercano (la página de la obra scrollea dentro de un contenedor, no en la ventana).
function contenedorConScroll(el: HTMLElement | null): HTMLElement | null {
  for (let n = el?.parentElement ?? null; n; n = n.parentElement) {
    const o = getComputedStyle(n).overflowY;
    if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

export const EstructuraVisual: React.FC<Props> = ({ proyectoId, cubicacion, tipos, versionId, legacy }) => {
  const { confirmar } = useConfirmar();
  const queryClient = useQueryClient();
  // Autoscroll al arrastrar: con muchos pisos el destino queda fuera de pantalla y el navegador casi no
  // desplaza la página mientras se arrastra. Cerca del borde superior o inferior se desplaza solo.
  const raiz = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const alArrastrar = (e: DragEvent) => {
      const caja = contenedorConScroll(raiz.current);
      const borde = 90;
      const arriba = caja ? Math.max(caja.getBoundingClientRect().top, 0) : 0;
      const abajo = caja ? Math.min(caja.getBoundingClientRect().bottom, window.innerHeight) : window.innerHeight;
      let paso = 0;
      if (e.clientY < arriba + borde) paso = -Math.ceil(((arriba + borde - e.clientY) / borde) * 28);
      else if (e.clientY > abajo - borde) paso = Math.ceil(((e.clientY - (abajo - borde)) / borde) * 28);
      if (paso !== 0) (caja ?? document.scrollingElement)?.scrollBy({ top: paso });
    };
    document.addEventListener('dragover', alArrastrar);
    return () => document.removeEventListener('dragover', alArrastrar);
  }, []);
  const [modal, setModal] = useState<ModalAbierto | null>(null);
  const [activo, setActivo] = useState<string | null>(null);
  // Legacy: la ventana elegida en el panel «Por ubicar» (cada una con su nombre de fabricación).
  // Ventanas marcadas (se arrastran o se ubican juntas): clic en el panel, o Ctrl/Cmd/Shift + clic sobre una ya ubicada.
  const [seleccionIds, setSeleccionIds] = useState<string[]>([]);
  const seleccion = new Set(seleccionIds);
  const alternarSeleccion = (id: string) => setSeleccionIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  // Lo que se lleva el arrastre: todas las marcadas si la arrastrada es una de ellas; si no, solo ella.
  const datosArrastre = (id: string) => (seleccion.has(id) && seleccionIds.length > 1 ? `ventanas:${seleccionIds.join(',')}` : `ventana:${id}`);
  const [sobre, setSobre] = useState<string | null>(null);
  const [buscar, setBuscar] = useState('');
  // Pisos replegados (id de piso): muestran solo el resumen del piso.
  const [pisosCerrados, setPisosCerrados] = useState<Set<string>>(new Set());
  // Unidades especiales: van al final de cada torre y se pueden replegar (id de torre).
  const [especialesCerradas, setEspecialesCerradas] = useState<Set<string>>(new Set());
  const alternarEspeciales = (id: string) =>
    setEspecialesCerradas((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const alternarPiso = (id: string) =>
    setPisosCerrados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  // Legacy: filtro por documento de fabricación ('' = todos). Los documentos traen el nombre nuevo (y el de HETMO como referencia).
  const [documentoId, setDocumentoId] = useState('');
  const documentos = useQuery({ queryKey: ['fabricaciones', proyectoId], queryFn: () => getFabricacionesProyecto(proyectoId), enabled: !!legacy });
  const voc = vocabulario(cubicacion.modo, queryClient.getQueryData<Proyecto>(['proyectoDetail', proyectoId])?.obra);
  // Casa cuando se cubica por casa; edificio si no.
  const IconoEstructura = voc.modo === 'CASA' ? Home : Building2;

  const { data, isLoading, isError } = useQuery({ queryKey: ['cubicacion', proyectoId, 'estructura'], queryFn: () => getEstructuraCubicacion(proyectoId) });
  // Al abrir la pantalla todos los pisos que ya existen parten recogidos; los que se creen después aparecen desplegados.
  const pisosIniciados = useRef(false);
  useEffect(() => {
    if (!data || pisosIniciados.current) return;
    pisosIniciados.current = true;
    setPisosCerrados(new Set(data.torres.flatMap((t) => t.pisos.map((p) => p.id))));
  }, [data]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['cubicacion', proyectoId] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUnidades', proyectoId] });
    queryClient.invalidateQueries({ queryKey: ['cubicacionUbicaciones', proyectoId] });
  };

  const ventanasTipos = tipos.filter((t) => !t.esAreaComun).sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }));
  const tipoActivo = ventanasTipos.find((t) => t.id === activo) ?? null;
  // Con un documento elegido, lo que falta por ubicar es lo de ESE documento (y se ubican ventanas de él).
  const porUbicarDe = (tipoId: string): number | null =>
    documentoId ? (data?.libres ?? []).filter((l) => l.tipoId === tipoId && l.fabricacionId === documentoId).reduce((s, l) => s + l.cantidad, 0) : null;
  const saldoDe = (t: TipoCubicacion) => porUbicarDe(t.id) ?? t.saldo;
  // Legacy: ventanas por ubicar, una a una, con su nombre de fabricación (filtradas por documento y búsqueda).
  const porUbicarLegacy = (data?.unica ?? []).filter((v) => !documentoId || v.documento?.id === documentoId).filter((v) => !buscar.trim() || `${v.nomenclatura ?? ''} ${v.codigo} ${v.sistema} ${v.documento?.nombre ?? ''}`.toLowerCase().includes(buscar.trim().toLowerCase()));
  // Con un documento elegido, el panel muestra solo los tipos que tienen ventanas de ese documento por ubicar.
  const visibles = ventanasTipos
    .filter((t) => !documentoId || (porUbicarDe(t.id) ?? 0) > 0)
    .filter((t) => !buscar.trim() || `${t.codigo} ${t.sistema}`.toLowerCase().includes(buscar.trim().toLowerCase()));


  const asignarUna = useMutation({
    mutationFn: ({ destino, tipo, exceder }: { destino: Destino; tipo: TipoCubicacion; exceder: boolean }) =>
      asignarVentanasCubicacion(proyectoId, { unidadId: destino.unidadId, tipoId: tipo.id, cantidad: 1, ubicacion: destino.ubicacion ?? null, excederContratadas: exceder, fabricacionId: documentoId || null }),
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
  // Varias ventanas a la vez, una tras otra (la nomenclatura de cada una se recalcula en orden).
  const moverVarias = useMutation({
    mutationFn: async ({ ids, destino }: { ids: string[]; destino: Destino }) => {
      for (const id of ids) await moverVentanaCubicacion(proyectoId, { ventanaId: id, unidadId: destino.unidadId, ...(destino.ubicacion !== undefined ? { ubicacion: destino.ubicacion } : {}) });
    },
    onSuccess: () => {
      setSeleccionIds([]);
      refrescar();
    },
    onError: (e) => {
      refrescar();
      aviso(e);
    },
  });
  const quitarVarias = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) await quitarPosicionVentanaCubicacion(id);
    },
    onSuccess: () => {
      setSeleccionIds([]);
      refrescar();
    },
    onError: (e) => {
      refrescar();
      aviso(e);
    },
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
    const exceder = saldoDe(tipo) <= 0;
    if (exceder && documentoId) {
      mostrarToast(`No quedan ${tipo.codigo} por ubicar en este documento.`, { tipo: 'info' });
      return;
    }
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
    } else if (dato.startsWith('ventanas:')) {
      moverVarias.mutate({ ids: dato.slice(9).split(','), destino });
    } else if (dato.startsWith('ventana:')) {
      mover.mutate({ id: dato.slice(8), destino });
    }
  };
  // Ubica en el departamento (o recinto) todas las ventanas marcadas.
  const ubicarActiva = (destino: Destino) => {
    if (seleccionIds.length === 0) return;
    if (seleccionIds.length === 1) {
      mover.mutate({ id: seleccionIds[0], destino });
      setSeleccionIds([]);
    } else moverVarias.mutate({ ids: seleccionIds, destino });
  };

  const soltarEnPool = (e: React.DragEvent) => {
    e.preventDefault();
    setSobre(null);
    const dato = e.dataTransfer.getData('text/plain');
    if (dato.startsWith('ventanas:')) quitarVarias.mutate(dato.slice(9).split(','));
    else if (dato.startsWith('ventana:')) quitar.mutate(dato.slice(8));
  };

  const confirmarEliminar = async (texto: string, p: Objetivo) => {
    if (await confirmar({ titulo: texto, mensaje: 'Sus ventanas no se borran: vuelven a "por ubicar".', confirmar: 'Eliminar', peligro: true })) eliminar.mutate(p);
  };

  if (isLoading) {
    return (
      <div className="p-10 flex items-center justify-center text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className="p-6 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">No se pudo cargar la estructura. Intenta de nuevo en unos minutos.</div>;
  }

  const vacia = data.torres.length === 0;
  const base = { proyectoId, voc, onClose: () => setModal(null), onHecho: refrescar };
  // El filtro por documento solo afecta a la lista «Por ubicar»: el edificio siempre se ve completo.
  const torres = data.torres;

  return (
    <div ref={raiz} className="space-y-3">
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
          onDragLeave={(e) => {
            // Solo al salir del panel (no al pasar entre sus ventanas): evita redibujar todo el edificio a cada paso.
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSobre(null);
          }}
          onDrop={soltarEnPool}
          data-testid="pool-ventanas"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Por ubicar</p>
            <Badge size="sm" variant={(legacy ? porUbicarLegacy.length : documentoId ? (data.libres ?? []).filter((l) => l.fabricacionId === documentoId).reduce((s, l) => s + l.cantidad, 0) : data.sinPosicion) > 0 ? 'warning' : 'success'}>
              {(() => {
                const n = legacy ? porUbicarLegacy.length : documentoId ? (data.libres ?? []).filter((l) => l.fabricacionId === documentoId).reduce((s, l) => s + l.cantidad, 0) : data.sinPosicion;
                return n > 0 ? `${n} ventanas` : 'todas ubicadas';
              })()}
            </Badge>
          </div>
          {legacy && (
            <SelectCompacto value={documentoId} onChange={(e) => setDocumentoId(e.target.value)} aria-label="Filtrar por documento de fabricación" className="w-full">
              <option value="">Todos los documentos</option>
              {(documentos.data ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {nombreDocumento(f)}
                </option>
              ))}
            </SelectCompacto>
          )}
          <Buscador compacto valor={buscar} onChange={setBuscar} placeholder={legacy ? 'Buscar 2115 V02, documento…' : 'Buscar V01, corredera…'} etiqueta={legacy ? 'Buscar ventana' : 'Buscar tipo de ventana'} />
          {legacy && porUbicarLegacy.length > 0 && (
            <div className="flex items-center justify-between text-[11px]">
              <Button variant="link" size="sm" onClick={() => setSeleccionIds(porUbicarLegacy.map((v) => v.id))}>Marcar las {porUbicarLegacy.length} visibles</Button>
              {seleccionIds.length > 0 && <Button variant="link" size="sm" onClick={() => setSeleccionIds([])}>Limpiar ({seleccionIds.length})</Button>}
            </div>
          )}
          <div className="max-h-[60dvh] overflow-y-auto space-y-1.5 pr-0.5">
            {legacy && porUbicarLegacy.length === 0 && <p className="text-xs text-slate-500 py-3 text-center">{documentoId ? 'No quedan ventanas por ubicar de este documento.' : 'Todas las ventanas tienen lugar.'}</p>}
            {legacy &&
              porUbicarLegacy.map((v) => (
                <div
                  key={v.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', datosArrastre(v.id))}
                  onClick={() => alternarSeleccion(v.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') alternarSeleccion(v.id);
                  }}
                  aria-pressed={seleccion.has(v.id)}
                  data-testid={`pool-ventana-${v.nomenclatura ?? v.codigo}`}
                  title={`${v.nomenclatura ?? v.codigo} · ${v.sistema}`}
                  className={`rounded-xl border px-2.5 py-1.5 cursor-grab active:cursor-grabbing select-none ${seleccion.has(v.id) ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-300' : 'border-slate-200 bg-white hover:border-brand-300'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 truncate">{v.nomenclatura ?? v.codigo}</span>
                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                      {formatoMm(v.anchoFabricacionMm ?? v.anchoPlanoMm)} × {formatoMm(v.altoFabricacionMm ?? v.altoPlanoMm)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {v.sistema}
                    {v.documento && !documentoId ? ` · ${v.documento.nombre}` : ''}
                  </p>
                </div>
              ))}
            {!legacy && visibles.length === 0 && <p className="text-xs text-slate-500 py-3 text-center">{documentoId ? 'No quedan ventanas por ubicar de este documento.' : 'No hay tipos.'}</p>}
            {!legacy && visibles.map((t) => {
              const saldo = saldoDe(t);
              const completo = saldo <= 0;
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
                    <span className={`text-[11px] font-bold ${completo ? 'text-emerald-700' : 'text-amber-700'}`}>{completo ? 'completo' : `${saldo} por ubicar`}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{t.sistema}</p>
                  {t.anchoPlanoMm != null && (
                    <p className="text-[11px] font-mono text-slate-500">
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
          {seleccionIds.length > 0 && (
            <p className="text-[11px] text-brand-700">
              {seleccionIds.length === 1 ? '1 ventana marcada' : `${seleccionIds.length} ventanas marcadas`}. Toca <b>Ubicar aquí</b> en {voc.modo === 'CASA' ? 'un recinto' : 'un departamento'}, o arrástralas juntas. Clic marca o desmarca; en el edificio, Ctrl/Cmd/Shift + clic.
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
                      <IconoEstructura className="w-4 h-4 text-slate-500" />
                      <h3 className="text-sm font-black text-slate-900">{voc.textoTorre(torre.nombre)}</h3>
                      <span className="text-[11px] text-slate-500">
                        {torre.pisos.length} piso(s) · {contarVentanas(torre)} ventana(s)
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-xs">
                      {torre.pisos.length > 1 && (
                        <IconButton
                          icono={torre.pisos.every((p) => pisosCerrados.has(p.id)) ? ChevronsUpDown : ChevronsDownUp}
                          etiqueta={torre.pisos.every((p) => pisosCerrados.has(p.id)) ? 'Desplegar todos los pisos' : 'Replegar todos los pisos'}
                          onClick={() =>
                            setPisosCerrados((prev) => {
                              const n = new Set(prev);
                              const todosCerrados = torre.pisos.every((p) => n.has(p.id));
                              torre.pisos.forEach((p) => (todosCerrados ? n.delete(p.id) : n.add(p.id)));
                              return n;
                            })
                          }
                        />
                      )}
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

                  {torre.pisos.length === 0 ? (
                    <p className="px-4 py-5 text-xs text-slate-500">Esta {voc.contenedor} aún no tiene pisos.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {[...torre.pisos].reverse().map((piso) => {
                        const cerrado = pisosCerrados.has(piso.id);
                        const nVentanas = piso.deptos.reduce((x, d) => x + d.ventanas.length, 0);
                        const vacios = piso.deptos.filter((d) => d.ventanas.length === 0).length;
                        return (
                        <div key={piso.id} className="px-4 py-3 space-y-2" data-testid={`piso-${torre.nombre || 'sin'}-${piso.numero}`}>
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <BotonColapsar abierto={!cerrado} onClick={() => alternarPiso(piso.id)} className="rounded-lg -ml-1 px-1 py-0.5 hover:bg-slate-50">
                              <span className="sr-only">{cerrado ? 'Desplegar' : 'Replegar'} el piso {piso.numero} ({voc.textoTorre(torre.nombre)})</span>
                              <span className="text-sm font-black text-slate-800">Piso {piso.numero}</span>
                              <span className="text-[11px] text-slate-500">
                                {piso.deptos.length} {voc.unidadCorta === 'depto' ? (piso.deptos.length === 1 ? 'depto' : 'deptos') : piso.deptos.length === 1 ? 'recinto' : 'recintos'} · {nVentanas} ventana(s)
                              </span>
                              {vacios > 0 && <Badge size="sm" variant="warning">{vacios} sin ventanas</Badge>}
                              {piso.deptos.length > 0 && vacios === 0 && <Badge size="sm" variant="success">completo</Badge>}
                            </BotonColapsar>
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

                          <div className={`grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2 min-w-0 content-start ${cerrado ? 'hidden' : ''}`}>
                            {piso.deptos.length === 0 && <p className="text-xs text-slate-500 py-2">Sin {voc.unidades}.</p>}
                            {piso.deptos.map((depto) => (
                              <TarjetaUnidad
                                key={depto.id}
                                nodo={depto}
                                voc={voc}
                                torre={torre.nombre}
                                tipoActivo={tipoActivo}
                                seleccion={seleccion}
                          onAlternarSeleccion={alternarSeleccion}
                          datosArrastre={datosArrastre}
                                onUbicarActiva={(ubicacion) => ubicarActiva({ unidadId: depto.id, torre: torre.nombre, nombreUnidad: depto.nombre, ubicacion })}
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
                        );
                      })}
                    </div>
                  )}
                  {torre.especiales.length > 0 && (
                    <div className="border-t border-slate-100 px-4 py-3 space-y-2" data-testid={`especiales-${torre.nombre || 'sin'}`}>
                      <BotonColapsar abierto={!especialesCerradas.has(torre.id)} onClick={() => alternarEspeciales(torre.id)}>
                        <span className="text-sm font-black text-slate-800">{voc.modo === 'CASA' ? 'Exteriores' : 'Unidades especiales'}</span>
                        <span className="text-[11px] text-slate-500">
                          {torre.especiales.length} · {torre.especiales.reduce((n, u) => n + u.ventanas.length, 0)} ventana(s)
                        </span>
                      </BotonColapsar>
                      <div className={`flex flex-wrap gap-2 ${especialesCerradas.has(torre.id) ? 'hidden' : ''}`}>
                      {torre.especiales.map((u) => (
                        <TarjetaUnidad
                          key={u.id}
                          nodo={u}
                          voc={voc}
                          torre={torre.nombre}
                          tipoActivo={tipoActivo}
                          seleccion={seleccion}
                          onAlternarSeleccion={alternarSeleccion}
                          datosArrastre={datosArrastre}
                          onUbicarActiva={(ubicacion) => ubicarActiva({ unidadId: u.id, torre: torre.nombre, nombreUnidad: u.nombre, ubicacion })}
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
                    </div>
                  )}
                </section>
              );
            })
          )}
          <p className="text-[11px] text-slate-500">
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

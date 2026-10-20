import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
  asignarVentanasCubicacion,
  copiarCasaCubicacion,
  copiarPisoCubicacion,
  crearDeptosCubicacion,
  crearPisosCubicacion,
  crearRecintosCubicacion,
  crearTorreCubicacion,
  crearUbicacionesCubicacion,
  crearUnidadEspecialCubicacion,
  renombrarTorreCubicacion,
} from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { NodoTorreCubicacion, TipoCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { cajaModal, campo, etiqueta, fondoModal } from './estilos';
import { leerEntero, leerLista, leerTorres, mensajeAsignacion, mensajeCopiaPiso, rangoPisos } from './utils';
import { RECINTOS_SUGERIDOS, type Vocabulario } from './vocabulario';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { IconButton } from '../../../components/ui/IconButton';
import { Casilla, InputCompacto } from '../../../components/ui/Campos';
import { BotonAlternar } from '../../../components/ui/BotonAlternar';

// Formularios del cubicador visual. Todos avisan con onHecho() para que la pantalla vuelva a leer la estructura.

const avisoError = (e: unknown) => {
  const { mensaje, detalle } = extraerErrorParaToast(e);
  mostrarToast(mensaje, { detalle });
};

const Marco: React.FC<{
  titulo: string;
  textoEnviar: string;
  puedeEnviar: boolean;
  cargando: boolean;
  onEnviar: () => void;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ titulo, textoEnviar, puedeEnviar, cargando, onEnviar, onClose, children }) => (
  <div className={fondoModal} role="dialog" aria-modal="true" aria-label={titulo}>
    <form
      className={`${cajaModal} max-w-md`}
      onSubmit={(e) => {
        e.preventDefault();
        if (puedeEnviar && !cargando) onEnviar();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-900">{titulo}</h3>
        <IconButton icono={X} etiqueta="Cerrar" onClick={onClose} />
      </div>
      {children}
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={!puedeEnviar} isLoading={cargando}>
          {textoEnviar}
        </Button>
      </div>
    </form>
  </div>
);

const Campo: React.FC<{ id: string; etiquetaTexto: string; valor: string; onCambio: (v: string) => void; ayuda?: string; placeholder?: string; mono?: boolean; invalido?: boolean; max?: number }> = ({
  id,
  etiquetaTexto,
  valor,
  onCambio,
  ayuda,
  placeholder,
  mono,
  invalido,
  max,
}) => (
  <div>
    <label htmlFor={id} className={etiqueta}>
      {etiquetaTexto}
    </label>
    <InputCompacto id={id} value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} maxLength={max} inputMode={mono ? 'numeric' : undefined} className={`w-full ${invalido ? 'border-rose-300' : ''}`} />
    {ayuda && <p className="text-[11px] text-slate-500 mt-1">{ayuda}</p>}
  </div>
);

interface Base {
  proyectoId: string;
  voc: Vocabulario;
  onClose: () => void;
  onHecho: () => void;
}

// ---- Armar el edificio de una vez: torres x pisos x departamentos ----
export const ArmarEdificioModal: React.FC<Base> = ({ proyectoId, onClose, onHecho }) => {
  const [torres, setTorres] = useState('');
  const [desde, setDesde] = useState('1');
  const [hasta, setHasta] = useState('');
  const [deptos, setDeptos] = useState('');
  const listaTorres = leerTorres(torres);
  const d = leerEntero(desde);
  const h = leerEntero(hasta);
  const n = leerEntero(deptos);
  const valido = d !== null && h !== null && h >= d && h - d < 120 && n !== null && n >= 1 && n <= 200;
  const total = valido ? listaTorres.length * (h - d + 1) * n : 0;

  const armar = useMutation({
    mutationFn: async () => {
      for (const torre of listaTorres) {
        await crearPisosCubicacion(proyectoId, { torre, desde: d!, hasta: h! });
        await crearDeptosCubicacion(proyectoId, { torre, desde: 1, hasta: n! });
      }
    },
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });

  return (
    <Marco titulo="Armar el edificio" textoEnviar="Crear estructura" puedeEnviar={valido} cargando={armar.isPending} onEnviar={() => armar.mutate()} onClose={onClose}>
      <p className="text-xs text-slate-500">Crea de una vez las torres, los pisos y los departamentos (vacíos). Después les asignas las ventanas. Si ya había estructura, solo agrega lo que falte.</p>
      <Campo id="armar-torres" etiquetaTexto="Torres" valor={torres} onCambio={setTorres} placeholder="A, B, C" ayuda="Déjalo vacío si la obra no tiene torres." max={60} />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="armar-desde" etiquetaTexto="Piso inicial" valor={desde} onCambio={setDesde} mono invalido={d === null} />
        <Campo id="armar-hasta" etiquetaTexto="Piso final" valor={hasta} onCambio={setHasta} mono invalido={hasta !== '' && (h === null || (d !== null && h < d))} />
      </div>
      <Campo id="armar-deptos" etiquetaTexto="Departamentos por piso" valor={deptos} onCambio={setDeptos} mono invalido={deptos !== '' && (n === null || n < 1)} ayuda="Se numeran desde 1 en cada piso (101, 102… en el piso 1)." />
      {valido && (
        <p className="text-xs text-slate-700 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2" data-testid="armar-resumen">
          Se crearán {listaTorres.length === 1 && listaTorres[0] === '' ? 'una obra sin torres' : `${listaTorres.length} torre(s)`} × {h! - d! + 1} piso(s) × {n} depto(s) = <b>{total} departamentos</b>.
        </p>
      )}
    </Marco>
  );
};

// ---- Torre nueva ----
export const TorreModal: React.FC<Base> = ({ proyectoId, voc, onClose, onHecho }) => {
  const [nombre, setNombre] = useState('');
  const crear = useMutation({
    mutationFn: () => crearTorreCubicacion(proyectoId, nombre.trim().toUpperCase()),
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  return (
    <Marco titulo={voc.agregarContenedor} textoEnviar="Agregar" puedeEnviar={nombre.trim() !== ''} cargando={crear.isPending} onEnviar={() => crear.mutate()} onClose={onClose}>
      <Campo id="torre-nombre" etiquetaTexto={`Nombre de ${voc.elContenedor}`} valor={nombre} onCambio={setNombre} placeholder={voc.modo === 'CASA' ? 'C2' : 'A'} max={10} ayuda={voc.modo === 'CASA' ? 'Corto: forma parte del nombre de cada ventana (V01_C2_ESTAR).' : undefined} />
    </Marco>
  );
};

export const RenombrarTorreModal: React.FC<Base & { torreId: string; nombreActual: string }> = ({ proyectoId, voc, torreId, nombreActual, onClose, onHecho }) => {
  const [nombre, setNombre] = useState('');
  const renombrar = useMutation({
    mutationFn: () => renombrarTorreCubicacion(proyectoId, { torreId, nombre: nombre.trim().toUpperCase() }),
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  return (
    <Marco
      titulo={nombreActual === '' ? `Ponerle nombre a ${voc.elContenedor}` : `Cambiar nombre de ${voc.textoTorre(nombreActual).toLowerCase()}`}
      textoEnviar="Guardar"
      puedeEnviar={nombre.trim() !== ''}
      cargando={renombrar.isPending}
      onEnviar={() => renombrar.mutate()}
      onClose={onClose}
    >
      <Campo id="renombrar-nombre" etiquetaTexto="Nombre nuevo" valor={nombre} onCambio={setNombre} placeholder={voc.modo === 'CASA' ? 'C1' : 'A'} max={10} ayuda="Las nomenclaturas de sus ventanas se recalculan con el nombre nuevo." />
    </Marco>
  );
};

// ---- Unidad especial sin piso (areas comunes, fachada...) ----
export const UnidadEspecialModal: React.FC<Base & { torreId: string }> = ({ proyectoId, voc, torreId, onClose, onHecho }) => {
  const [nombre, setNombre] = useState('');
  const crear = useMutation({
    mutationFn: () => crearUnidadEspecialCubicacion(proyectoId, { torreId, nombre: nombre.trim() }),
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  return (
    <Marco titulo={voc.modo === 'CASA' ? 'Agregar exterior' : 'Agregar unidad especial'} textoEnviar="Agregar" puedeEnviar={nombre.trim() !== ''} cargando={crear.isPending} onEnviar={() => crear.mutate()} onClose={onClose}>
      <Campo
        id="especial-nombre"
        etiquetaTexto="Nombre"
        valor={nombre}
        onCambio={setNombre}
        placeholder={voc.modo === 'CASA' ? 'Quincho' : 'Áreas comunes'}
        max={60}
        ayuda={voc.modo === 'CASA' ? 'Un lugar sin piso, para ventanas que no van dentro de la casa (quincho, bodega exterior...).' : 'Una unidad sin piso, para ventanas que no van en un depto puntual (fachada, áreas comunes...).'}
      />
    </Marco>
  );
};

// ---- Pisos de una torre ----
export const PisosModal: React.FC<Base & { torre: string; sugerido: number }> = ({ proyectoId, voc, torre, sugerido, onClose, onHecho }) => {
  const [desde, setDesde] = useState(String(sugerido));
  const [hasta, setHasta] = useState('');
  const d = leerEntero(desde);
  const h = hasta.trim() === '' ? d : leerEntero(hasta);
  const valido = d !== null && h !== null && h >= d && h - d < 120;
  const crear = useMutation({
    mutationFn: () => crearPisosCubicacion(proyectoId, { torre, desde: d!, hasta: h! }),
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  return (
    <Marco titulo={`Agregar pisos · ${voc.textoTorre(torre)}`} textoEnviar="Agregar" puedeEnviar={valido} cargando={crear.isPending} onEnviar={() => crear.mutate()} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="pisos-desde" etiquetaTexto="Piso inicial" valor={desde} onCambio={setDesde} mono invalido={d === null} />
        <Campo id="pisos-hasta" etiquetaTexto="Piso final" valor={hasta} onCambio={setHasta} mono placeholder="solo uno" invalido={hasta !== '' && (h === null || (d !== null && h < d))} />
      </div>
    </Marco>
  );
};

// ---- Departamentos de un piso (o de todos los de la torre) ----
export const DeptosModal: React.FC<Base & { torre: string; piso?: number }> = ({ proyectoId, voc, torre, piso, onClose, onHecho }) => {
  const [desde, setDesde] = useState('1');
  const [hasta, setHasta] = useState('');
  const [todos, setTodos] = useState(piso === undefined);
  const d = leerEntero(desde);
  const h = leerEntero(hasta);
  const valido = d !== null && h !== null && h >= d && h - d < 200;
  const crear = useMutation({
    mutationFn: () => crearDeptosCubicacion(proyectoId, { torre, piso: todos ? undefined : piso, desde: d!, hasta: h! }),
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  return (
    <Marco
      titulo={piso === undefined ? `Agregar departamentos · ${voc.textoTorre(torre)}` : `Agregar departamentos · ${voc.textoTorre(torre)}, piso ${piso}`}
      textoEnviar="Agregar"
      puedeEnviar={valido}
      cargando={crear.isPending}
      onEnviar={() => crear.mutate()}
      onClose={onClose}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo id="deptos-desde" etiquetaTexto="Desde el depto" valor={desde} onCambio={setDesde} mono invalido={d === null} />
        <Campo id="deptos-hasta" etiquetaTexto="Hasta el depto" valor={hasta} onCambio={setHasta} mono invalido={hasta !== '' && (h === null || (d !== null && h < d))} />
      </div>
      {piso !== undefined && (
        <Casilla checked={todos} onChange={setTodos} label="Crearlos en todos los pisos de la torre" />
      )}
    </Marco>
  );
};

// ---- Copiar un piso (piso tipo) a otros ----
export const CopiarPisoModal: React.FC<Base & { torre: NodoTorreCubicacion; piso: number }> = ({ proyectoId, voc, torre, piso, onClose, onHecho }) => {
  const otros = torre.pisos.map((p) => p.numero).filter((p) => p !== piso);
  const [elegidos, setElegidos] = useState<number[]>([]);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const d = leerEntero(desde);
  const h = leerEntero(hasta);
  const agregarRango = () => {
    if (d === null || h === null) return;
    const rango = rangoPisos(d, h).filter((p) => p !== piso);
    setElegidos((prev) => [...new Set([...prev, ...rango])].sort((a, b) => a - b));
  };
  const alternar = (p: number) => setElegidos((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b)));
  const origen = torre.pisos.find((p) => p.numero === piso);

  const copiar = useMutation({
    mutationFn: () => copiarPisoCubicacion(proyectoId, { torreId: torre.id, desde: piso, hacia: elegidos }),
    onSuccess: (r) => {
      mostrarToast(mensajeCopiaPiso(r), { tipo: 'info', duracionMs: 15000 });
      onHecho();
      onClose();
    },
    onError: avisoError,
  });

  return (
    <Marco titulo={`Copiar el piso ${piso} a otros pisos`} textoEnviar="Copiar" puedeEnviar={elegidos.length > 0} cargando={copiar.isPending} onEnviar={() => copiar.mutate()} onClose={onClose}>
      <p className="text-xs text-slate-500">
        Copia los {origen?.deptos.length ?? 0} {voc.unidad}(s) y sus ventanas (tipo y ubicación) usando las ventanas contratadas que aún no tienen lugar. No copia el rasgo: se mide ventana por ventana. Los
        {voc.unidades} que ya tienen ventanas no se tocan.
      </p>
      <div>
        <p className={etiqueta}>Pisos de destino</p>
        {otros.length === 0 ? (
          <p className="text-xs text-slate-500">{voc.elContenedor[0].toUpperCase() + voc.elContenedor.slice(1)} no tiene más pisos: crea primero los pisos de destino.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {otros.map((p) => (
              <BotonAlternar key={p} activo={elegidos.includes(p)} onClick={() => alternar(p)}>
                <span className="font-mono">{p}</span>
              </BotonAlternar>
            ))}
          </div>
        )}
        {otros.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <Button variant="link" size="sm" onClick={() => setElegidos(otros)}>todos</Button>
            <Button variant="link" size="sm" onClick={() => setElegidos([])}>ninguno</Button>
            <span className="text-slate-300">|</span>
            <InputCompacto aria-label="Rango desde" value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="desde" className="w-16 font-mono" />
            <InputCompacto aria-label="Rango hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="hasta" className="w-16 font-mono" />
            <Button variant="link" size="sm" onClick={agregarRango} disabled={d === null || h === null}>agregar rango</Button>
          </div>
        )}
      </div>
    </Marco>
  );
};

const RECINTOS = ['DORM 1', 'DORM 2', 'DORM 3', 'ESTAR', 'COMEDOR', 'COCINA', 'BAÑO 1', 'BAÑO 2', 'LOGGIA', 'TERRAZA', 'PASILLO'];

// ---- Asignar ventanas a un departamento (o unidad especial) ----
export const AsignarModal: React.FC<Base & { unidadId: string; torre: string; nombreUnidad: string; recintos?: string[]; ubicacionInicial?: string; tipos: TipoCubicacion[]; tipoInicial?: string }> = ({
  proyectoId,
  voc,
  unidadId,
  torre,
  nombreUnidad,
  recintos = [],
  ubicacionInicial = '',
  tipos,
  tipoInicial,
  onClose,
  onHecho,
}) => {
  const disponibles = tipos.filter((t) => !t.esAreaComun);
  const [tipoId, setTipoId] = useState(tipoInicial ?? '');
  const [cantidad, setCantidad] = useState('1');
  const [ubicacion, setUbicacion] = useState(ubicacionInicial);
  const [exceder, setExceder] = useState(false);
  const tipo = disponibles.find((t) => t.id === tipoId);
  const n = leerEntero(cantidad);
  const saldo = tipo ? Math.max(tipo.saldo, 0) : 0;
  const pasa = tipo !== undefined && n !== null && n > saldo;
  const valido = !!tipo && n !== null && n >= 1 && n <= 50 && (!pasa || exceder);

  const asignar = useMutation({
    mutationFn: () => asignarVentanasCubicacion(proyectoId, { unidadId, tipoId, cantidad: n!, ubicacion: ubicacion.trim() || null, excederContratadas: pasa && exceder }),
    onSuccess: (r) => {
      if (r.faltan > 0) mostrarToast(mensajeAsignacion(r, tipo!.codigo), { tipo: 'info', duracionMs: 15000 });
      onHecho();
      onClose();
    },
    onError: avisoError,
  });

  return (
    <Marco titulo={`Agregar ventanas · ${voc.textoTorre(torre)}, ${voc.unidadCorta} ${nombreUnidad}`} textoEnviar="Agregar" puedeEnviar={valido} cargando={asignar.isPending} onEnviar={() => asignar.mutate()} onClose={onClose}>
      <div>
        <Select label="Tipo de ventana" id="asignar-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={campo}>
          <option value="">— elegir tipo —</option>
          {disponibles.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo} · {t.sistema}
              {t.anchoPlanoMm != null ? ` · ${formatoMm(t.anchoPlanoMm)} × ${formatoMm(t.altoPlanoMm)}` : ''} · quedan {Math.max(t.saldo, 0)}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="asignar-cantidad" etiquetaTexto="Cantidad" valor={cantidad} onCambio={setCantidad} mono invalido={n === null || n < 1} />
        {voc.modo === 'EDIFICIO' && recintos.length > 0 ? (
          <Select label="Ubicación" id="asignar-ubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className={campo}>
            <option value="">Sin ubicación</option>
            {recintos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        ) : voc.modo === 'EDIFICIO' ? (
          <div>
            <Input label="Ubicación" id="asignar-ubicacion" list="recintos-cubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={100} placeholder="DORM 1, ESTAR…" />
            <datalist id="recintos-cubicacion">
              {RECINTOS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 self-end pb-2">La ubicación es el recinto: {nombreUnidad}.</p>
        )}
      </div>
      {pasa && (
        <Casilla checked={exceder} onChange={setExceder} label={<><span>
            Solo quedan {saldo} {tipo!.codigo} sin ubicar (contratadas {tipo!.cantidadContratada}). Marca esto para agregar igualmente las {n! - saldo} de más; quedarán por sobre lo contratado.
          </span></>} />
      )}
    </Marco>
  );
};

// ---- Armar una casa de una vez: sus pisos y los recintos de cada piso ----
export const ArmarCasaModal: React.FC<Base & { casas: string[] }> = ({ proyectoId, casas, onClose, onHecho }) => {
  const [nombre, setNombre] = useState('');
  const [pisos, setPisos] = useState('1');
  const [recintos, setRecintos] = useState<Record<number, string>>({ 1: ['ESTAR', 'COMEDOR', 'COCINA', 'DORM 1', 'BAÑO 1'].join(', ') });
  const n = leerEntero(pisos);
  const valido = n !== null && n >= 1 && n <= 6;
  const numeros = valido ? Array.from({ length: n! }, (_, i) => i + 1) : [];
  const torre = nombre.trim().toUpperCase();
  const yaExiste = casas.includes(torre);
  const totalRecintos = numeros.reduce((s, p) => s + leerLista(recintos[p] ?? '').length, 0);

  const armar = useMutation({
    mutationFn: async () => {
      await crearPisosCubicacion(proyectoId, { torre, desde: 1, hasta: n! });
      for (const piso of numeros) {
        const nombres = leerLista(recintos[piso] ?? '');
        if (nombres.length) await crearRecintosCubicacion(proyectoId, { torre, piso, nombres });
      }
    },
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });

  return (
    <Marco titulo="Armar la casa" textoEnviar="Crear estructura" puedeEnviar={valido && totalRecintos > 0} cargando={armar.isPending} onEnviar={() => armar.mutate()} onClose={onClose}>
      <p className="text-xs text-slate-500">
        Crea los pisos y los recintos de la casa (vacíos). Después ubicas las ventanas en cada recinto. Si ya había estructura, solo agrega lo que falte.
      </p>
      <Campo
        id="casa-nombre"
        etiquetaTexto="Nombre de la casa"
        valor={nombre}
        onCambio={setNombre}
        placeholder="C1"
        max={10}
        ayuda={yaExiste ? 'Esa casa ya existe: se le agregarán los pisos y recintos que falten.' : 'Déjalo vacío si la obra es una sola casa. Si hay más, ponle un nombre corto (C1, C2…).'}
      />
      <Campo id="casa-pisos" etiquetaTexto="Pisos de la casa" valor={pisos} onCambio={setPisos} mono invalido={pisos !== '' && !valido} ayuda="De 1 a 6." />
      {numeros.map((p) => (
        <Campo
          key={p}
          id={`casa-recintos-${p}`}
          etiquetaTexto={`Recintos del piso ${p}`}
          valor={recintos[p] ?? ''}
          onCambio={(v) => setRecintos((r) => ({ ...r, [p]: v }))}
          placeholder={RECINTOS_SUGERIDOS.slice(0, 4).join(', ')}
          ayuda={p === 1 ? 'Separados por coma. Nombres cortos: forman parte del nombre de cada ventana.' : undefined}
        />
      ))}
      {valido && totalRecintos > 0 && (
        <p className="text-xs text-slate-700 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2" data-testid="armar-resumen">
          Se creará {torre ? `la casa ${torre}` : 'la casa'} con {n} piso(s) y <b>{totalRecintos} recinto(s)</b>.
        </p>
      )}
    </Marco>
  );
};

// ---- Recintos nuevos en un piso de una casa ----
export const RecintosModal: React.FC<Base & { torre: string; piso: number }> = ({ proyectoId, voc, torre, piso, onClose, onHecho }) => {
  const [texto, setTexto] = useState('');
  const nombres = leerLista(texto);
  const crear = useMutation({
    mutationFn: () => crearRecintosCubicacion(proyectoId, { torre, piso, nombres }),
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  return (
    <Marco titulo={`Agregar recintos · ${voc.textoTorre(torre)}, piso ${piso}`} textoEnviar="Agregar" puedeEnviar={nombres.length > 0} cargando={crear.isPending} onEnviar={() => crear.mutate()} onClose={onClose}>
      <Campo
        id="recintos-nombres"
        etiquetaTexto="Recintos"
        valor={texto}
        onCambio={setTexto}
        placeholder="DORM 2, BAÑO 2"
        ayuda="Separados por coma. Nombres cortos: forman parte del nombre de cada ventana (V01_C1_DORM2)."
      />
    </Marco>
  );
};

// ---- Copiar una casa entera a casas nuevas (un condominio es la misma casa repetida) ----
export const CopiarCasaModal: React.FC<Base & { torre: NodoTorreCubicacion }> = ({ proyectoId, voc, torre, onClose, onHecho }) => {
  const [texto, setTexto] = useState('');
  const destinos = leerTorres(texto).filter(Boolean);
  const copiar = useMutation({
    mutationFn: () => copiarCasaCubicacion(proyectoId, { torreId: torre.id, destinos }),
    onSuccess: (r) => {
      const partes = [`${r.casas} casa(s) nueva(s) con ${r.ventanas} ventana(s) copiada(s)`];
      if (r.faltan.length > 0) partes.push(`faltaron por ubicar: ${r.faltan.map((f) => `${f.cantidad} ${f.codigo}`).join(', ')} (no quedaban contratadas libres)`);
      mostrarToast(partes.join(' · ') + '.', { tipo: 'info', duracionMs: 15000 });
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  const recintos = torre.pisos.reduce((s, p) => s + p.deptos.length, 0);
  return (
    <Marco titulo={`Copiar ${voc.textoTorre(torre.nombre).toLowerCase()}`} textoEnviar="Copiar" puedeEnviar={destinos.length > 0} cargando={copiar.isPending} onEnviar={() => copiar.mutate()} onClose={onClose}>
      <p className="text-xs text-slate-500">
        Crea casas nuevas iguales a esta: {torre.pisos.length} piso(s) y {recintos} recinto(s), con sus ventanas (tipo y ubicación) tomadas de las contratadas que aún no tienen lugar. No copia el rasgo: se mide
        ventana por ventana.
      </p>
      <Campo id="copiar-casas" etiquetaTexto="Nombres de las casas nuevas" valor={texto} onCambio={setTexto} placeholder="C2, C3, C4" max={200} ayuda="Separados por coma. Cada nombre es corto y nuevo." />
      {destinos.length > 0 && <p className="text-xs text-slate-700 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">Se crearán {destinos.length} casa(s): {destinos.join(', ')}.</p>}
    </Marco>
  );
};

// ---- Ubicaciones (recintos) dentro de un departamento ----
export const UbicacionesModal: React.FC<Base & { unidadId: string; torre: string; nombreUnidad: string }> = ({ proyectoId, voc, unidadId, torre, nombreUnidad, onClose, onHecho }) => {
  const [texto, setTexto] = useState('');
  const nombres = leerLista(texto);
  const crear = useMutation({
    mutationFn: () => crearUbicacionesCubicacion(proyectoId, { unidadId, nombres }),
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  return (
    <Marco titulo={`Agregar ubicaciones · ${voc.textoTorre(torre)}, ${voc.unidadCorta} ${nombreUnidad}`} textoEnviar="Agregar" puedeEnviar={nombres.length > 0} cargando={crear.isPending} onEnviar={() => crear.mutate()} onClose={onClose}>
      <Campo
        id="ubicaciones-nombres"
        etiquetaTexto="Ubicaciones"
        valor={texto}
        onCambio={setTexto}
        placeholder={RECINTOS_SUGERIDOS.slice(3, 7).join(', ')}
        ayuda="Separadas por coma: DORM 1, ESTAR… Al poner una ventana en una ubicación, esta se anota como su ubicación."
      />
    </Marco>
  );
};

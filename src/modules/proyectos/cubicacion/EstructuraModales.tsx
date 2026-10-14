import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X } from 'lucide-react';
import {
  asignarVentanasCubicacion,
  copiarPisoCubicacion,
  crearDeptosCubicacion,
  crearPisosCubicacion,
  crearTorreCubicacion,
  renombrarTorreCubicacion,
} from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../lib/toast';
import type { NodoTorreCubicacion, TipoCubicacion } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { cajaModal, campo, etiqueta, fondoModal } from './estilos';
import { leerEntero, leerTorres, mensajeAsignacion, mensajeCopiaPiso, rangoPisos, textoTorre } from './utils';

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
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer" aria-label="Cerrar">
          <X className="w-4 h-4" />
        </button>
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
    <input id={id} value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder} maxLength={max} inputMode={mono ? 'numeric' : undefined} className={`${campo} ${invalido ? 'border-rose-300' : ''}`} />
    {ayuda && <p className="text-[11px] text-slate-500 mt-1">{ayuda}</p>}
  </div>
);

interface Base {
  proyectoId: string;
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
export const TorreModal: React.FC<Base> = ({ proyectoId, onClose, onHecho }) => {
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
    <Marco titulo="Agregar torre" textoEnviar="Agregar" puedeEnviar={nombre.trim() !== ''} cargando={crear.isPending} onEnviar={() => crear.mutate()} onClose={onClose}>
      <Campo id="torre-nombre" etiquetaTexto="Nombre de la torre" valor={nombre} onCambio={setNombre} placeholder="A" max={10} />
    </Marco>
  );
};

export const RenombrarTorreModal: React.FC<Base & { torre: string }> = ({ proyectoId, torre, onClose, onHecho }) => {
  const [nombre, setNombre] = useState('');
  const renombrar = useMutation({
    mutationFn: () => renombrarTorreCubicacion(proyectoId, { de: torre, a: nombre.trim().toUpperCase() }),
    onSuccess: () => {
      onHecho();
      onClose();
    },
    onError: avisoError,
  });
  return (
    <Marco
      titulo={torre === '' ? 'Ponerle nombre a la torre' : `Cambiar nombre de la ${textoTorre(torre).toLowerCase()}`}
      textoEnviar="Guardar"
      puedeEnviar={nombre.trim() !== ''}
      cargando={renombrar.isPending}
      onEnviar={() => renombrar.mutate()}
      onClose={onClose}
    >
      <Campo id="renombrar-nombre" etiquetaTexto="Nombre nuevo" valor={nombre} onCambio={setNombre} placeholder="A" max={10} ayuda="Las nomenclaturas de sus ventanas se recalculan con el nombre nuevo." />
    </Marco>
  );
};

// ---- Pisos de una torre ----
export const PisosModal: React.FC<Base & { torre: string; sugerido: number }> = ({ proyectoId, torre, sugerido, onClose, onHecho }) => {
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
    <Marco titulo={`Agregar pisos · ${textoTorre(torre)}`} textoEnviar="Agregar" puedeEnviar={valido} cargando={crear.isPending} onEnviar={() => crear.mutate()} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="pisos-desde" etiquetaTexto="Piso inicial" valor={desde} onCambio={setDesde} mono invalido={d === null} />
        <Campo id="pisos-hasta" etiquetaTexto="Piso final" valor={hasta} onCambio={setHasta} mono placeholder="solo uno" invalido={hasta !== '' && (h === null || (d !== null && h < d))} />
      </div>
    </Marco>
  );
};

// ---- Departamentos de un piso (o de todos los de la torre) ----
export const DeptosModal: React.FC<Base & { torre: string; piso?: number }> = ({ proyectoId, torre, piso, onClose, onHecho }) => {
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
      titulo={piso === undefined ? `Agregar departamentos · ${textoTorre(torre)}` : `Agregar departamentos · ${textoTorre(torre)}, piso ${piso}`}
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
        <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
          <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} />
          Crearlos en todos los pisos de la torre
        </label>
      )}
    </Marco>
  );
};

// ---- Copiar un piso (piso tipo) a otros ----
export const CopiarPisoModal: React.FC<Base & { torre: NodoTorreCubicacion; piso: number }> = ({ proyectoId, torre, piso, onClose, onHecho }) => {
  const otros = torre.pisos.map((p) => p.piso).filter((p) => p !== piso);
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
  const origen = torre.pisos.find((p) => p.piso === piso);

  const copiar = useMutation({
    mutationFn: () => copiarPisoCubicacion(proyectoId, { torre: torre.nombre, desde: piso, hacia: elegidos }),
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
        Copia los {origen?.deptos.length ?? 0} departamento(s) y sus ventanas (tipo y ubicación) usando las ventanas contratadas que aún no tienen lugar. No copia el rasgo: se mide ventana por ventana. Los
        departamentos que ya tienen ventanas no se tocan.
      </p>
      <div>
        <p className={etiqueta}>Pisos de destino</p>
        {otros.length === 0 ? (
          <p className="text-xs text-slate-500">La torre no tiene más pisos: crea primero los pisos de destino.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {otros.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => alternar(p)}
                aria-pressed={elegidos.includes(p)}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono cursor-pointer ${elegidos.includes(p) ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-brand-400'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {otros.length > 1 && (
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <button type="button" onClick={() => setElegidos(otros)} className="text-brand-700 hover:underline cursor-pointer">
              todos
            </button>
            <button type="button" onClick={() => setElegidos([])} className="text-slate-500 hover:underline cursor-pointer">
              ninguno
            </button>
            <span className="text-slate-300">|</span>
            <input aria-label="Rango desde" value={desde} onChange={(e) => setDesde(e.target.value)} placeholder="desde" className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono" />
            <input aria-label="Rango hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} placeholder="hasta" className="w-16 px-2 py-1 rounded-lg border border-slate-200 text-xs font-mono" />
            <button type="button" onClick={agregarRango} disabled={d === null || h === null} className="text-brand-700 hover:underline cursor-pointer disabled:opacity-40">
              agregar rango
            </button>
          </div>
        )}
      </div>
    </Marco>
  );
};

const RECINTOS = ['DORM 1', 'DORM 2', 'DORM 3', 'ESTAR', 'COMEDOR', 'COCINA', 'BAÑO 1', 'BAÑO 2', 'LOGGIA', 'TERRAZA', 'PASILLO'];

// ---- Asignar ventanas a un departamento ----
export const AsignarModal: React.FC<Base & { torre: string; piso: number; dpto: number; tipos: TipoCubicacion[]; tipoInicial?: string }> = ({
  proyectoId,
  torre,
  piso,
  dpto,
  tipos,
  tipoInicial,
  onClose,
  onHecho,
}) => {
  const disponibles = tipos.filter((t) => !t.esAreaComun);
  const [tipoId, setTipoId] = useState(tipoInicial ?? '');
  const [cantidad, setCantidad] = useState('1');
  const [ubicacion, setUbicacion] = useState('');
  const [exceder, setExceder] = useState(false);
  const tipo = disponibles.find((t) => t.id === tipoId);
  const n = leerEntero(cantidad);
  const saldo = tipo ? Math.max(tipo.saldo, 0) : 0;
  const pasa = tipo !== undefined && n !== null && n > saldo;
  const valido = !!tipo && n !== null && n >= 1 && n <= 50 && (!pasa || exceder);

  const asignar = useMutation({
    mutationFn: () => asignarVentanasCubicacion(proyectoId, { torre, piso, dpto, tipoId, cantidad: n!, ubicacion: ubicacion.trim() || null, excederContratadas: pasa && exceder }),
    onSuccess: (r) => {
      if (r.faltan > 0) mostrarToast(mensajeAsignacion(r, tipo!.codigo), { tipo: 'info', duracionMs: 15000 });
      onHecho();
      onClose();
    },
    onError: avisoError,
  });

  return (
    <Marco titulo={`Agregar ventanas · ${textoTorre(torre)}, depto ${piso}${String(dpto).padStart(2, '0')}`} textoEnviar="Agregar" puedeEnviar={valido} cargando={asignar.isPending} onEnviar={() => asignar.mutate()} onClose={onClose}>
      <div>
        <label htmlFor="asignar-tipo" className={etiqueta}>
          Tipo de ventana
        </label>
        <select id="asignar-tipo" value={tipoId} onChange={(e) => setTipoId(e.target.value)} className={campo}>
          <option value="">— elegir tipo —</option>
          {disponibles.map((t) => (
            <option key={t.id} value={t.id}>
              {t.codigo} · {t.sistema}
              {t.anchoPlanoMm != null ? ` · ${formatoMm(t.anchoPlanoMm)} × ${formatoMm(t.altoPlanoMm)}` : ''} · quedan {Math.max(t.saldo, 0)}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="asignar-cantidad" etiquetaTexto="Cantidad" valor={cantidad} onCambio={setCantidad} mono invalido={n === null || n < 1} />
        <div>
          <label htmlFor="asignar-ubicacion" className={etiqueta}>
            Ubicación
          </label>
          <input id="asignar-ubicacion" list="recintos-cubicacion" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} maxLength={100} placeholder="DORM 1, ESTAR…" className={campo} />
          <datalist id="recintos-cubicacion">
            {RECINTOS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </div>
      </div>
      {pasa && (
        <label className="flex items-start gap-2 text-xs text-amber-900 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={exceder} onChange={(e) => setExceder(e.target.checked)} />
          <span>
            Solo quedan {saldo} {tipo!.codigo} sin ubicar (contratadas {tipo!.cantidadContratada}). Marca esto para agregar igualmente las {n! - saldo} de más; quedarán por sobre lo contratado.
          </span>
        </label>
      )}
    </Marco>
  );
};

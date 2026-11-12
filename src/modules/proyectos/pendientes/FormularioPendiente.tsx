import React, { useMemo, useState } from 'react';
import { Plus, Ruler } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea, OpcionesTarjetaMultiple } from '../../../components/ui/Campos';
import { Aviso } from '../../../components/ui/Aviso';
import { ContadorTactil } from '../../../components/ui/ContadorTactil';
import type { FabricacionPieza, FichaVentanaObra, MotivoPendiente, NuevoPendientePayload, TipoElementoPendiente } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { nombreVentana } from '../obra/estadoVentana';
import { AdjuntosNuevoPendiente } from './adjuntos/AdjuntosNuevoPendiente';
import {
  ETIQUETA_DESTINO,
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  MOTIVOS_PENDIENTE,
  TIPOS_PENDIENTE,
  admiteRectificacion,
  areaDelPendiente,
  leerMilimetros,
  nombreCuadro,
  textoRectificacion,
  tituloPendiente,
  type DatosSugerencia,
} from './utils';

/** Resumen corto de una hoja para su tarjeta: "11030 Jet Black · 8 perfiles". */
function resumenHoja(piezas: FabricacionPieza[]): string {
  if (piezas.length === 0) return 'sin perfiles aún';
  const principal = piezas[0];
  return [principal.codigoArticulo, principal.acabadoDescripcion].filter(Boolean).join(' ') + ` · ${piezas.length} perfiles`;
}

/**
 * Lo más que se puede pedir de una línea: lo que lleva UNA ventana (al menos 1). El documento trae el total de la
 * línea, que puede ser de varias ventanas iguales: se divide por esas unidades.
 */
const topePorVentana = (cantidadLinea: number | string | null | undefined, ventanasDeLaLinea: number) => Math.max(1, Math.ceil((Number(cantidadLinea) || 1) / Math.max(1, ventanasDeLaLinea)));

/**
 * Cuántas se necesitan de cada material (o vidrio con más de una unidad) marcado: parte en todo lo que lleva la
 * ventana y se baja si faltan menos. Compras pide esa cantidad.
 */
const CuantasSeNecesitan: React.FC<{
  filas: { clave: string; nombre: string; tope: number }[];
  cantidades: Record<string, number>;
  onChange: (c: Record<string, number>) => void;
}> = ({ filas, cantidades, onChange }) =>
  filas.length === 0 ? null : (
    <fieldset className="rounded-xl border border-slate-200 bg-white" data-testid="cuantas-se-necesitan">
      <legend className="ml-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">¿Cuántas se necesitan?</legend>
      <ul className="divide-y divide-slate-100">
        {filas.map((f) => (
          <li key={f.clave} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2">
            <span className="text-xs font-bold text-slate-800 min-w-0 flex-1 basis-40 break-words">{f.nombre}</span>
            <span className="flex items-center gap-2 shrink-0">
              <ContadorTactil valor={Math.min(cantidades[f.clave] ?? f.tope, f.tope)} onChange={(n) => onChange({ ...cantidades, [f.clave]: n })} min={1} max={f.tope} enteros aria-label={`Cuántas se necesitan de ${f.nombre}`} />
              <span className="text-xs text-slate-500 whitespace-nowrap">de {f.tope}</span>
            </span>
          </li>
        ))}
      </ul>
    </fieldset>
  );

export interface PendientePreparado {
  payload: NuevoPendientePayload;
  /** Resumen corto para el carrito: "Vidrio 4/9/4 · 1.032 × 1.554 mm". */
  resumen: string;
  /** Fotos o documentos por subir a OneDrive cuando el pendiente se cree. */
  archivos: File[];
}

interface Props {
  proyectoId: string;
  ficha: FichaVentanaObra;
  /** Un pendiente por cada vidrio u hoja marcados. */
  onAgregar: (p: PendientePreparado[]) => void;
}

// Lo último que se eligió en este dispositivo: en terreno los pendientes vienen en racha (el mismo tipo y motivo
// varias veces seguidas), así que el formulario parte con lo anterior en vez de con un valor fijo.
const CLAVE_ULTIMO = 'mtw-pendiente-ultimo';
function leerUltimo(): { tipo: TipoElementoPendiente; motivo: MotivoPendiente } {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_ULTIMO) ?? 'null') as { tipo?: TipoElementoPendiente; motivo?: MotivoPendiente } | null;
    return { tipo: g?.tipo && TIPOS_PENDIENTE.includes(g.tipo) ? g.tipo : 'VIDRIO', motivo: g?.motivo && MOTIVOS_PENDIENTE.includes(g.motivo) ? g.motivo : 'DANO_OBRA' };
  } catch {
    return { tipo: 'VIDRIO', motivo: 'DANO_OBRA' };
  }
}
function guardarUltimo(tipo: TipoElementoPendiente, motivo: MotivoPendiente) {
  try {
    localStorage.setItem(CLAVE_ULTIMO, JSON.stringify({ tipo, motivo }));
  } catch {
    // Sin storage: el formulario parte con los valores por defecto.
  }
}

/**
 * Detalle de UN pendiente para la ventana elegida (ingreso de pendientes). Qué falta (marco, hoja, vidrio, material o
 * la ventana completa) y el motivo se eligen en dos desplegables lado a lado; el elemento puntual sale de la ficha de la ventana y
 * el título lo arma el sistema. En «Material» solo van los que se reponen sueltos en la obra (accesorios y herrajes:
 * lo marca el tipo de producto). Al agregar se limpia para el siguiente, sin cerrar nada.
 */
export const FormularioPendiente: React.FC<Props> = ({ proyectoId, ficha, onAgregar }) => {
  const v = ficha.ventana;
  const [inicial] = useState(leerUltimo);
  const [tipo, setTipo] = useState<TipoElementoPendiente>(inicial.tipo);
  const [motivo, setMotivo] = useState<MotivoPendiente>(inicial.motivo);
  // Vidrios (posición en la lista), marcos y hojas (id) y materiales (posición): se pueden marcar varios y sale un pendiente por cada uno.
  const [materialesSel, setMaterialesSel] = useState<string[]>([]);
  const [vidriosSel, setVidriosSel] = useState<string[]>([]);
  const [hojasSel, setHojasSel] = useState<string[]>([]);
  const [marcosSel, setMarcosSel] = useState<string[]>([]);
  // Cuántas se necesitan de cada material o vidrio marcado (clave: «m:posición» o «v:posición»); sin tocar, todo lo que lleva la ventana.
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [notas, setNotas] = useState('');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [rectificando, setRectificando] = useState(false);
  const [rectAncho, setRectAncho] = useState('');
  const [rectAlto, setRectAlto] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState('');

  const hojas = useMemo(() => ficha.cuadros.filter((c) => c.tipo === 'HOJA'), [ficha.cuadros]);
  const marcos = useMemo(() => ficha.cuadros.filter((c) => c.tipo === 'MARCO'), [ficha.cuadros]);
  // Accesorios y herrajes de la ventana (con su posición en la lista completa, que es su clave).
  const reponibles = useMemo(() => ficha.materiales.map((m, i) => ({ m, clave: String(i) })).filter((x) => x.m.reponibleEnObra), [ficha.materiales]);
  const vidriosElegidos = tipo === 'VIDRIO' ? vidriosSel.map((i) => ficha.vidrios[Number(i)]).filter(Boolean) : [];
  const hojasElegidas = tipo === 'HOJA' ? hojas.filter((h) => hojasSel.includes(h.id)) : [];
  const marcosElegidos = tipo === 'MARCO' ? marcos.filter((m) => marcosSel.includes(m.id)) : [];
  const materialesElegidos = tipo === 'MATERIAL' ? reponibles.filter((x) => materialesSel.includes(x.clave)) : [];
  // La rectificación solo aplica con un único vidrio marcado.
  const vidrioElegido = vidriosElegidos.length === 1 ? vidriosElegidos[0] : undefined;

  // Medida de la ventana: la de fabricación (final) o, sin lote, la del plano.
  const ancho = ficha.fabricacionVentana?.anchoMm ?? v.anchoFabricacionMm ?? v.anchoPlanoMm;
  const alto = ficha.fabricacionVentana?.altoMm ?? v.altoFabricacionMm ?? v.altoPlanoMm;
  const medidaOriginal =
    tipo === 'VENTANA' && ancho != null && alto != null ? { ancho: Number(ancho), alto: Number(alto) } : vidrioElegido ? { ancho: Number(vidrioElegido.ANCHO), alto: Number(vidrioElegido.ALTO) } : null;
  const textoMedida = (n: number) => String(n).replace('.', ',');
  const cerrarRectificacion = () => {
    setRectificando(false);
    setRectAncho('');
    setRectAlto('');
  };
  const abrirRectificacion = () => {
    if (!medidaOriginal) return;
    setRectAncho(textoMedida(medidaOriginal.ancho));
    setRectAlto(textoMedida(medidaOriginal.alto));
    setRectificando(true);
  };
  const nuevoAncho = leerMilimetros(rectAncho);
  const nuevoAlto = leerMilimetros(rectAlto);
  const rectificacionValida = !!medidaOriginal && nuevoAncho !== null && nuevoAlto !== null && (nuevoAncho !== medidaOriginal.ancho || nuevoAlto !== medidaOriginal.alto);

  const cambiarTipo = (t: TipoElementoPendiente) => {
    setTipo(t);
    setCantidades({});
    setMaterialesSel([]);
    setVidriosSel([]);
    setHojasSel([]);
    setMarcosSel([]);
    cerrarRectificacion();
  };

  const base: DatosSugerencia = { tipo, ventanaModelo: nombreVentana(v) };
  // Un objetivo por cada elemento marcado; sin ninguno sale un solo pendiente del tipo elegido.
  // materialId: el material de catálogo del vidrio o accesorio; con él, Compras ve su código, proveedor y partida.
  // cantidad: cuántas se necesitan, hasta lo que lleva esa línea de la ventana (solo material y vidrio).
  type Objetivo = { datos: DatosSugerencia; cuadroId?: string; materialId?: string | null; cantidad?: number };
  const topeDe = (cantidadLinea: number | string | null | undefined) => topePorVentana(cantidadLinea, ficha.fabricacionVentana?.unidades ?? 1);
  const cantidadDe = (clave: string, tope: number) => Math.min(Math.max(1, cantidades[clave] ?? tope), tope);
  const objetivos: Objetivo[] = (() => {
    if (vidriosElegidos.length > 0)
      return vidriosSel
        .filter((i) => ficha.vidrios[Number(i)])
        .map((i) => {
          const g = ficha.vidrios[Number(i)];
          return { datos: { ...base, vidrio: { codigo: g.codigo_articulo, ancho: g.ANCHO, alto: g.ALTO } }, materialId: g.materialId, cantidad: cantidadDe(`v:${i}`, topeDe(g.UDS)) };
        });
    if (hojasElegidas.length > 0) return hojasElegidas.map((h) => ({ datos: { ...base, hoja: { numero: h.numeroCuadro, ancho: h.anchoMm, alto: h.altoMm } }, cuadroId: h.id }));
    if (marcosElegidos.length > 0) return marcosElegidos.map((m) => ({ datos: { ...base, marco: { numero: m.numeroCuadro, ancho: m.anchoMm, alto: m.altoMm } }, cuadroId: m.id }));
    if (materialesElegidos.length > 0)
      return materialesElegidos.map(({ m, clave }) => ({ datos: { ...base, material: { codigo: m.codigo_articulo, descripcion: m.descripcion_articulo } }, materialId: m.materialId, cantidad: cantidadDe(`m:${clave}`, topeDe(m.cantidad)) }));
    return [{ datos: { ...base } }];
  })();

  const area = areaDelPendiente(tipo, motivo);
  const puedeAgregar = !rectificando || rectificacionValida;

  // La rectificación de una VENTANA la lee la API de la ventana de fabricación: sin lote, solo se puede
  // rectificar un vidrio (que lleva sus medidas originales).
  const puedeRectificar = admiteRectificacion(tipo) && !!medidaOriginal && (tipo === 'VIDRIO' || !!ficha.fabricacionVentana);

  const agregar = () => {
    const preparados: PendientePreparado[] = objetivos.map((o, i) => {
      const titulo = tituloPendiente(o.datos, notas);
      const payload: NuevoPendientePayload = {
        origen: 'OBRA',
        tipo,
        motivo,
        descripcion: titulo,
        notas: notas.trim() || undefined,
        rectificacion:
          rectificando && rectificacionValida && medidaOriginal && objetivos.length === 1
            ? { anchoMm: nuevoAncho!, altoMm: nuevoAlto!, anchoOriginalMm: medidaOriginal.ancho, altoOriginalMm: medidaOriginal.alto }
            : undefined,
        ventanaRef: nombreVentana(v),
        ventanaIndividualizadaId: v.id,
        fabricacionVentanaId: ficha.fabricacionVentana?.id,
        fabricacionCuadroId: o.cuadroId,
        materialId: o.materialId ?? undefined,
        cantidad: o.cantidad,
        fechaRequerida: fechaRequerida || undefined,
      };
      // Con varios elementos marcados las fotos se adjuntan al primero (no se repiten en cada pendiente).
      const cuantas = o.cantidad && (tipo === 'MATERIAL' || o.cantidad > 1) ? ` · ${o.cantidad} un` : '';
      return { payload, resumen: `${titulo}${cuantas}`, archivos: i === 0 ? archivos : [] };
    });
    onAgregar(preparados);
    guardarUltimo(tipo, motivo);
    setCantidades({});
    setMaterialesSel([]);
    setVidriosSel([]);
    setHojasSel([]);
    setMarcosSel([]);
    setNotas('');
    setArchivos([]);
    cerrarRectificacion();
  };

  return (
    <div className="space-y-4" data-testid="formulario-pendiente">
      {/* Dos desplegables lado a lado: la ficha de la ventana y lo que se elige de ella caben en la pantalla sin bajar. */}
      <div className="grid grid-cols-2 gap-3">
        <Select label="Qué falta o falló" id="np-tipo" value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoElementoPendiente)}>
          {TIPOS_PENDIENTE.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
            </option>
          ))}
        </Select>
        <Select label="Motivo" id="np-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoPendiente)}>
          {MOTIVOS_PENDIENTE.map((m) => (
            <option key={m} value={m}>
              {ETIQUETA_MOTIVO[m]}
            </option>
          ))}
        </Select>
      </div>

      {tipo === 'VIDRIO' &&
        (ficha.vidrios.length > 0 ? (
          <div className="space-y-1.5">
            <OpcionesTarjetaMultiple
              legend="Vidrios de esta ventana (marca uno o varios)"
              columnas={2}
              valor={vidriosSel}
              onChange={(ids) => {
                setVidriosSel(ids);
                cerrarRectificacion();
              }}
              opciones={ficha.vidrios.map((g, i) => ({ value: String(i), label: `Vidrio ${i + 1} · ${formatoMm(g.ANCHO)} × ${formatoMm(g.ALTO)} mm`, ayuda: `${g.codigo_articulo} · ${topeDe(g.UDS)} un` }))}
            />
            {ficha.vidrios.length > 1 && (
              <Button type="button" variant="link" size="sm" onClick={() => setVidriosSel(vidriosSel.length === ficha.vidrios.length ? [] : ficha.vidrios.map((_, i) => String(i)))}>
                {vidriosSel.length === ficha.vidrios.length ? 'Quitar todos' : 'Marcar todos'}
              </Button>
            )}
            <CuantasSeNecesitan
              filas={vidriosSel
                .filter((i) => ficha.vidrios[Number(i)] && topeDe(ficha.vidrios[Number(i)].UDS) > 1)
                .map((i) => ({ clave: `v:${i}`, nombre: `Vidrio ${Number(i) + 1} · ${formatoMm(ficha.vidrios[Number(i)].ANCHO)} × ${formatoMm(ficha.vidrios[Number(i)].ALTO)} mm`, tope: topeDe(ficha.vidrios[Number(i)].UDS) }))}
              cantidades={cantidades}
              onChange={setCantidades}
            />
          </div>
        ) : (
          <Aviso tono="neutro" sinIcono>
            {ficha.hetmoError ?? 'Esta ventana no tiene vidrios en su documento de fabricación: descríbelo en las notas.'}
          </Aviso>
        ))}
      {tipo === 'MARCO' &&
        (marcos.length > 0 ? (
          <div className="space-y-1.5">
            <OpcionesTarjetaMultiple
              legend="Marcos de esta ventana (marca uno o varios)"
              columnas={3}
              valor={marcosSel}
              onChange={setMarcosSel}
              opciones={marcos.map((h) => ({ value: h.id, label: `${nombreCuadro(h)} · ${formatoMm(h.anchoMm)} × ${formatoMm(h.altoMm)}`, ayuda: resumenHoja(h.piezas) }))}
            />
            {marcos.length > 1 && (
              <Button type="button" variant="link" size="sm" onClick={() => setMarcosSel(marcosSel.length === marcos.length ? [] : marcos.map((h) => h.id))}>
                {marcosSel.length === marcos.length ? 'Quitar todos' : 'Marcar todos'}
              </Button>
            )}
          </div>
        ) : (
          <Aviso tono="neutro" sinIcono>
            El documento no trae los marcos de esta ventana (aparecen cuando se optimiza el corte). Descríbelo en las notas.
          </Aviso>
        ))}
      {tipo === 'HOJA' &&
        (hojas.length > 0 ? (
          <div className="space-y-1.5">
            <OpcionesTarjetaMultiple
              legend="Hojas de esta ventana (marca una o varias)"
              columnas={3}
              valor={hojasSel}
              onChange={setHojasSel}
              opciones={hojas.map((h) => ({ value: h.id, label: `${nombreCuadro(h)} · ${formatoMm(h.anchoMm)} × ${formatoMm(h.altoMm)}`, ayuda: resumenHoja(h.piezas) }))}
            />
            {hojas.length > 1 && (
              <Button type="button" variant="link" size="sm" onClick={() => setHojasSel(hojasSel.length === hojas.length ? [] : hojas.map((h) => h.id))}>
                {hojasSel.length === hojas.length ? 'Quitar todas' : 'Marcar todas'}
              </Button>
            )}
          </div>
        ) : (
          <Aviso tono="neutro" sinIcono>
            El documento no trae las hojas de esta ventana (aparecen cuando se optimiza el corte). Descríbelo en las notas.
          </Aviso>
        ))}
      {tipo === 'MATERIAL' &&
        (reponibles.length > 0 ? (
          <div className="space-y-1.5">
            <OpcionesTarjetaMultiple
              legend="Accesorios y herrajes de esta ventana (marca uno o varios)"
              columnas={2}
              valor={materialesSel}
              onChange={setMaterialesSel}
              opciones={reponibles.map(({ m, clave }) => ({ value: clave, label: m.descripcion_articulo, ayuda: [m.codigo_articulo, m.familia, `${topeDe(m.cantidad)} un`].filter(Boolean).join(' · ') }))}
            />
            {materialesSel.length > 0 && (
              <Button type="button" variant="link" size="sm" onClick={() => setMaterialesSel([])}>
                Quitar selección ({materialesSel.length})
              </Button>
            )}
            <CuantasSeNecesitan filas={materialesElegidos.map(({ m, clave }) => ({ clave: `m:${clave}`, nombre: m.descripcion_articulo, tope: topeDe(m.cantidad) }))} cantidades={cantidades} onChange={setCantidades} />
          </div>
        ) : (
          <Aviso tono="neutro" sinIcono>
            {ficha.hetmoError ?? 'Esta ventana no tiene accesorios ni herrajes registrados: descríbelo en las notas.'}
          </Aviso>
        ))}
      {tipo === 'VENTANA' && (
        <Aviso tono="neutro" sinIcono>
          Se pide la ventana completa {nombreVentana(v)}: va a Fábrica.
        </Aviso>
      )}

      {puedeRectificar && (
        <div className="space-y-2">
          <Button type="button" size="sm" variant={rectificando ? 'secondary' : 'outline'} leftIcon={<Ruler className="w-3.5 h-3.5" />} onClick={() => (rectificando ? cerrarRectificacion() : abrirRectificacion())}>
            {rectificando ? 'Sin rectificar' : 'Rectificar medidas'}
          </Button>
          {rectificando && medidaOriginal && (
            <div className="rounded-xl border border-brand-200 bg-white p-3 space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Ancho (mm)" id="np-rect-ancho" inputMode="decimal" value={rectAncho} onChange={(e) => setRectAncho(e.target.value)} error={nuevoAncho === null ? 'Medida en mm' : undefined} />
                <Input label="Alto (mm)" id="np-rect-alto" inputMode="decimal" value={rectAlto} onChange={(e) => setRectAlto(e.target.value)} error={nuevoAlto === null ? 'Medida en mm' : undefined} />
              </div>
              <p className="text-[11px] text-slate-500">
                Original: {formatoMm(medidaOriginal.ancho)} × {formatoMm(medidaOriginal.alto)} mm.{' '}
                {rectificacionValida && nuevoAncho !== null && nuevoAlto !== null ? (
                  <span className="text-brand-700 font-bold">
                    {textoRectificacion({ anchoOriginalMm: String(medidaOriginal.ancho), altoOriginalMm: String(medidaOriginal.alto), anchoRectificadoMm: String(nuevoAncho), altoRectificadoMm: String(nuevoAlto) })}
                  </span>
                ) : (
                  <span className="text-amber-700">Cambia al menos una medida.</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}

      <Textarea
        label="Notas (opcional)"
        id="np-notas"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Qué falta o qué falló, cualquier detalle útil"
      />
      <AdjuntosNuevoPendiente proyectoId={proyectoId} archivos={archivos} onChange={setArchivos} />
      {objetivos.length > 1 && archivos.length > 0 && <p className="text-[11px] text-slate-500">Con varios elementos marcados, las fotos se adjuntan al primer pendiente.</p>}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="sm:max-w-[12rem]">
          <Input label="Se necesita para" id="np-fecha" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} />
        </div>
        <div className="text-right space-y-1">
          <p className="text-[11px] text-slate-500">
            Va a <b className="text-slate-700">{ETIQUETA_DESTINO[area]}</b> · {objetivos.length > 1 ? `${objetivos.length} pendientes (uno por cada ${tipo === 'VIDRIO' ? 'vidrio' : tipo === 'HOJA' ? 'hoja' : tipo === 'MARCO' ? 'marco' : 'material'})` : tituloPendiente(objetivos[0].datos, notas)}
          </p>
          <Button type="button" variant="primary" size="lg" leftIcon={<Plus className="w-4 h-4" />} disabled={!puedeAgregar} onClick={agregar}>
            {objetivos.length > 1 ? `Agregar ${objetivos.length} al listado` : 'Agregar al listado'}
          </Button>
        </div>
      </div>
    </div>
  );
};

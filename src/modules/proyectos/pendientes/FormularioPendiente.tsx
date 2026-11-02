import React, { useMemo, useState } from 'react';
import { Plus, Ruler } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea, OpcionesTarjetaMultiple, Casilla } from '../../../components/ui/Campos';
import { Aviso } from '../../../components/ui/Aviso';
import { ETIQUETA_CARGO } from '../../../types';
import type { CargoPendiente, FabricacionPieza, FichaVentanaObra, MotivoPendiente, NuevoPendientePayload, TipoElementoPendiente } from '../../../types';
import { formatoMm } from '../fabricacion/utils';
import { nombreVentana } from '../obra/estadoVentana';
import {
  ETIQUETA_DESTINO,
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  MOTIVOS_PENDIENTE,
  TIPOS_PENDIENTE,
  admiteRectificacion,
  areaDelPendiente,
  cargoDeMotivo,
  etiquetaPieza,
  exigeResponsable,
  leerMilimetros,
  nombreCuadro,
  nombrePosicionPieza,
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

export interface PendientePreparado {
  payload: NuevoPendientePayload;
  /** Resumen corto para el carrito: "Vidrio 4/9/4 · 1.032 × 1.554 mm". */
  resumen: string;
}

interface Props {
  ficha: FichaVentanaObra;
  /** Un pendiente por cada vidrio u hoja marcados. */
  onAgregar: (p: PendientePreparado[]) => void;
}

/**
 * Detalle de UN pendiente para la ventana elegida (página Nuevos pendientes). Lo que se elige
 * (hoja, vidrio o material) sale de la ficha de la ventana; el título lo arma el sistema. Al
 * agregar se limpia para el siguiente, sin cerrar nada.
 */
export const FormularioPendiente: React.FC<Props> = ({ ficha, onAgregar }) => {
  const v = ficha.ventana;
  const [tipo, setTipo] = useState<TipoElementoPendiente>('VIDRIO');
  const [motivo, setMotivo] = useState<MotivoPendiente>('FALLA');
  // Material: una sola opción. Vidrios (posición en la lista) y hojas (id): se pueden marcar varios y sale un pendiente por cada uno.
  const [materialesSel, setMaterialesSel] = useState<string[]>([]);
  const [vidriosSel, setVidriosSel] = useState<string[]>([]);
  const [hojasSel, setHojasSel] = useState<string[]>([]);
  const [notas, setNotas] = useState('');
  const [responsable, setResponsable] = useState('');
  const [cargo, setCargo] = useState<CargoPendiente | ''>('');
  const [rectificando, setRectificando] = useState(false);
  const [rectAncho, setRectAncho] = useState('');
  const [rectAlto, setRectAlto] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState('');

  const hojas = useMemo(() => ficha.cuadros.filter((c) => c.tipo === 'HOJA'), [ficha.cuadros]);
  // Piezas cortadas agrupadas por cuadro (y las sueltas), para elegir un perfil puntual como material.
  const gruposPiezas = useMemo(() => {
    const grupos: { clave: string; nombre: string; piezas: FabricacionPieza[] }[] = ficha.cuadros.filter((c) => c.piezas.length > 0).map((c) => ({ clave: c.id, nombre: `${nombreCuadro(c)} · ${formatoMm(c.anchoMm)} × ${formatoMm(c.altoMm)} mm`, piezas: c.piezas }));
    if (ficha.piezasSueltas.length > 0) grupos.push({ clave: 'sueltas', nombre: 'Piezas sueltas de la ventana', piezas: ficha.piezasSueltas });
    return grupos;
  }, [ficha.cuadros, ficha.piezasSueltas]);
  const hayPiezas = gruposPiezas.length > 0;
  const vidriosElegidos = tipo === 'VIDRIO' ? vidriosSel.map((i) => ficha.vidrios[Number(i)]).filter(Boolean) : [];
  const hojasElegidas = tipo === 'HOJA' ? hojas.filter((h) => hojasSel.includes(h.id)) : [];
  // La rectificación solo aplica con un único vidrio marcado.
  const vidrioElegido = vidriosElegidos.length === 1 ? vidriosElegidos[0] : undefined;
  // Materiales marcados: una pieza cortada ("pieza:<id>") o una fila de la receta ("receta:<índice>").
  const todasPiezas = useMemo(() => gruposPiezas.flatMap((g) => g.piezas), [gruposPiezas]);
  const materialesElegidos = tipo === 'MATERIAL' ? materialesSel : [];
  const alternarMaterial = (clave: string) => setMaterialesSel((m) => (m.includes(clave) ? m.filter((x) => x !== clave) : [...m, clave]));

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
    setMaterialesSel([]);
    setVidriosSel([]);
    setHojasSel([]);
    cerrarRectificacion();
  };

  const base: DatosSugerencia = { tipo, ventanaModelo: nombreVentana(v) };
  // Un objetivo por cada vidrio u hoja marcados; sin ninguno (o con otro tipo) sale un solo pendiente.
  type Objetivo = { datos: DatosSugerencia; cuadroId?: string; piezaId?: string; materialId?: string; vidrio?: boolean };
  const objetivos: Objetivo[] = (() => {
    if (vidriosElegidos.length > 0) return vidriosElegidos.map((g) => ({ datos: { ...base, vidrio: { codigo: g.codigo_articulo, ancho: g.ANCHO, alto: g.ALTO } }, vidrio: true }));
    if (hojasElegidas.length > 0) return hojasElegidas.map((h) => ({ datos: { ...base, hoja: { numero: h.numeroCuadro, ancho: h.anchoMm, alto: h.altoMm } }, cuadroId: h.id }));
    if (materialesElegidos.length > 0) {
      return materialesElegidos.map((clave): Objetivo => {
        if (clave.startsWith('pieza:')) {
          const pieza = todasPiezas.find((p) => p.id === clave.slice(6));
          const cuadro = pieza ? ficha.cuadros.find((c) => c.id === pieza.cuadroId) : undefined;
          return { datos: { ...base, ...(pieza ? { pieza: { ...pieza, cuadro: cuadro ? nombreCuadro(cuadro) : null } } : {}) }, cuadroId: pieza?.cuadroId ?? undefined, piezaId: pieza?.id, materialId: pieza?.materialId ?? undefined };
        }
        const m = ficha.materiales[Number(clave.slice(7))];
        return { datos: { ...base, ...(m ? { material: { codigo: m.codigo_articulo, descripcion: m.descripcion_articulo } } : {}) } };
      });
    }
    return [{ datos: { ...base } }];
  })();

  const area = areaDelPendiente(tipo, motivo);
  const pideResponsable = exigeResponsable(motivo);
  const notasObligatorias = tipo === 'OTRO';
  const puedeAgregar = (!notasObligatorias || !!notas.trim()) && (!pideResponsable || !!responsable.trim()) && (!rectificando || rectificacionValida);

  // La rectificación de una VENTANA la lee la API de la ventana de fabricación: sin lote, solo se puede
  // rectificar un vidrio (que lleva sus medidas originales).
  const puedeRectificar = admiteRectificacion(tipo) && !!medidaOriginal && (tipo === 'VIDRIO' || !!ficha.fabricacionVentana);

  const agregar = () => {
    const preparados: PendientePreparado[] = objetivos.map((o) => {
      const titulo = tituloPendiente(o.datos, notas);
      const payload: NuevoPendientePayload = {
        origen: 'OBRA',
        tipo,
        motivo,
        descripcion: titulo,
        notas: notas.trim() || undefined,
        responsable: pideResponsable ? responsable.trim() : undefined,
        cargoA: cargo || undefined,
        rectificacion:
          rectificando && rectificacionValida && medidaOriginal && objetivos.length === 1
            ? { anchoMm: nuevoAncho!, altoMm: nuevoAlto!, anchoOriginalMm: medidaOriginal.ancho, altoOriginalMm: medidaOriginal.alto }
            : undefined,
        ventanaRef: nombreVentana(v),
        ventanaIndividualizadaId: v.id,
        fabricacionVentanaId: ficha.fabricacionVentana?.id,
        fabricacionCuadroId: o.cuadroId,
        fabricacionPiezaId: o.piezaId,
        materialId: o.materialId,
        fechaRequerida: fechaRequerida || undefined,
      };
      return { payload, resumen: titulo };
    });
    onAgregar(preparados);
    setMaterialesSel([]);
    setVidriosSel([]);
    setHojasSel([]);
    setNotas('');
    cerrarRectificacion();
  };

  return (
    <div className="space-y-3" data-testid="formulario-pendiente">
      <div className="grid sm:grid-cols-3 gap-3">
        <Select label="Qué falta" id="np-tipo" value={tipo} onChange={(e) => cambiarTipo(e.target.value as TipoElementoPendiente)}>
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
        <Select label="A cargo de" id="np-cargo" value={cargo} onChange={(e) => setCargo(e.target.value as CargoPendiente | '')}>
          <option value="">Según el motivo ({cargoDeMotivo(motivo) ? ETIQUETA_CARGO[cargoDeMotivo(motivo)!] : 'sin cargo aparte'})</option>
          {(['CLIENTE', 'INSTALADOR', 'MTW'] as CargoPendiente[]).map((c) => (
            <option key={c} value={c}>
              {ETIQUETA_CARGO[c]}
            </option>
          ))}
        </Select>
      </div>
      {pideResponsable && (
        <Input label="Responsable del daño" id="np-responsable" value={responsable} onChange={(e) => setResponsable(e.target.value)} maxLength={200} placeholder="Quién causó el daño" error={responsable.trim() ? undefined : 'Indica el responsable.'} />
      )}

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
              opciones={ficha.vidrios.map((g, i) => ({ value: String(i), label: `Vidrio ${i + 1} · ${formatoMm(g.ANCHO)} × ${formatoMm(g.ALTO)} mm`, ayuda: `${g.codigo_articulo} · ${g.UDS} un` }))}
            />
            {ficha.vidrios.length > 1 && (
              <Button type="button" variant="link" size="sm" onClick={() => setVidriosSel(vidriosSel.length === ficha.vidrios.length ? [] : ficha.vidrios.map((_, i) => String(i)))}>
                {vidriosSel.length === ficha.vidrios.length ? 'Quitar todos' : 'Marcar todos'}
              </Button>
            )}
          </div>
        ) : (
          <Aviso tono="neutro" sinIcono>
            {ficha.hetmoError ?? 'Esta ventana no tiene vidrios en su documento de fabricación: descríbelo en las notas.'}
          </Aviso>
        ))}
      {tipo === 'HOJA' &&
        (hojas.length > 0 ? (
          <div className="space-y-2">
            <OpcionesTarjetaMultiple
              legend="Hojas de esta ventana (marca una o varias)"
              columnas={3}
              valor={hojasSel}
              onChange={setHojasSel}
              opciones={hojas.map((h) => ({ value: h.id, label: `Hoja ${h.numeroCuadro} · ${formatoMm(h.anchoMm)} × ${formatoMm(h.altoMm)}`, ayuda: resumenHoja(h.piezas) }))}
            />
            {hojas.length > 1 && (
              <Button type="button" variant="link" size="sm" onClick={() => setHojasSel(hojasSel.length === hojas.length ? [] : hojas.map((h) => h.id))}>
                {hojasSel.length === hojas.length ? 'Quitar todas' : 'Marcar todas'}
              </Button>
            )}
            {hojasElegidas.some((h) => h.piezas.length > 0) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 divide-y divide-slate-100">
                {hojasElegidas.map((h) => (
                  <div key={h.id} className="px-3 py-2">
                    <p className="text-[11px] font-bold text-slate-700">{nombreCuadro(h)} · perfiles</p>
                    <ul className="mt-1 grid sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-slate-600">
                      {h.piezas.map((p) => (
                        <li key={p.id} className="truncate" title={etiquetaPieza(p, true)}>
                          {nombrePosicionPieza(p.posicion)} · <span className="font-mono">{p.codigoArticulo}</span> · {formatoMm(p.longitudMm)} mm
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Aviso tono="neutro" sinIcono>
            El documento no trae las hojas de esta ventana (aparecen cuando se optimiza el corte). Descríbela en las notas.
          </Aviso>
        ))}
      {tipo === 'MATERIAL' &&
        (ficha.materiales.length > 0 || hayPiezas ? (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Materiales de esta ventana (marca uno o varios)</p>
            <div className="rounded-xl border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100" role="group" aria-label="Materiales de esta ventana">
              {gruposPiezas.map((g) => (
                <div key={g.clave} className="px-3 py-2 space-y-1">
                  <p className="text-[11px] font-bold text-slate-600">{g.nombre}</p>
                  {g.piezas.map((p) => (
                    <div key={p.id}>
                      <Casilla checked={materialesSel.includes(`pieza:${p.id}`)} onChange={() => alternarMaterial(`pieza:${p.id}`)} label={<span className="font-normal text-slate-700">{etiquetaPieza(p, true)}</span>} />
                    </div>
                  ))}
                </div>
              ))}
              {ficha.materiales.length > 0 && (
                <div className="px-3 py-2 space-y-1">
                  <p className="text-[11px] font-bold text-slate-600">{hayPiezas ? 'Otros materiales de la ventana' : 'Materiales de la ventana'}</p>
                  {ficha.materiales.map((m, i) => (
                    <div key={`${m.codigo_articulo}-${i}`}>
                      <Casilla
                        checked={materialesSel.includes(`receta:${i}`)}
                        onChange={() => alternarMaterial(`receta:${i}`)}
                        label={
                          <span className="font-normal text-slate-700">
                            {m.familia ? `${m.familia} · ` : ''}
                            {m.descripcion_articulo} ({m.codigo_articulo})
                          </span>
                        }
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            {materialesSel.length > 0 && (
              <Button type="button" variant="link" size="sm" onClick={() => setMaterialesSel([])}>
                Quitar selección ({materialesSel.length})
              </Button>
            )}
            {hayPiezas && <p className="text-[11px] text-slate-500">Las piezas cortadas vienen con su largo y su posición en el marco o la hoja; úsalas cuando falta o falló un perfil puntual.</p>}
          </div>
        ) : (
          <Aviso tono="neutro" sinIcono>
            {ficha.hetmoError ?? 'No hay materiales de esta ventana para elegir: descríbelo en las notas.'}
          </Aviso>
        ))}

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
        label={notasObligatorias ? 'Notas (obligatorias para "Otro")' : 'Notas (opcional)'}
        id="np-notas"
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Qué falta o qué falló, cualquier detalle útil"
        error={notasObligatorias && !notas.trim() ? 'Describe qué se necesita.' : undefined}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="sm:max-w-[12rem]">
          <Input label="Se necesita para" id="np-fecha" type="date" value={fechaRequerida} onChange={(e) => setFechaRequerida(e.target.value)} />
        </div>
        <div className="text-right space-y-1">
          <p className="text-[11px] text-slate-500">
            Va a <b className="text-slate-700">{ETIQUETA_DESTINO[area]}</b> · {objetivos.length > 1 ? `${objetivos.length} pendientes (uno por cada ${tipo === 'VIDRIO' ? 'vidrio' : tipo === 'HOJA' ? 'hoja' : 'material'})` : tituloPendiente(objetivos[0].datos, notas)}
          </p>
          <Button type="button" variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} disabled={!puedeAgregar} onClick={agregar}>
            {objetivos.length > 1 ? `Agregar ${objetivos.length} al listado` : 'Agregar al listado'}
          </Button>
        </div>
      </div>
    </div>
  );
};

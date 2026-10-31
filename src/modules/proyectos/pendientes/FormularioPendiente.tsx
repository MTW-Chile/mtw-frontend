import React, { useMemo, useState } from 'react';
import { Plus, Ruler } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Textarea, OpcionesTarjeta, SelectCompacto } from '../../../components/ui/Campos';
import { Aviso } from '../../../components/ui/Aviso';
import { ETIQUETA_CARGO } from '../../../types';
import type { CargoPendiente, FichaVentanaObra, MotivoPendiente, NuevoPendientePayload, TipoElementoPendiente } from '../../../types';
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
  exigeResponsable,
  leerMilimetros,
  textoRectificacion,
  tituloPendiente,
  type DatosSugerencia,
} from './utils';

export interface PendientePreparado {
  payload: NuevoPendientePayload;
  /** Resumen corto para el carrito: "Vidrio 4/9/4 · 1.032 × 1.554 mm". */
  resumen: string;
}

interface Props {
  ficha: FichaVentanaObra;
  onAgregar: (p: PendientePreparado) => void;
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
  const [elementoId, setElementoId] = useState('');
  const [notas, setNotas] = useState('');
  const [responsable, setResponsable] = useState('');
  const [cargo, setCargo] = useState<CargoPendiente | ''>('');
  const [rectificando, setRectificando] = useState(false);
  const [rectAncho, setRectAncho] = useState('');
  const [rectAlto, setRectAlto] = useState('');
  const [fechaRequerida, setFechaRequerida] = useState('');

  const hojas = useMemo(() => ficha.cuadros.filter((c) => c.tipo === 'HOJA'), [ficha.cuadros]);
  const vidrioElegido = tipo === 'VIDRIO' && elementoId ? ficha.vidrios.find((x) => String(x.material_hetmo) === elementoId) : undefined;
  const hojaElegida = tipo === 'HOJA' && elementoId ? hojas.find((x) => x.id === elementoId) : undefined;
  const materialElegido = tipo === 'MATERIAL' && elementoId ? ficha.materiales[Number(elementoId)] : undefined;

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
    setElementoId('');
    cerrarRectificacion();
  };

  const datosTitulo: DatosSugerencia = { tipo, ventanaModelo: nombreVentana(v) };
  if (vidrioElegido) datosTitulo.vidrio = { codigo: vidrioElegido.codigo_articulo, ancho: vidrioElegido.ANCHO, alto: vidrioElegido.ALTO };
  if (hojaElegida) datosTitulo.hoja = { numero: hojaElegida.numeroCuadro, ancho: hojaElegida.anchoMm, alto: hojaElegida.altoMm };
  if (materialElegido) datosTitulo.material = { codigo: materialElegido.codigo_articulo, descripcion: materialElegido.descripcion_articulo };

  const area = areaDelPendiente(tipo, motivo);
  const pideResponsable = exigeResponsable(motivo);
  const notasObligatorias = tipo === 'OTRO';
  const puedeAgregar = (!notasObligatorias || !!notas.trim()) && (!pideResponsable || !!responsable.trim()) && (!rectificando || rectificacionValida);

  // La rectificación de una VENTANA la lee la API de la ventana de fabricación: sin lote, solo se puede
  // rectificar un vidrio (que lleva sus medidas originales).
  const puedeRectificar = admiteRectificacion(tipo) && !!medidaOriginal && (tipo === 'VIDRIO' || !!ficha.fabricacionVentana);

  const agregar = () => {
    const titulo = tituloPendiente(datosTitulo, notas);
    const payload: NuevoPendientePayload = {
      origen: 'OBRA',
      tipo,
      motivo,
      descripcion: titulo,
      notas: notas.trim() || undefined,
      responsable: pideResponsable ? responsable.trim() : undefined,
      cargoA: cargo || undefined,
      rectificacion:
        rectificando && rectificacionValida && medidaOriginal
          ? { anchoMm: nuevoAncho!, altoMm: nuevoAlto!, anchoOriginalMm: medidaOriginal.ancho, altoOriginalMm: medidaOriginal.alto }
          : undefined,
      ventanaRef: nombreVentana(v),
      ventanaIndividualizadaId: v.id,
      fabricacionVentanaId: ficha.fabricacionVentana?.id,
      fabricacionCuadroId: hojaElegida?.id,
      fechaRequerida: fechaRequerida || undefined,
    };
    onAgregar({ payload, resumen: titulo });
    setElementoId('');
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
          <OpcionesTarjeta
            legend="Vidrio de esta ventana"
            columnas={2}
            valor={elementoId}
            onChange={(id) => {
              setElementoId(id);
              cerrarRectificacion();
            }}
            opciones={ficha.vidrios.map((g) => ({ value: String(g.material_hetmo), label: `${formatoMm(g.ANCHO)} × ${formatoMm(g.ALTO)} mm`, ayuda: `${g.codigo_articulo} · ${g.UDS} un` }))}
          />
        ) : (
          <Aviso tono="neutro" sinIcono>
            {ficha.hetmoError ?? 'Esta ventana no tiene vidrios en su documento de fabricación: descríbelo en las notas.'}
          </Aviso>
        ))}
      {tipo === 'HOJA' &&
        (hojas.length > 0 ? (
          <SelectCompacto value={elementoId} onChange={(e) => setElementoId(e.target.value)} aria-label="Hoja de esta ventana">
            <option value="">— elegir hoja —</option>
            {hojas.map((h) => (
              <option key={h.id} value={h.id}>
                Hoja {h.numeroCuadro} · {formatoMm(h.anchoMm)} × {formatoMm(h.altoMm)} mm
              </option>
            ))}
          </SelectCompacto>
        ) : (
          <Aviso tono="neutro" sinIcono>
            El documento no trae las hojas de esta ventana (aparecen cuando se optimiza el corte). Descríbela en las notas.
          </Aviso>
        ))}
      {tipo === 'MATERIAL' &&
        (ficha.materiales.length > 0 ? (
          <SelectCompacto value={elementoId} onChange={(e) => setElementoId(e.target.value)} aria-label="Material de esta ventana">
            <option value="">— elegir material —</option>
            {ficha.materiales.map((m, i) => (
              <option key={`${m.codigo_articulo}-${i}`} value={String(i)}>
                {m.familia ? `${m.familia} · ` : ''}
                {m.descripcion_articulo} ({m.codigo_articulo})
              </option>
            ))}
          </SelectCompacto>
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
            Va a <b className="text-slate-700">{ETIQUETA_DESTINO[area]}</b> · {tituloPendiente(datosTitulo, notas)}
          </p>
          <Button type="button" variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} disabled={!puedeAgregar} onClick={agregar}>
            Agregar al listado
          </Button>
        </div>
      </div>
    </div>
  );
};

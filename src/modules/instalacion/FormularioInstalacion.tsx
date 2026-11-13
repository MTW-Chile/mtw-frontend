import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, ImageIcon, Plus, X } from 'lucide-react';
import { getOneDriveObra } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Aviso } from '../../components/ui/Aviso';
import { Casilla, OpcionesTarjeta, Textarea } from '../../components/ui/Campos';
import { IconButton } from '../../components/ui/IconButton';
import type { ParteVentana, VentanaObra } from '../../types';
import { BotonesAdjuntar } from '../proyectos/pendientes/adjuntos/BotonesAdjuntar';
import { esImagen, formatoTamano, mimeDeArchivo } from '../proyectos/pendientes/adjuntos/utils';
import { ETIQUETA_ESTADO_VENTANA, nombreVentana } from '../proyectos/obra/estadoVentana';

export interface InstalacionPreparada {
  ventana: VentanaObra;
  parte: ParteVentana;
  notas: string | null;
  forzar: boolean;
  fotos: File[];
  /** Texto corto para el listado: "Ventana completa". */
  resumen: string;
}

export const TEXTO_PARTE: Record<ParteVentana, string> = { COMPLETA: 'Ventana completa', MARCO: 'Solo el marco', HOJA: 'Solo la hoja' };
/** Lo mismo para UNA ventana: en una fija la segunda parte es su vidrio. */
export const textoParteDe = (v: Pick<VentanaObra, 'esFija'>, p: ParteVentana): string => (p === 'HOJA' && v.esFija ? 'Solo el vidrio' : TEXTO_PARTE[p]);
/** Al certificar varias a la vez. */
const TEXTO_PARTE_LOTE: Record<ParteVentana, string> = { COMPLETA: 'Ventanas completas', MARCO: 'Solo los marcos', HOJA: 'Solo las hojas o vidrios' };
const PARTES: ParteVentana[] = ['COMPLETA', 'MARCO', 'HOJA'];
/** Estado de una parte de la ventana (el marco, la hoja o vidrio, o la ventana entera). */
export const estadoDeParte = (v: VentanaObra, p: ParteVentana) => (p === 'MARCO' ? v.estadoPartes.marco : p === 'HOJA' ? v.estadoPartes.hoja : v.estado);

/** Partes que todavía se pueden certificar (las ya certificadas o las que ya están en el listado quedan fuera). */
export function partesPorInstalar(ventana: VentanaObra, enListado: ParteVentana[] = []): ParteVentana[] {
  return (['COMPLETA', 'MARCO', 'HOJA'] as ParteVentana[]).filter((p) => {
    if (enListado.includes(p) || (p === 'COMPLETA' && enListado.length > 0) || (p !== 'COMPLETA' && enListado.includes('COMPLETA'))) return false;
    if (ventana.instalaciones.some((i) => i.parte === 'COMPLETA' || i.parte === p)) return false;
    if (p === 'COMPLETA') return ventana.instalaciones.length === 0;
    return ventana.admiteSeparacion;
  });
}

/**
 * Certificar la instalación de las ventanas elegidas, en la misma página. Con una sola se elige qué quedó instalado
 * (completa, marco u hoja); con varias se elige lo mismo para todas (completas, solo los marcos o solo las hojas o
 * vidrios: en obra se instalan los marcos de un piso y después sus hojas), con las mismas notas, pero cada ventana
 * lleva su propia foto (la foto es lo que certifica ESA ventana). Al agregar quedan en el listado; se certifican todas al enviarlo.
 */
export const FormularioInstalacion: React.FC<{
  proyectoId: string;
  ventanas: VentanaObra[];
  /** Partes de esa ventana que ya están en el listado. */
  enListado: (ventanaId: string) => ParteVentana[];
  onAgregar: (p: InstalacionPreparada[]) => void;
}> = ({ proyectoId, ventanas, enListado, onAgregar }) => {
  const unica = ventanas.length === 1 ? ventanas[0] : null;
  const partes = unica ? partesPorInstalar(unica, enListado(unica.id)) : [];
  const estadoDe = estadoDeParte;
  const [parte, setParte] = useState<ParteVentana | null>(null);
  // En lote se elige la parte para todas; entran las que todavía pueden certificar ESA parte.
  const aptasPor = (p: ParteVentana) => ventanas.filter((v) => partesPorInstalar(v, enListado(v.id)).includes(p));
  const recibidasPor = (p: ParteVentana) => aptasPor(p).filter((v) => estadoDe(v, p) === 'RECIBIDA').length;
  const partesLote = unica ? [] : PARTES.filter((p) => aptasPor(p).length > 0);
  // Por defecto, lo que está recibido en obra y espera instalación: primero la ventana entera, si no el marco o la hoja.
  const sugerida = (opciones: ParteVentana[], recibida: (p: ParteVentana) => boolean) => opciones.find((p) => p === 'COMPLETA' && recibida(p)) ?? opciones.find((p) => p !== 'COMPLETA' && recibida(p)) ?? opciones[0];
  const parteActual: ParteVentana = unica
    ? (parte && partes.includes(parte) ? parte : sugerida(partes, (p) => estadoDe(unica, p) === 'RECIBIDA')) ?? 'COMPLETA'
    : (parte && partesLote.includes(parte) ? parte : sugerida(partesLote, (p) => recibidasPor(p) > 0)) ?? 'COMPLETA';
  const aptas = unica ? (partes.length > 0 ? [unica] : []) : aptasPor(parteActual);
  const fuera = ventanas.length - aptas.length;
  const [notas, setNotas] = useState('');
  // Fotos por ventana (id): cada una certifica la suya.
  const [fotos, setFotos] = useState<Record<string, File[]>>({});
  const fotosDe = (id: string) => fotos[id] ?? [];
  const agregarFotos = (id: string, nuevas: File[]) => setFotos((f) => ({ ...f, [id]: [...(f[id] ?? []), ...nuevas] }));
  const quitarFoto = (id: string, i: number) => setFotos((f) => ({ ...f, [id]: (f[id] ?? []).filter((_, j) => j !== i) }));
  const [forzar, setForzar] = useState(false);

  const { data: onedrive } = useQuery({ queryKey: ['onedrive', proyectoId], queryFn: () => getOneDriveObra(proyectoId), staleTime: 1000 * 60 });
  const puedeSubir = !!onedrive?.configurado && !onedrive.requiereReconexion && !!onedrive.carpeta;
  const sinRecepcion = aptas.filter((v) => estadoDe(v, parteActual) !== 'RECIBIDA');
  // La foto es obligatoria cuando OneDrive está disponible; si no, se avisa y se deja certificar igual.
  const sinFoto = puedeSubir ? aptas.filter((v) => fotosDe(v.id).length === 0) : [];
  const faltaFoto = sinFoto.length > 0;
  const puedeAgregar = aptas.length > 0 && !faltaFoto && (sinRecepcion.length === 0 || forzar);

  if (aptas.length === 0) {
    if (!unica) return <Aviso tono="advertencia">Ninguna de las ventanas elegidas tiene algo por certificar: ya están instaladas o en el listado.</Aviso>;
    return <Aviso tono="exito">{enListado(unica.id).length > 0 ? 'Esta ventana ya está en el listado para certificar.' : 'Esta ventana ya está certificada como instalada.'}</Aviso>;
  }

  const agregar = () => {
    onAgregar(aptas.map((ventana) => ({ ventana, parte: parteActual, notas: notas.trim() || null, forzar: forzar && estadoDe(ventana, parteActual) !== 'RECIBIDA', fotos: fotosDe(ventana.id), resumen: `${nombreVentana(ventana)} · ${textoParteDe(ventana, parteActual)}` })));
    setNotas('');
    setFotos({});
    setForzar(false);
    setParte(null);
  };

  return (
    <div className="space-y-4" data-testid="formulario-instalacion">
      {unica && partes.length > 1 && (
        <OpcionesTarjeta
          legend="Qué quedó instalado"
          columnas={partes.length === 3 ? 3 : 2}
          valor={parteActual}
          onChange={setParte}
          opciones={partes.map((p) => ({ value: p, label: textoParteDe(unica, p), ayuda: ETIQUETA_ESTADO_VENTANA[estadoDe(unica, p)] }))}
        />
      )}
      {!unica && partesLote.length > 1 && (
        <OpcionesTarjeta
          legend="Qué quedó instalado en todas"
          columnas={partesLote.length === 3 ? 3 : 2}
          valor={parteActual}
          onChange={setParte}
          opciones={partesLote.map((p) => ({ value: p, label: TEXTO_PARTE_LOTE[p], ayuda: `${aptasPor(p).length} de ${ventanas.length} · ${recibidasPor(p)} recibidas en obra` }))}
        />
      )}

      {fuera > 0 && (
        <Aviso tono="info" sinIcono>
          {fuera} de las elegidas no entran en este lote: ya tienen {parteActual === 'COMPLETA' ? 'algo certificado' : parteActual === 'MARCO' ? 'el marco certificado' : 'la hoja o el vidrio certificado'} o están en el listado. Se certifican las otras {aptas.length}.
        </Aviso>
      )}

      {sinRecepcion.length > 0 && (
        <Aviso
          tono="advertencia"
          titulo={unica ? `Todavía no figura recibida en obra (${ETIQUETA_ESTADO_VENTANA[estadoDe(unica, parteActual)].toLowerCase()})` : `${sinRecepcion.length} de ${aptas.length} todavía no figuran recibidas en obra`}
        >
          <Casilla checked={forzar} onChange={setForzar} label={unica ? 'Certificar igual: la ventana está instalada' : 'Certificar igual: están instaladas'} />
        </Aviso>
      )}

      <div className="space-y-2">
        <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          {aptas.length > 1 ? `Una foto por ventana (${aptas.length - sinFoto.length} de ${aptas.length})` : 'Foto de la instalación'} {puedeSubir ? '' : '(OneDrive no disponible)'}
        </span>
        {!onedrive?.configurado ? (
          <p className="text-xs text-slate-500">OneDrive no está conectado: se registra la instalación sin foto.</p>
        ) : onedrive.requiereReconexion ? (
          <p className="text-xs text-amber-800">La conexión con OneDrive venció: un administrador debe reconectarla. Se registra sin foto.</p>
        ) : !onedrive.carpeta ? (
          <p className="text-xs text-amber-800">Esta obra no tiene carpeta de OneDrive vinculada (Obras › Información General). Se registra sin foto.</p>
        ) : (
          <ul className={aptas.length > 1 ? 'rounded-xl border border-slate-200 divide-y divide-slate-100' : ''}>
            {aptas.map((v) => {
              const suyas = fotosDe(v.id);
              return (
                <li key={v.id} className={`space-y-2 ${aptas.length > 1 ? 'p-3' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {aptas.length > 1 && (
                      <p className="min-w-0 text-sm font-bold font-mono text-slate-900">
                        {nombreVentana(v)}
                        <span className={`ml-2 font-sans text-xs font-semibold ${suyas.length ? 'text-emerald-700' : 'text-amber-700'}`}>{suyas.length ? `${suyas.length} foto(s)` : 'falta la foto'}</span>
                      </p>
                    )}
                    <BotonesAdjuntar tamano={aptas.length > 1 ? 'md' : 'lg'} onArchivos={(nuevas) => agregarFotos(v.id, nuevas)} />
                  </div>
                  {suyas.length === 0 ? (
                    aptas.length === 1 && (
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Camera className="w-3.5 h-3.5" /> La foto es obligatoria para certificar.
                      </p>
                    )
                  ) : (
                    <ul className="space-y-1">
                      {suyas.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
                          <ImageIcon className={`w-3.5 h-3.5 shrink-0 ${esImagen(mimeDeArchivo(f.name, f.type)) ? 'text-emerald-600' : 'text-slate-500'}`} />
                          <span className="flex-1 min-w-0 truncate text-slate-800">{f.name}</span>
                          <span className="text-slate-500 shrink-0">{formatoTamano(f.size)}</span>
                          <IconButton icono={X} etiqueta={`Quitar ${f.name}`} tono="peligro" onClick={() => quitarFoto(v.id, i)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Textarea label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={1000} placeholder="Sellos, terminaciones, observaciones…" />

      <div className="flex flex-wrap items-center justify-end gap-3">
        {aptas.length > 1 && faltaFoto && <span className="text-xs font-semibold text-amber-700">Falta la foto de {sinFoto.length} ventana(s): tómala o saca la ventana de la selección.</span>}
        <Button type="button" variant="primary" size="lg" leftIcon={<Plus className="w-4 h-4" />} disabled={!puedeAgregar} onClick={agregar} className="max-sm:w-full">
          {aptas.length > 1 ? `Agregar ${aptas.length} al listado` : 'Agregar al listado'}
        </Button>
      </div>
    </div>
  );
};

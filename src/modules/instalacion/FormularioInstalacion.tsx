import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, ImageIcon, X } from 'lucide-react';
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
 * Certificar la instalación de la ventana elegida, en la misma página (sin ventana emergente): qué quedó
 * instalado, la foto (a la carpeta de OneDrive de la obra) y notas. Al agregar queda en el listado; se
 * certifican todas al enviarlo.
 */
export const FormularioInstalacion: React.FC<{ proyectoId: string; ventana: VentanaObra; enListado: ParteVentana[]; onAgregar: (p: InstalacionPreparada) => void }> = ({ proyectoId, ventana, enListado, onAgregar }) => {
  const partes = partesPorInstalar(ventana, enListado);
  const estadoDe = (p: ParteVentana) => ventana.partes.find((x) => x.parte === p)?.estado ?? ventana.estado;
  const [parte, setParte] = useState<ParteVentana | null>(null);
  const parteActual: ParteVentana = parte && partes.includes(parte) ? parte : (ventana.separada ? partes.find((p) => p !== 'COMPLETA') ?? partes[0] : partes[0]) ?? 'COMPLETA';
  const [notas, setNotas] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [forzar, setForzar] = useState(false);

  const { data: onedrive } = useQuery({ queryKey: ['onedrive', proyectoId], queryFn: () => getOneDriveObra(proyectoId), staleTime: 1000 * 60 });
  const puedeSubir = !!onedrive?.configurado && !onedrive.requiereReconexion && !!onedrive.carpeta;
  const sinRecepcion = estadoDe(parteActual) !== 'RECIBIDA';
  // La foto es obligatoria cuando OneDrive está disponible; si no, se avisa y se deja certificar igual.
  const faltaFoto = puedeSubir && fotos.length === 0;
  const puedeAgregar = partes.length > 0 && !faltaFoto && (!sinRecepcion || forzar);

  if (partes.length === 0) {
    return <Aviso tono="exito">{enListado.length > 0 ? 'Esta ventana ya está en el listado para certificar.' : 'Esta ventana ya está certificada como instalada.'}</Aviso>;
  }

  const agregar = () => {
    onAgregar({ ventana, parte: parteActual, notas: notas.trim() || null, forzar, fotos, resumen: `${nombreVentana(ventana)} · ${TEXTO_PARTE[parteActual]}` });
    setNotas('');
    setFotos([]);
    setForzar(false);
    setParte(null);
  };

  return (
    <div className="space-y-3" data-testid="formulario-instalacion">
      {partes.length > 1 && (
        <OpcionesTarjeta
          legend="Qué quedó instalado"
          columnas={partes.length === 3 ? 3 : 2}
          valor={parteActual}
          onChange={setParte}
          opciones={partes.map((p) => ({ value: p, label: TEXTO_PARTE[p], ayuda: ETIQUETA_ESTADO_VENTANA[estadoDe(p)] }))}
        />
      )}

      {sinRecepcion && (
        <Aviso tono="advertencia" titulo={`Todavía no figura recibida en obra (${ETIQUETA_ESTADO_VENTANA[estadoDe(parteActual)].toLowerCase()})`}>
          <Casilla checked={forzar} onChange={setForzar} label="Certificar igual: la ventana está instalada" />
        </Aviso>
      )}

      <div className="space-y-2">
        <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Foto de la instalación {puedeSubir ? '' : '(OneDrive no disponible)'}</span>
        {!onedrive?.configurado ? (
          <p className="text-[11px] text-slate-500">OneDrive no está conectado: se registra la instalación sin foto.</p>
        ) : onedrive.requiereReconexion ? (
          <p className="text-[11px] text-amber-800">La conexión con OneDrive venció: un administrador debe reconectarla. Se registra sin foto.</p>
        ) : !onedrive.carpeta ? (
          <p className="text-[11px] text-amber-800">Esta obra no tiene carpeta de OneDrive vinculada (Obras › Información General). Se registra sin foto.</p>
        ) : (
          <>
            <BotonesAdjuntar onArchivos={(nuevas) => setFotos((f) => [...f, ...nuevas])} />
            {fotos.length === 0 ? (
              <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Camera className="w-3.5 h-3.5" /> La foto es obligatoria para certificar.
              </p>
            ) : (
              <ul className="space-y-1">
                {fotos.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
                    <ImageIcon className={`w-3.5 h-3.5 shrink-0 ${esImagen(mimeDeArchivo(f.name, f.type)) ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span className="flex-1 min-w-0 truncate text-slate-800">{f.name}</span>
                    <span className="text-slate-400 shrink-0">{formatoTamano(f.size)}</span>
                    <IconButton icono={X} etiqueta={`Quitar ${f.name}`} tono="peligro" onClick={() => setFotos((s) => s.filter((_, j) => j !== i))} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <Textarea label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={1000} placeholder="Sellos, terminaciones, observaciones…" />

      <div className="flex justify-end">
        <Button type="button" variant="primary" size="sm" leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />} disabled={!puedeAgregar} onClick={agregar}>
          Agregar al listado
        </Button>
      </div>
    </div>
  );
};

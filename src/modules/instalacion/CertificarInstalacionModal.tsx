import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, CheckCircle2, ImageIcon, X } from 'lucide-react';
import { certificarInstalacion, getOneDriveObra, subirFotoInstalacion } from '../../api/client';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Aviso } from '../../components/ui/Aviso';
import { Casilla, OpcionesTarjeta, Textarea } from '../../components/ui/Campos';
import { IconButton } from '../../components/ui/IconButton';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import type { ParteVentana, VentanaObra } from '../../types';
import { BotonesAdjuntar } from '../proyectos/pendientes/adjuntos/BotonesAdjuntar';
import { prepararArchivo } from '../proyectos/pendientes/adjuntos/prepararArchivo';
import { esImagen, formatoTamano, mimeDeArchivo } from '../proyectos/pendientes/adjuntos/utils';
import { DibujoVentana } from '../proyectos/obra/DibujoVentana';
import { ETIQUETA_ESTADO_VENTANA, nombreVentana } from '../proyectos/obra/estadoVentana';

interface Props {
  proyectoId: string;
  ventana: VentanaObra;
  onClose: () => void;
  onCertificada: () => void;
}

/**
 * Certifica que la ventana (o su marco / su hoja) quedó instalada: pide la
 * foto (se guarda en la carpeta de OneDrive de la obra, en Instalacion/<nomenclatura>)
 * y deja el registro con quién y cuándo.
 */
export const CertificarInstalacionModal: React.FC<Props> = ({ proyectoId, ventana, onClose, onCertificada }) => {
  const queryClient = useQueryClient();
  const partesPendientes = (['COMPLETA', 'MARCO', 'HOJA'] as ParteVentana[]).filter((p) => {
    if (ventana.instalaciones.some((i) => i.parte === 'COMPLETA' || i.parte === p)) return false;
    if (p === 'COMPLETA') return ventana.instalaciones.length === 0;
    return ventana.admiteSeparacion;
  });
  const estadoDe = (p: ParteVentana) => ventana.partes.find((x) => x.parte === p)?.estado ?? ventana.estado;
  const [parte, setParte] = useState<ParteVentana>(() => (ventana.separada ? partesPendientes.find((p) => p !== 'COMPLETA') ?? partesPendientes[0] : partesPendientes[0]) ?? 'COMPLETA');
  const [notas, setNotas] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [forzar, setForzar] = useState(false);
  const [progreso, setProgreso] = useState<string | null>(null);

  const { data: onedrive } = useQuery({ queryKey: ['onedrive', proyectoId], queryFn: () => getOneDriveObra(proyectoId), staleTime: 1000 * 60 });
  const puedeSubir = !!onedrive?.configurado && !onedrive.requiereReconexion && !!onedrive.carpeta;
  const sinRecepcion = estadoDe(parte) !== 'RECIBIDA';

  const certificar = useMutation({
    mutationFn: async () => {
      const { instalacion } = await certificarInstalacion(ventana.id, { parte, notas: notas.trim() || null, forzar });
      const fallidas: string[] = [];
      for (let i = 0; i < fotos.length; i++) {
        setProgreso(`Subiendo foto ${i + 1} de ${fotos.length}…`);
        try {
          const listo = await prepararArchivo(fotos[i]);
          await subirFotoInstalacion(instalacion.id, listo.blob, listo.nombre, listo.mime);
        } catch (e) {
          fallidas.push(`${fotos[i].name}: ${extraerErrorParaToast(e).mensaje}`);
        }
      }
      setProgreso(null);
      if (fallidas.length) mostrarToast(`La instalación quedó registrada, pero no se pudo subir: ${fallidas.join(' · ')}. Agrega la foto desde la ventana.`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instalacion'] });
      queryClient.invalidateQueries({ queryKey: ['instalacionObras'] });
      queryClient.invalidateQueries({ queryKey: ['ventanaInstalacion', ventana.id] });
      onCertificada();
    },
    onError: (e) => {
      setProgreso(null);
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  // La foto es obligatoria cuando OneDrive está disponible; si no, se avisa y se deja certificar igual.
  const faltaFoto = puedeSubir && fotos.length === 0;
  const puedeConfirmar = partesPendientes.length > 0 && !faltaFoto && (!sinRecepcion || forzar);

  return (
    <Modal
      icono={CheckCircle2}
      titulo={`Certificar instalación · ${nombreVentana(ventana)}`}
      subtitulo={`${ventana.sistema}${ventana.ubicacion ? ` · ${ventana.ubicacion}` : ''}`}
      ancho="lg"
      onClose={onClose}
      cerrable={!certificar.isPending}
      pie={
        <Modal.Pie inicio={progreso ? <span role="status">{progreso}</span> : undefined}>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!puedeConfirmar} isLoading={certificar.isPending} onClick={() => certificar.mutate()} leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}>
            Instalada
          </Button>
        </Modal.Pie>
      }
    >
      <div className="space-y-4">
        {/* Dibujo a lo ancho en el celular; en tablet horizontal queda más alto para verlo de lejos. */}
        <DibujoVentana proyectoId={proyectoId} ventanaId={ventana.ventanaId} className="h-36 md:h-48" />

        {partesPendientes.length > 1 && (
          <OpcionesTarjeta
            legend="Qué quedó instalado"
            columnas={partesPendientes.length === 3 ? 3 : 2}
            valor={parte}
            onChange={setParte}
            opciones={partesPendientes.map((p) => ({ value: p, label: p === 'COMPLETA' ? 'Ventana completa' : p === 'MARCO' ? 'Solo el marco' : 'Solo la hoja', ayuda: ETIQUETA_ESTADO_VENTANA[estadoDe(p)] }))}
          />
        )}
        {partesPendientes.length === 0 && <Aviso tono="exito">Esta ventana ya está certificada como instalada.</Aviso>}

        {sinRecepcion && partesPendientes.length > 0 && (
          <Aviso tono="advertencia" titulo={`Todavía no figura recibida en obra (${ETIQUETA_ESTADO_VENTANA[estadoDe(parte)].toLowerCase()})`}>
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
              <BotonesAdjuntar disabled={certificar.isPending} onArchivos={(nuevas) => setFotos((f) => [...f, ...nuevas])} />
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
                      <IconButton icono={X} etiqueta={`Quitar ${f.name}`} tono="peligro" disabled={certificar.isPending} onClick={() => setFotos((s) => s.filter((_, j) => j !== i))} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <Textarea label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} maxLength={1000} placeholder="Sellos, terminaciones, observaciones…" />
      </div>
    </Modal>
  );
};

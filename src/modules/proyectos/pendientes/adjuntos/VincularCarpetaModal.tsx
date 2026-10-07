import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Folder, Loader2, Search, X } from 'lucide-react';
import { buscarCarpetasOneDrive, getOneDriveObra, vincularCarpetaOneDrive } from '../../../../api/client';
import { Button } from '../../../../components/ui/Button';
import { extraerErrorParaToast, mostrarToast } from '../../../../lib/toast';
import type { CarpetaOneDriveSugerida } from '../../../../types';

interface Props {
  proyectoId: string;
  onClose: () => void;
}

const campo =
  'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600';

// Vincula la obra con su carpeta de OneDrive (donde se guardan los adjuntos de
// los pendientes). Se propone la carpeta que parece ser de la obra (por el
// numero de proyecto) pero NADA se vincula ni se crea sin que una persona lo
// confirme: una carpeta equivocada mezclaria archivos de dos obras.
export const VincularCarpetaModal: React.FC<Props> = ({ proyectoId, onClose }) => {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [consulta, setConsulta] = useState('');
  const [confirmarNueva, setConfirmarNueva] = useState(false);
  const [nombreNueva, setNombreNueva] = useState<string | null>(null);

  const { data: estado, isLoading } = useQuery({ queryKey: ['onedrive', proyectoId], queryFn: () => getOneDriveObra(proyectoId) });
  const encontradas = useQuery({
    queryKey: ['onedriveCarpetas', proyectoId, consulta],
    queryFn: () => buscarCarpetasOneDrive(proyectoId, consulta),
    enabled: consulta.length > 0,
  });

  const vincular = useMutation({
    mutationFn: (payload: { carpetaId: string } | { crear: true; nombre?: string }) => vincularCarpetaOneDrive(proyectoId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onedrive', proyectoId] });
      onClose();
    },
    onError: (e) => {
      const { mensaje, detalle } = extraerErrorParaToast(e);
      mostrarToast(mensaje, { detalle });
    },
  });

  const nombreNuevaFinal = nombreNueva ?? estado?.nombreSugeridoNueva ?? '';
  const Fila: React.FC<{ c: CarpetaOneDriveSugerida; destacada?: boolean }> = ({ c, destacada }) => (
    <li className={`flex items-center gap-2 rounded-xl border p-2.5 ${destacada ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200 bg-white'}`}>
      <Folder className="w-4 h-4 text-slate-400 shrink-0" />
      <span className="flex-1 min-w-0 text-xs font-bold text-slate-800 truncate" title={c.nombre}>
        {c.nombre}
      </span>
      {c.url && (
        <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-brand-600" aria-label={`Abrir ${c.nombre} en OneDrive`}>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
      <Button size="sm" variant={destacada ? 'primary' : 'outline'} disabled={vincular.isPending} onClick={() => vincular.mutate({ carpetaId: c.id })}>
        Usar esta
      </Button>
    </li>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Vincular carpeta de OneDrive">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-900">Carpeta de OneDrive de la obra</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Las fotos y documentos de los pendientes se guardan aquí, en <span className="font-mono">Pendientes/PEN-…</span>. Elige la carpeta de esta
              obra: confirma que sea la correcta.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer shrink-0" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Parece ser esta</h4>
              {estado && estado.sugerencias.length > 0 ? (
                <ul className="space-y-1.5">
                  {estado.sugerencias.map((c, i) => (
                    <Fila key={c.id} c={c} destacada={i === 0} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">No encontré una carpeta con el número ni el nombre de esta obra. Búscala abajo o crea una nueva.</p>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Buscar otra carpeta</h4>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setConsulta(busqueda.trim());
                }}
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Parte del nombre o del número"
                    aria-label="Buscar carpeta"
                    className={`${campo} pl-9`}
                  />
                </div>
                <Button type="submit" size="sm" variant="outline" disabled={!busqueda.trim()}>
                  Buscar
                </Button>
              </form>
              {encontradas.isFetching && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              {encontradas.isError && <p className="text-xs text-rose-700">No se pudo buscar en OneDrive.</p>}
              {consulta && encontradas.data && (
                encontradas.data.length === 0 ? (
                  <p className="text-xs text-slate-500">Ninguna carpeta coincide con "{consulta}".</p>
                ) : (
                  <ul className="space-y-1.5">
                    {encontradas.data.slice(0, 20).map((c) => (
                      <Fila key={c.id} c={c} />
                    ))}
                  </ul>
                )
              )}
            </div>

            <div className="space-y-2 border-t border-slate-100 pt-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">O crear una carpeta nueva</h4>
              {!confirmarNueva ? (
                <Button size="sm" variant="outline" onClick={() => setConfirmarNueva(true)}>
                  Crear carpeta nueva…
                </Button>
              ) : (
                <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-900">Se creará esta carpeta en OneDrive. Úsalo solo si la obra aún no tiene carpeta.</p>
                  <input value={nombreNuevaFinal} onChange={(e) => setNombreNueva(e.target.value)} maxLength={120} aria-label="Nombre de la carpeta nueva" className={campo} />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      isLoading={vincular.isPending}
                      disabled={!nombreNuevaFinal.trim()}
                      onClick={() => vincular.mutate({ crear: true, nombre: nombreNuevaFinal.trim() })}
                    >
                      Crear y usar
                    </Button>
                    <Button size="sm" variant="ghost" disabled={vincular.isPending} onClick={() => setConfirmarNueva(false)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

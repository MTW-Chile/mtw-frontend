import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Cloud, ExternalLink, Loader2, Unplug } from 'lucide-react';
import { desconectarOneDrive, getOneDriveEstado, guardarCarpetaRaizOneDrive, iniciarConexionOneDrive } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useUrlParam } from '../../lib/navigation';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import { formatoFechaHora } from '../proyectos/fabricacion/utils';

const campo =
  'w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-brand-600';

const VARIABLES = ['ONEDRIVE_CLIENT_ID', 'ONEDRIVE_TENANT_ID', 'ONEDRIVE_CLIENT_SECRET', 'ONEDRIVE_REDIRECT_URI', 'ONEDRIVE_TOKEN_KEY'];

const avisoError = (e: unknown) => {
  const { mensaje, detalle } = extraerErrorParaToast(e);
  mostrarToast(mensaje, { detalle });
};

// Conexion con la cuenta central de OneDrive donde se guardan los adjuntos de los
// pendientes. El administrador pulsa "Conectar con Microsoft", inicia sesion con
// esa cuenta y acepta una vez (OAuth): la contrasena nunca pasa por el ERP y el
// permiso de acceso se guarda cifrado en el servidor. Ver mtw-api/docs/ONEDRIVE.md.
export const OneDrivePanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [resultado, setResultado] = useUrlParam('onedrive');
  const [motivo, setMotivo] = useUrlParam('motivo');
  const [raiz, setRaiz] = useState<string | null>(null);
  const avisado = useRef(false);

  const { data: estado, isLoading, isError } = useQuery({ queryKey: ['onedriveEstado'], queryFn: () => getOneDriveEstado() });
  const prueba = useQuery({ queryKey: ['onedriveEstado', 'probar'], queryFn: () => getOneDriveEstado(true), enabled: false });

  // Al volver del login de Microsoft, el servidor deja el resultado en la URL: se avisa una vez y se limpia.
  useEffect(() => {
    if (!resultado || avisado.current) return;
    avisado.current = true;
    if (resultado === 'ok') mostrarToast('OneDrive conectado.', { tipo: 'info' });
    else mostrarToast(motivo || 'No se pudo conectar OneDrive.');
    queryClient.invalidateQueries({ queryKey: ['onedriveEstado'] });
    queryClient.invalidateQueries({ queryKey: ['onedrive'] });
    setResultado(null, { replace: true });
    setMotivo(null, { replace: true });
  }, [resultado, motivo, queryClient, setResultado, setMotivo]);

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ['onedriveEstado'] });
    queryClient.invalidateQueries({ queryKey: ['onedrive'] }); // la cinta de carpeta de cada obra
  };

  const conectar = useMutation({
    mutationFn: iniciarConexionOneDrive,
    onSuccess: (url) => {
      window.location.href = url; // a Microsoft; vuelve por /api/onedrive/callback
    },
    onError: avisoError,
  });
  const guardarRaiz = useMutation({
    mutationFn: (valor: string) => guardarCarpetaRaizOneDrive(valor),
    onSuccess: (r) => {
      setRaiz(null);
      refrescar();
      mostrarToast(r.existe ? 'Carpeta raíz guardada.' : 'Guardada, pero esa carpeta no existe en el OneDrive de la cuenta: créala o corrige el nombre.', r.existe ? { tipo: 'info' } : undefined);
    },
    onError: avisoError,
  });
  const desconectar = useMutation({
    mutationFn: desconectarOneDrive,
    onSuccess: refrescar,
    onError: avisoError,
  });

  if (isLoading) {
    return (
      <div className="p-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  if (isError || !estado) {
    return <div className="p-8 text-center rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">No se pudo leer el estado de OneDrive.</div>;
  }

  const admin = estado.puedeAdministrar;
  const raizActual = raiz ?? estado.carpetaRaiz;
  const resultadoPrueba = prueba.data;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Cloud className="w-4 h-4 text-brand-600" /> OneDrive
        </h2>
        <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
          Aquí se conecta la cuenta de OneDrive de la empresa donde se guardan las fotos y documentos de los pendientes de obra. Se conecta una sola vez; nadie
          más necesita iniciar sesión en OneDrive.
        </p>
      </div>

      {!estado.appConfigurada ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2 text-xs text-amber-900">
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> El servidor aún no tiene la aplicación de Microsoft configurada.
          </p>
          <p>
            Faltan variables en Railway ({VARIABLES.map((v) => v).join(', ')}). Los pasos para crear la aplicación están en <span className="font-mono">mtw-api/docs/ONEDRIVE.md</span>.
          </p>
        </div>
      ) : !admin ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          Solo un administrador puede conectar o cambiar OneDrive. Estado actual:{' '}
          <b>{estado.conectada ? (estado.estado === 'REQUIERE_RECONEXION' ? 'conexión vencida, hay que reconectar' : 'conectado') : 'sin conectar'}</b>.
        </div>
      ) : !estado.conectada ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <p className="text-xs text-slate-600">
            Inicia sesión con la cuenta de la empresa que contiene las carpetas de las obras (ej. una cuenta de servicio). Microsoft te pedirá aceptar que el ERP
            lea y escriba archivos en <b>esa cuenta</b>.
          </p>
          <Button variant="primary" size="sm" leftIcon={<Cloud className="w-3.5 h-3.5" />} isLoading={conectar.isPending} onClick={() => conectar.mutate()}>
            Conectar con Microsoft
          </Button>
          {estado.redirectUri && (
            <p className="text-[11px] text-slate-500">
              La aplicación de Microsoft debe tener registrada esta URL de redirección: <span className="font-mono break-all">{estado.redirectUri}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-900 break-all">{estado.cuenta?.email}</span>
                {estado.estado === 'CONECTADA' ? (
                  <Badge size="sm" variant="success" dot>
                    Conectada
                  </Badge>
                ) : (
                  <Badge size="sm" variant="danger" dot>
                    Requiere reconexión
                  </Badge>
                )}
              </div>
              {estado.cuenta?.nombre && <p className="text-xs text-slate-500">{estado.cuenta.nombre}</p>}
              <p className="text-[11px] text-slate-400">
                Conectada por {estado.conectadoPorEmail} · {estado.conectadoEn ? formatoFechaHora(estado.conectadoEn) : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={estado.estado === 'CONECTADA' ? 'outline' : 'primary'} isLoading={conectar.isPending} onClick={() => conectar.mutate()}>
                {estado.estado === 'CONECTADA' ? 'Cambiar de cuenta' : 'Reconectar'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<Unplug className="w-3.5 h-3.5" />}
                disabled={desconectar.isPending}
                onClick={() => {
                  if (window.confirm('¿Desconectar OneDrive? Las obras conservan su carpeta vinculada y los adjuntos ya subidos, pero no se podrá subir ni ver archivos hasta volver a conectar.')) {
                    desconectar.mutate();
                  }
                }}
              >
                Desconectar
              </Button>
            </div>
          </div>

          {estado.estado === 'REQUIERE_RECONEXION' && (
            <div className="flex gap-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Microsoft rechazó el permiso guardado (se revocó, venció o cambió la contraseña de la cuenta). Mientras tanto no se pueden subir adjuntos ni ver sus
                miniaturas. Pulsa <b>Reconectar</b> e inicia sesión de nuevo.
                {estado.ultimoError && <span className="block mt-1 text-[11px] text-rose-700/80 break-words">{estado.ultimoError}</span>}
              </span>
            </div>
          )}

          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <label htmlFor="onedrive-raiz" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Carpeta que contiene las carpetas de obra
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="onedrive-raiz"
                value={raizActual}
                onChange={(e) => setRaiz(e.target.value)}
                placeholder="Obras (vacío = raíz del OneDrive)"
                maxLength={200}
                className={`${campo} flex-1 min-w-[12rem]`}
              />
              <Button size="sm" variant="primary" isLoading={guardarRaiz.isPending} disabled={raiz === null || raiz === estado.carpetaRaiz} onClick={() => guardarRaiz.mutate(raizActual)}>
                Guardar
              </Button>
              <Button size="sm" variant="outline" isLoading={prueba.isFetching} disabled={estado.estado !== 'CONECTADA'} onClick={() => prueba.refetch().then(() => queryClient.invalidateQueries({ queryKey: ['onedriveEstado'], exact: true }))}>
                Probar conexión
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Es la carpeta dentro del OneDrive de la cuenta donde están las carpetas de cada obra (ej. <span className="font-mono">Obras</span>). Para una subcarpeta
              usa <span className="font-mono">Obras/2026</span>.
            </p>
            {resultadoPrueba && !prueba.isFetching && (
              <p
                role="status"
                className={`flex items-start gap-1.5 text-xs rounded-lg p-2 ${resultadoPrueba.conexionOk ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}
              >
                {resultadoPrueba.conexionOk ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>
                  {resultadoPrueba.conexionOk ? `Conexión correcta: se leyó la carpeta "${resultadoPrueba.raizEnOneDrive?.nombre}".` : resultadoPrueba.error || 'No se pudo conectar.'}
                </span>
              </p>
            )}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 flex items-center gap-1">
        <ExternalLink className="w-3 h-3" /> Cada obra se vincula a su carpeta desde su sección <b>Control de pendientes</b>.
      </p>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cloud, Unplug } from 'lucide-react';
import { desconectarOneDrive, getOneDriveEstado, guardarCarpetasRaizOneDrive, iniciarConexionOneDrive, type CarpetasRaizOneDrive } from '../../api/client';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Aviso } from '../../components/ui/Aviso';
import { Seccion } from '../../components/ui/Seccion';
import { Cargando, ErrorCarga } from '../../components/ui/Estados';
import { useConfirmar } from '../../components/ui/Confirmar';
import { useUrlParam } from '../../lib/navigation';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import { formatoFechaHora } from '../proyectos/fabricacion/utils';

const VARIABLES = ['ONEDRIVE_CLIENT_ID', 'ONEDRIVE_TENANT_ID', 'ONEDRIVE_CLIENT_SECRET', 'ONEDRIVE_REDIRECT_URI', 'ONEDRIVE_TOKEN_KEY'];

// Las tres carpetas del OneDrive que contienen carpetas de obra.
const CARPETAS_RAIZ: { campo: keyof CarpetasRaizOneDrive; raiz: 'OBRAS_MAYORES' | 'RETAIL' | 'PRODUCCION'; label: string; placeholder: string; ayuda: string }[] = [
  {
    campo: 'carpetaRaiz',
    raiz: 'OBRAS_MAYORES',
    label: 'Carpeta que contiene las carpetas comerciales de obras mayores',
    placeholder: 'Obras Mayores (vacío = raíz del OneDrive)',
    ayuda: 'Ahí está la carpeta comercial de cada obra mayor. Para una subcarpeta usa la ruta completa, ej. Obras Adjudicadas/Obras Mayores.',
  },
  {
    campo: 'carpetaRaizRetail',
    raiz: 'RETAIL',
    label: 'Carpeta que contiene las carpetas comerciales de obras retail',
    placeholder: 'Vacío = la misma de obras mayores',
    ayuda: 'Las obras retail están en otra carpeta. Qué tipo de proyecto es retail se define en Configuración › Tipos de proyecto.',
  },
  {
    campo: 'carpetaRaizProduccion',
    raiz: 'PRODUCCION',
    label: 'Carpeta de producción',
    placeholder: 'Producción',
    ayuda: 'Contiene la carpeta de producción de cada obra. La usa solo Fabricación y es la misma para obras mayores y retail.',
  },
];

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
  const { confirmar } = useConfirmar();
  const [resultado, setResultado] = useUrlParam('onedrive');
  const [motivo, setMotivo] = useUrlParam('motivo');
  // Lo que se está editando y aún no se guarda (por campo).
  const [edicion, setEdicion] = useState<Partial<CarpetasRaizOneDrive>>({});
  const avisado = useRef(false);

  const { data: estado, isLoading, isError, refetch } = useQuery({ queryKey: ['onedriveEstado'], queryFn: () => getOneDriveEstado() });
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
  const guardarRaices = useMutation({
    mutationFn: (carpetas: Partial<CarpetasRaizOneDrive>) => guardarCarpetasRaizOneDrive(carpetas),
    onSuccess: (r) => {
      setEdicion({});
      refrescar();
      const faltan = CARPETAS_RAIZ.filter((c) => r.noExisten.includes(c.raiz)).map((c) => `"${r[c.campo]}"`);
      if (faltan.length) mostrarToast(`Guardado, pero no existe en el OneDrive de la cuenta: ${faltan.join(', ')}. Créala o corrige el nombre.`);
      else mostrarToast('Carpetas guardadas.', { tipo: 'info' });
    },
    onError: avisoError,
  });
  const desconectar = useMutation({
    mutationFn: desconectarOneDrive,
    onSuccess: refrescar,
    onError: avisoError,
  });

  if (isLoading) return <Cargando />;
  if (isError || !estado) return <ErrorCarga que="el estado de OneDrive" onReintentar={refetch} />;

  const admin = estado.puedeAdministrar;
  const hayCambios = CARPETAS_RAIZ.some((c) => edicion[c.campo] !== undefined && edicion[c.campo] !== estado[c.campo]);
  const resultadoPrueba = prueba.data;

  return (
    <Seccion
      icono={Cloud}
      titulo="OneDrive"
      descripcion="La cuenta de OneDrive de la empresa donde se guardan los documentos de las obras y las fotos de pendientes e instalación. Se conecta una sola vez; nadie más necesita iniciar sesión en OneDrive. Cada obra se vincula a sus carpetas desde las listas de Obras en curso y de Fabricación."
    >

      {!estado.appConfigurada ? (
        <Aviso tono="advertencia" titulo="El servidor aún no tiene la aplicación de Microsoft configurada.">
          Faltan variables en Railway ({VARIABLES.join(', ')}). Los pasos para crear la aplicación están en <span className="font-mono">mtw-api/docs/ONEDRIVE.md</span>.
        </Aviso>
      ) : !admin ? (
        <Aviso tono="neutro">
          Solo un administrador puede conectar o cambiar OneDrive. Estado actual:{' '}
          <b>{estado.conectada ? (estado.estado === 'REQUIERE_RECONEXION' ? 'conexión vencida, hay que reconectar' : 'conectado') : 'sin conectar'}</b>.
        </Aviso>
      ) : !estado.conectada ? (
        <div className="space-y-3">
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
        <div className="space-y-4">
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
              <p className="text-[11px] text-slate-500">
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
                onClick={async () => {
                  const ok = await confirmar({
                    titulo: '¿Desconectar OneDrive?',
                    mensaje: 'Las obras conservan su carpeta vinculada y los adjuntos ya subidos, pero no se podrá subir ni ver archivos hasta volver a conectar.',
                    confirmar: 'Desconectar',
                    peligro: true,
                  });
                  if (ok) desconectar.mutate();
                }}
              >
                Desconectar
              </Button>
            </div>
          </div>

          {estado.estado === 'REQUIERE_RECONEXION' && (
            <Aviso tono="peligro">
                Microsoft rechazó el permiso guardado (se revocó, venció o cambió la contraseña de la cuenta). Mientras tanto no se pueden subir adjuntos ni ver sus
                miniaturas. Pulsa <b>Reconectar</b> e inicia sesión de nuevo.
                {estado.ultimoError && <span className="block mt-1 text-[11px] opacity-80 break-words">{estado.ultimoError}</span>}
            </Aviso>
          )}

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-600">
              Cada obra tiene dos carpetas: la <b>comercial</b> (la ve Comercial; ahí van también las fotos de pendientes e instalación) y la de <b>producción</b> (la
              ve Fabricación). Indica dónde está cada grupo dentro del OneDrive de la cuenta.
            </p>
            <div className="space-y-3">
              {CARPETAS_RAIZ.map((c) => (
                <Input
                  key={c.campo}
                  label={c.label}
                  value={edicion[c.campo] ?? estado[c.campo]}
                  onChange={(e) => setEdicion((p) => ({ ...p, [c.campo]: e.target.value }))}
                  placeholder={c.placeholder}
                  helperText={c.ayuda}
                  maxLength={200}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" isLoading={guardarRaices.isPending} disabled={!hayCambios} onClick={() => guardarRaices.mutate(edicion)}>
                Guardar carpetas
              </Button>
              <Button size="sm" variant="outline" isLoading={prueba.isFetching} disabled={estado.estado !== 'CONECTADA' || hayCambios} onClick={() => prueba.refetch().then(() => queryClient.invalidateQueries({ queryKey: ['onedriveEstado'], exact: true }))}>
                Probar conexión
              </Button>
            </div>
            {resultadoPrueba && !prueba.isFetching && (
              <Aviso tono={resultadoPrueba.conexionOk ? 'exito' : 'peligro'}>
                {resultadoPrueba.conexionOk
                  ? `Conexión correcta: se leyó ${(resultadoPrueba.raices ?? []).filter((r) => r.existe).map((r) => `"${r.nombre}"`).join(', ')}.`
                  : resultadoPrueba.error || 'No se pudo conectar.'}
              </Aviso>
            )}
          </div>
        </div>
      )}
    </Seccion>
  );
};

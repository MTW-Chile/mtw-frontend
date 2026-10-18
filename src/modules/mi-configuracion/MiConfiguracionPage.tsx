import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Save, UserCog } from 'lucide-react';
import { updateMiUsuario, setMiClayToken, deleteMiClayToken } from '../../api/client';
import { usePermisos } from '../../lib/permisos';
import { extraerErrorParaToast, mostrarToast } from '../../lib/toast';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { Seccion } from '../../components/ui/Seccion';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Casilla } from '../../components/ui/Campos';
import { Aviso } from '../../components/ui/Aviso';
import { Cargando } from '../../components/ui/Estados';

const avisarError = (err: unknown) => mostrarToast(extraerErrorParaToast(err).mensaje);

/**
 * Mi configuración (menú de usuario del Header): lo que cada persona ajusta de
 * sí misma. Hoy sus datos, los avisos por correo y su token de Clay; aquí se
 * suman las preferencias personales que vengan. La configuración del ERP está
 * aparte, en el Sidebar, y solo con permiso. Rol, correo y estado los maneja
 * quien gestiona usuarios (Configuración › Roles y usuarios).
 */
export const MiConfiguracionPage: React.FC = () => {
  const { datos: permisos } = usePermisos();
  if (!permisos) return <Cargando />;
  return (
    <div className={`${PAGE_CONTAINER_CLASS} max-w-4xl`}>
      <HeaderSeccion titulo="Mi configuración" />
      <MisDatos />
      <TokenClay />
    </div>
  );
};

const MisDatos: React.FC = () => {
  const queryClient = useQueryClient();
  const { datos: permisos } = usePermisos();
  const [nombre, setNombre] = useState(permisos?.nombre || '');
  const [recibeCorreos, setRecibeCorreos] = useState(!!permisos?.recibeNotificacionesCorreo);
  useEffect(() => {
    setNombre(permisos?.nombre || '');
    setRecibeCorreos(!!permisos?.recibeNotificacionesCorreo);
  }, [permisos?.nombre, permisos?.recibeNotificacionesCorreo]);

  const sucio = nombre.trim() !== (permisos?.nombre || '') || recibeCorreos !== !!permisos?.recibeNotificacionesCorreo;
  const guardar = useMutation({
    mutationFn: () => {
      if (!nombre.trim()) throw new Error('El nombre no puede quedar vacío.');
      return updateMiUsuario({ nombre: nombre.trim(), recibeNotificacionesCorreo: recibeCorreos });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misPermisos'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      mostrarToast('Datos guardados.', { tipo: 'info' });
    },
    onError: avisarError,
  });

  return (
    <Seccion
      icono={UserCog}
      titulo="Mis datos"
      descripcion={permisos?.email}
      acciones={
        <Button size="sm" leftIcon={<Save className="w-3.5 h-3.5" />} disabled={!sucio || !nombre.trim()} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Nombre" placeholder="Ej: Juan Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input label="Rol" value={permisos?.rol || 'Sin rol asignado'} disabled helperText="Lo asigna un administrador" />
        </div>
        <Casilla
          checked={recibeCorreos}
          onChange={setRecibeCorreos}
          label="Recibir avisos por correo"
          descripcion="Aprobaciones pendientes que puedes resolver. Siempre las verás en Notificaciones."
        />
      </div>
    </Seccion>
  );
};

// Token de Clay: todo lo que la plataforma hace en Clay (buscar facturas,
// contabilizarlas) va con este token, así Clay registra a la persona real y
// aplica sus permisos. Se valida contra Clay al guardar y queda cifrado en el
// servidor; nunca se vuelve a mostrar.
const TokenClay: React.FC = () => {
  const queryClient = useQueryClient();
  const { datos: permisos } = usePermisos();
  const [token, setToken] = useState('');

  const guardar = useMutation({
    mutationFn: () => setMiClayToken(token.trim()),
    onSuccess: () => {
      setToken('');
      queryClient.invalidateQueries({ queryKey: ['misPermisos'] });
      mostrarToast('Token de Clay guardado.', { tipo: 'info' });
    },
    onError: avisarError,
  });
  const quitar = useMutation({
    mutationFn: deleteMiClayToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['misPermisos'] }),
    onError: avisarError,
  });

  return (
    <Seccion
      icono={KeyRound}
      titulo="Integración con Clay"
      descripcion="Tu token personal: con él la plataforma busca y contabiliza facturas en Clay a tu nombre."
      acciones={
        permisos?.tieneTokenClay && (
          <Button variant="ghost" size="sm" className="text-rose-600! hover:bg-rose-50!" isLoading={quitar.isPending} disabled={guardar.isPending} onClick={() => quitar.mutate()}>
            Quitar token
          </Button>
        )
      }
    >
      <div className="space-y-3">
        {permisos?.tieneTokenClay ? (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="w-4 h-4" /> Token configurado
          </p>
        ) : (
          <Aviso tono="advertencia">Sin configurar: lo necesitas para conciliar facturas con Clay.</Aviso>
        )}
        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div className="flex-1">
            <Input
              label={permisos?.tieneTokenClay ? 'Reemplazar token' : 'Token'}
              type="password"
              autoComplete="off"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={permisos?.tieneTokenClay ? 'Pega un token nuevo para reemplazarlo' : 'Pega tu token de Clay'}
              className="font-mono"
            />
          </div>
          <Button disabled={!token.trim()} isLoading={guardar.isPending} onClick={() => guardar.mutate()}>
            Guardar token
          </Button>
        </div>
        <p className="text-[11px] text-slate-500">
          Créalo en Clay con un usuario con permisos para contabilizar (
          <a href="https://ayuda.clay.cl/es/article/como-crear-un-token-para-la-api-1fn9wye/" target="_blank" rel="noreferrer" className="text-brand-600 underline">
            cómo crear un token
          </a>
          ). Se valida contra Clay al guardar y queda cifrado; no se vuelve a mostrar.
        </p>
      </div>
    </Seccion>
  );
};

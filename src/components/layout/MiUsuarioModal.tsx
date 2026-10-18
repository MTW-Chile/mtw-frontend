import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { updateMiUsuario, setMiClayToken, deleteMiClayToken } from '../../api/client';
import type { MisPermisos } from '../../types';
import { Casilla } from '../ui/Campos';
import { Modal } from '../ui/Modal';
import { Aviso } from '../ui/Aviso';

// "Editar mi usuario" (menu de usuario del Header) -- lo que cualquiera
// puede cambiar de si mismo: su nombre, si recibe avisos por correo y su
// token personal de Clay. Rol, correo y estado son de quien gestiona
// usuarios (Configuracion > Roles de Usuario).
//
// Token de Clay: todo lo que la plataforma hace en Clay (buscar facturas,
// contabilizarlas) va con este token, asi Clay registra a la persona real
// y aplica sus permisos. Se valida contra Clay al guardar y queda cifrado
// en el servidor -- nunca se vuelve a mostrar.
export const MiUsuarioModal: React.FC<{ permisos: MisPermisos; onClose: () => void }> = ({ permisos, onClose }) => {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(permisos.nombre || '');
  const [recibeCorreos, setRecibeCorreos] = useState(permisos.recibeNotificacionesCorreo);
  const [tokenClay, setTokenClay] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      if (!nombre.trim()) throw new Error('El nombre no puede quedar vacío.');
      // Primero el token: si Clay lo rechaza, no se guarda nada a medias.
      if (tokenClay.trim()) await setMiClayToken(tokenClay.trim());
      const cambios = {
        ...(nombre.trim() !== (permisos.nombre || '') ? { nombre: nombre.trim() } : {}),
        ...(recibeCorreos !== permisos.recibeNotificacionesCorreo ? { recibeNotificacionesCorreo: recibeCorreos } : {}),
      };
      if (Object.keys(cambios).length > 0) await updateMiUsuario(cambios);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['misPermisos'] });
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (err: any) => setError(err?.response?.data?.error || err?.message || 'No se pudo guardar.'),
  });

  const quitarToken = useMutation({
    mutationFn: deleteMiClayToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['misPermisos'] }),
    onError: (err: any) => setError(err?.response?.data?.error || 'No se pudo quitar el token de Clay.'),
  });

  const ocupado = guardar.isPending || quitarToken.isPending;

  return (
    <Modal
      titulo="Editar mi usuario"
      subtitulo={permisos.email}
      icono={UserCog}
      ancho="sm"
      onClose={onClose}
      onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            guardar.mutate();
          }}
      cerrable={!ocupado}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" onClick={onClose} disabled={ocupado}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={guardar.isPending} disabled={quitarToken.isPending}>
            Guardar
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}

      <Input label="Nombre" placeholder="Ej: Juan Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <Input label="Rol" value={permisos.rol || 'Sin rol asignado'} disabled helperText="Lo asigna un administrador" />

      <Casilla checked={recibeCorreos} onChange={setRecibeCorreos} label={<><span>
          <span className="font-bold">Recibir avisos por correo</span>
          <span className="block text-slate-500">
            Aprobaciones pendientes que puedes resolver. Siempre las verás en Notificaciones.
          </span>
        </span></>} />

      <div className="space-y-1.5 pt-3 border-t border-slate-100">
        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
          <KeyRound className="w-3.5 h-3.5" /> Token de Clay
        </label>
        {permisos.tieneTokenClay ? (
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Configurado
            </span>
            <Button variant="ghost" size="sm" onClick={() => {
                setError(null);
                quitarToken.mutate();
              }} disabled={ocupado} className="text-rose-600! hover:bg-rose-50!">{quitarToken.isPending ? 'Quitando...' : 'Quitar token'}</Button>
          </div>
        ) : (
          <p className="text-[11px] text-amber-600 font-semibold">Sin configurar -- necesario para conciliar facturas con Clay.</p>
        )}
        <Input
          aria-label="Token de Clay"
          type="password"
          autoComplete="off"
          value={tokenClay}
          onChange={(e) => setTokenClay(e.target.value)}
          placeholder={permisos.tieneTokenClay ? 'Pega un token nuevo para reemplazarlo' : 'Pega tu token de Clay'}
          className="font-mono"
        />
        <p className="text-[11px] text-slate-500">
          Créalo en Clay con un usuario con permisos para contabilizar (
          <a
            href="https://ayuda.clay.cl/es/article/como-crear-un-token-para-la-api-1fn9wye/"
            target="_blank"
            rel="noreferrer"
            className="text-brand-600 underline"
          >
            cómo crear un token
          </a>
          ). Se valida contra Clay al guardar y queda cifrado; no se vuelve a mostrar.
        </p>
      </div>

    </Modal>
  );
};

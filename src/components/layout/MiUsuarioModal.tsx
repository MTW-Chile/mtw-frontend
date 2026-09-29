import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, UserCog, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { updateMiUsuario, setMiClayToken, deleteMiClayToken } from '../../api/client';
import type { MisPermisos } from '../../types';

// "Editar mi usuario" (menu de usuario del Header) -- lo que cualquiera
// puede cambiar de si mismo: su nombre y su token personal de Clay. Rol,
// correo y estado siguen siendo solo del admin (Configuracion > Roles de
// Usuario).
//
// Token de Clay: todo lo que la plataforma hace en Clay (buscar facturas,
// contabilizarlas) va con este token, asi Clay registra a la persona real
// y aplica sus permisos. Se valida contra Clay al guardar y queda cifrado
// en el servidor -- nunca se vuelve a mostrar.
export const MiUsuarioModal: React.FC<{ permisos: MisPermisos; onClose: () => void }> = ({ permisos, onClose }) => {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState(permisos.nombre || '');
  const [tokenClay, setTokenClay] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      if (!nombre.trim()) throw new Error('El nombre no puede quedar vacío.');
      // Primero el token: si Clay lo rechaza, no se guarda nada a medias.
      if (tokenClay.trim()) await setMiClayToken(tokenClay.trim());
      if (nombre.trim() !== (permisos.nombre || '')) await updateMiUsuario(nombre.trim());
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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={ocupado ? undefined : onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <UserCog className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black tracking-tight text-slate-900">Editar mi usuario</h2>
              <p className="text-[11px] text-slate-500 truncate">{permisos.email}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={ocupado}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            guardar.mutate();
          }}
          className="p-5 space-y-4 overflow-y-auto flex-1"
        >
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <Input label="Nombre" placeholder="Ej: Juan Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <Input label="Rol" value={permisos.rol || 'Sin rol asignado'} disabled helperText="Lo asigna un administrador" />

          <div className="space-y-1.5 pt-3 border-t border-slate-100">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <KeyRound className="w-3.5 h-3.5" /> Token de Clay
            </label>
            {permisos.tieneTokenClay ? (
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Configurado
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    quitarToken.mutate();
                  }}
                  disabled={ocupado}
                  className="text-rose-600 hover:text-rose-700 font-semibold disabled:opacity-50"
                >
                  {quitarToken.isPending ? 'Quitando...' : 'Quitar token'}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-amber-600 font-semibold">Sin configurar -- necesario para conciliar facturas con Clay.</p>
            )}
            <input
              type="password"
              autoComplete="off"
              value={tokenClay}
              onChange={(e) => setTokenClay(e.target.value)}
              placeholder={permisos.tieneTokenClay ? 'Pega un token nuevo para reemplazarlo' : 'Pega tu token de Clay'}
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-[#E34A26] focus:ring-2 focus:ring-[#E34A26]/10 transition-all"
            />
            <p className="text-[11px] text-slate-500">
              Créalo en Clay con un usuario con permisos para contabilizar (
              <a
                href="https://ayuda.clay.cl/es/article/como-crear-un-token-para-la-api-1fn9wye/"
                target="_blank"
                rel="noreferrer"
                className="text-[#E34A26] underline"
              >
                cómo crear un token
              </a>
              ). Se valida contra Clay al guardar y queda cifrado; no se vuelve a mostrar.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={ocupado}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={guardar.isPending} disabled={quitarToken.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

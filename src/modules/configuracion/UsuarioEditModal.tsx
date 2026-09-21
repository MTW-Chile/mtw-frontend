import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, UserCog, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { createUsuario, updateUsuario, getRoles } from '../../api/client';
import type { Rol, Usuario } from '../../types';

interface UsuarioEditModalProps {
  usuario: Usuario | null; // null = crear nuevo (invitar por correo)
  onClose: () => void;
}

export const UsuarioEditModal: React.FC<UsuarioEditModalProps> = ({ usuario, onClose }) => {
  const queryClient = useQueryClient();
  const esNuevo = !usuario;

  const { data: roles } = useQuery<Rol[]>({
    queryKey: ['roles'],
    queryFn: async () => (await getRoles()).data,
  });

  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [rolId, setRolId] = useState<string>(usuario?.rolId || '');
  const [generalError, setGeneralError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (esNuevo) {
        return createUsuario({ nombre: nombre.trim(), email: email.trim(), rolId: rolId || null });
      }
      return updateUsuario(usuario!.id, { nombre: nombre.trim(), email: email.trim(), rolId: rolId || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'Error al guardar el usuario.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!nombre.trim() || !email.trim()) {
      setGeneralError('Nombre y correo son obligatorios.');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <UserCog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">
                {esNuevo ? 'Nuevo Usuario' : usuario!.nombre}
              </h2>
              <p className="text-[11px] text-slate-500">
                El correo debe coincidir con el de su cuenta de Entra ID/Microsoft
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <Input label="Nombre" placeholder="Ej: Juan Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} required />

          <Input
            label="Correo"
            type="email"
            placeholder="nombre@mtw.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Rol</label>
            <select
              value={rolId}
              onChange={(e) => setRolId(e.target.value)}
              className="w-full py-2.5 px-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#E34A26] focus:ring-2 focus:ring-[#E34A26]/10 transition-all"
            >
              <option value="">Sin rol asignado (sin acceso)</option>
              {(roles || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={mutation.isPending}>
              Guardar Usuario
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

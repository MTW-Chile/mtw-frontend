import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, ShieldCheck, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { createRol, updateRol } from '../../api/client';
import { SECCIONES_FRONTEND, CONFIG_TABS, ROLES_APROBACION } from '../../lib/accessControl';
import type { Rol } from '../../types';

interface RolEditModalProps {
  rol: Rol | null; // null = crear nuevo
  onClose: () => void;
}

/**
 * Que secciones del frontend y que pestañas de Configuración puede ver un
 * rol -- las opciones salen de SECCIONES_FRONTEND/CONFIG_TABS
 * (lib/accessControl.ts), asi que una seccion nueva aparece sola aca sin
 * tocar este archivo.
 */
export const RolEditModal: React.FC<RolEditModalProps> = ({ rol, onClose }) => {
  const queryClient = useQueryClient();
  const esNuevo = !rol;

  const [nombre, setNombre] = useState(rol?.nombre || '');
  const [secciones, setSecciones] = useState<string[]>(rol?.secciones || []);
  const [configTabs, setConfigTabs] = useState<string[]>(rol?.configTabs || []);
  const [aprobaciones, setAprobaciones] = useState<string[]>(rol?.aprobaciones || []);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const toggle = (lista: string[], setLista: (v: string[]) => void, id: string) => {
    setLista(lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (esNuevo) {
        return createRol({ nombre: nombre.trim(), secciones, configTabs, aprobaciones });
      }
      return updateRol(rol!.id, { nombre: nombre.trim(), secciones, configTabs, aprobaciones });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'Error al guardar el rol.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    if (!nombre.trim()) {
      setGeneralError('El nombre es obligatorio.');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">
                {esNuevo ? 'Nuevo Rol' : rol!.nombre}
              </h2>
              <p className="text-[11px] text-slate-500">Secciones y pestañas de Configuración a las que da acceso</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto flex-1">
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

          <Input
            label="Nombre del Rol"
            placeholder="Ej: Jefe Comercial"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Secciones del Frontend
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {SECCIONES_FRONTEND.map((s) => {
                const Icon = s.icon;
                const checked = secciones.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#E34A26]/10 text-[#E34A26] border-[#E34A26]/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(secciones, setSecciones, s.id)}
                      className="accent-[#E34A26]"
                    />
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{s.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pestañas de Configuración
            </label>
            <p className="text-[11px] text-slate-500">
              Solo tienen efecto si el rol también tiene marcada la sección "Configuración" arriba.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {CONFIG_TABS.map((t) => {
                const Icon = t.icon;
                const checked = configTabs.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#E34A26]/10 text-[#E34A26] border-[#E34A26]/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(configTabs, setConfigTabs, t.id)}
                      className="accent-[#E34A26]"
                    />
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Puede aprobar</label>
            <p className="text-[11px] text-slate-500">
              Permisos separados a propósito: marcar uno no habilita el otro. Un usuario necesita el permiso exacto
              para poder aprobar familias de materiales, la cotización, o una Orden de Compra.
            </p>
            <div className="grid grid-cols-1 gap-1.5">
              {ROLES_APROBACION.map((a) => {
                const Icon = a.icon;
                const checked = aprobaciones.includes(a.id);
                return (
                  <label
                    key={a.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      checked
                        ? 'bg-[#E34A26]/10 text-[#E34A26] border-[#E34A26]/20'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(aprobaciones, setAprobaciones, a.id)}
                      className="accent-[#E34A26]"
                    />
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{a.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={mutation.isPending}>
              Guardar Rol
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

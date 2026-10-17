import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ShieldCheck, AlertCircle, Crown } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { createRol, getCatalogoPermisos, updateRol } from '../../api/client';
import type { ModuloPermisos, Rol } from '../../types';

interface RolEditModalProps {
  rol: Rol | null; // null = crear nuevo
  onClose: () => void;
}

// Permisos que quedan incluidos por los marcados (cierre de las implicaciones
// del catalogo): se muestran marcados y bloqueados, con quien los incluye.
function incluidosPor(marcados: string[], catalogo: ModuloPermisos[]): Map<string, string> {
  const implica = new Map(catalogo.flatMap((m) => m.permisos.map((p) => [p.clave, p.implica] as const)));
  const nombre = new Map(catalogo.flatMap((m) => m.permisos.map((p) => [p.clave, p.nombre] as const)));
  const resultado = new Map<string, string>();
  for (const origen of marcados) {
    const pendientes = [...(implica.get(origen) ?? [])];
    while (pendientes.length > 0) {
      const p = pendientes.pop()!;
      if (resultado.has(p) || marcados.includes(p)) continue;
      resultado.set(p, nombre.get(origen) ?? origen);
      pendientes.push(...(implica.get(p) ?? []));
    }
  }
  return resultado;
}

/**
 * Rol = conjunto de permisos del catalogo de mtw-api, agrupados por modulo.
 * La lista sale de GET /api/permisos/catalogo: un permiso nuevo aparece aca
 * solo, sin tocar este archivo. El administrador de negocio tiene siempre
 * todos los permisos de negocio (incluidos los que se agreguen despues).
 */
export const RolEditModal: React.FC<RolEditModalProps> = ({ rol, onClose }) => {
  const queryClient = useQueryClient();
  const esNuevo = !rol;

  const [nombre, setNombre] = useState(rol?.nombre || '');
  const [descripcion, setDescripcion] = useState(rol?.descripcion || '');
  const [esAdministradorNegocio, setEsAdministradorNegocio] = useState(rol?.esAdministradorNegocio ?? false);
  const [permisos, setPermisos] = useState<string[]>(rol?.permisos || []);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const { data: catalogoData, isLoading: cargandoCatalogo } = useQuery({
    queryKey: ['catalogoPermisos'],
    queryFn: getCatalogoPermisos,
    staleTime: Infinity,
  });
  const catalogo = useMemo(() => catalogoData?.data ?? [], [catalogoData]);
  const incluidos = useMemo(() => incluidosPor(permisos, catalogo), [permisos, catalogo]);

  const toggle = (clave: string) =>
    setPermisos((actual) => (actual.includes(clave) ? actual.filter((p) => p !== clave) : [...actual, clave]));

  const mutation = useMutation({
    mutationFn: async () => {
      const datos = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        esAdministradorNegocio,
        // Se guardan solo los marcados a mano; los incluidos los resuelve el backend.
        permisos: esAdministradorNegocio ? [] : permisos,
      };
      return esNuevo ? createRol(datos) : updateRol(rol!.id, datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['misPermisos'] });
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
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[90vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">{esNuevo ? 'Nuevo rol' : rol!.nombre}</h2>
              <p className="text-[11px] text-slate-500">Qué puede hacer en el sistema quien tenga este rol</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nombre del rol" placeholder="Ej: Jefe Comercial" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <Input
              label="Descripción"
              placeholder="Para qué sirve este rol"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 accent-amber-600"
              checked={esAdministradorNegocio}
              onChange={(e) => setEsAdministradorNegocio(e.target.checked)}
            />
            <span className="text-xs text-slate-700">
              <span className="flex items-center gap-1.5 font-bold text-slate-900">
                <Crown className="w-3.5 h-3.5 text-amber-600" /> Administrador de negocio
              </span>
              <span className="block mt-0.5 text-slate-600">
                Tiene todos los permisos de negocio, incluidos los que se agreguen en el futuro. No incluye las funciones
                técnicas del sistema.
              </span>
            </span>
          </label>

          {!esAdministradorNegocio && (
            <div className="space-y-4">
              {cargandoCatalogo && <p className="text-xs text-slate-400">Cargando permisos…</p>}
              {catalogo.map((modulo) => (
                <fieldset key={modulo.id} className="rounded-xl border border-slate-200 overflow-hidden">
                  <legend className="sr-only">{modulo.nombre}</legend>
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {modulo.nombre}
                  </div>
                  <div className="divide-y divide-slate-100">
                    {modulo.permisos.map((p) => {
                      const marcado = permisos.includes(p.clave);
                      const incluidoPor = incluidos.get(p.clave);
                      return (
                        <label
                          key={p.clave}
                          className={`flex items-start gap-3 px-4 py-2.5 text-xs ${incluidoPor ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50/60'}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-brand-600"
                            checked={marcado || !!incluidoPor}
                            disabled={!!incluidoPor}
                            onChange={() => toggle(p.clave)}
                          />
                          <span className="min-w-0">
                            <span className="font-semibold text-slate-800">{p.nombre}</span>
                            <span className="block text-slate-500">{p.descripcion}</span>
                            {incluidoPor && <span className="block text-[11px] text-brand-700">Incluido por «{incluidoPor}»</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </form>

        <div className="px-5 py-3.5 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 shrink-0">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} isLoading={mutation.isPending}>
            {esNuevo ? 'Crear rol' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserCog, Plus, Pencil, Trash2, Loader2, Ban, CheckCircle2 } from 'lucide-react';
import { getRoles, eliminarRol, getUsuarios, updateUsuario, getMisPermisos } from '../../api/client';
import { RolEditModal } from './RolEditModal';
import { UsuarioEditModal } from './UsuarioEditModal';
import type { Rol, Usuario, MisPermisos } from '../../types';

/**
 * Gestión de Roles (que secciones/pestañas puede ver cada uno) y Usuarios
 * (nombre + correo + rol). El correo de cada Usuario debe coincidir con el
 * de su cuenta de Entra ID -- Cloudflare Access ya la autentica, esto solo
 * decide qué ve una vez adentro.
 *
 * ADMIN_EMAILS (mtw-api/src/index.ts) tiene acceso total sin pasar por
 * Rol, y es la única cuenta que puede gestionar esto -- se re-chequea acá
 * ademas del 403 del backend, para no mostrar formularios que van a
 * fallar igual si un rol llegara a tener marcada esta pestaña por error.
 */
export const RolesUsuarioPanel: React.FC = () => {
  const { data: permisos, isLoading: cargandoPermisos } = useQuery<MisPermisos>({
    queryKey: ['misPermisos'],
    queryFn: getMisPermisos,
  });

  if (cargandoPermisos) {
    return (
      <div className="py-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!permisos?.esAdmin) {
    return (
      <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-1">
        <ShieldCheck className="w-6 h-6 text-slate-300 mx-auto mb-1" />
        <p className="font-bold text-slate-700">Acceso restringido</p>
        <p>Solo el administrador del sistema puede gestionar roles y usuarios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RolesSection />
      <UsuariosSection />
    </div>
  );
};

const RolesSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Rol | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Rol[]>({
    queryKey: ['roles'],
    queryFn: async () => (await getRoles()).data,
  });
  const roles = data || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => eliminarRol(id),
    onMutate: (id) => setEliminandoId(id),
    onSettled: () => setEliminandoId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
    onError: (err: any) => window.alert(err?.response?.data?.error || err?.message || 'No se pudo eliminar el rol.'),
  });

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Roles</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Determinan qué secciones del frontend y qué pestañas de Configuración puede ver cada usuario.
          </p>
        </div>
        <button
          onClick={() => setCreandoNuevo(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-[#E34A26] bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Rol</span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs font-bold text-rose-600">Error al consultar los roles.</p>
          <button onClick={() => refetch()} className="text-xs font-bold text-[#E34A26] hover:underline cursor-pointer">
            Reintentar
          </button>
        </div>
      ) : roles.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500">Aún no hay roles configurados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {roles.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50/80 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900">{r.nombre}</div>
                <div className="text-[11px] text-slate-500">
                  {r.secciones.length} {r.secciones.length === 1 ? 'sección' : 'secciones'} ·{' '}
                  {r.configTabs.length} {r.configTabs.length === 1 ? 'pestaña de config.' : 'pestañas de config.'} ·{' '}
                  {r._count?.usuarios ?? 0} {r._count?.usuarios === 1 ? 'usuario' : 'usuarios'}
                  {r.aprobaciones.length > 0 && (
                    <>
                      {' · '}
                      <span className="font-semibold text-[#E34A26]">
                        aprueba {r.aprobaciones.join(' + ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditando(r)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:text-[#E34A26] hover:bg-orange-50 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                <button
                  onClick={() => {
                    if ((r._count?.usuarios ?? 0) > 0) {
                      window.alert(`No se puede eliminar: ${r._count?.usuarios} usuario(s) tienen este rol asignado.`);
                      return;
                    }
                    if (window.confirm(`¿Eliminar el rol "${r.nombre}"?`)) deleteMutation.mutate(r.id);
                  }}
                  disabled={eliminandoId === r.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {eliminandoId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(editando || creandoNuevo) && (
        <RolEditModal
          rol={editando}
          onClose={() => {
            setEditando(null);
            setCreandoNuevo(false);
          }}
        />
      )}
    </div>
  );
};

const UsuariosSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [cambiandoId, setCambiandoId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await getUsuarios()).data,
  });
  const usuarios = data || [];

  const toggleActivoMutation = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => updateUsuario(id, { activo }),
    onMutate: ({ id }) => setCambiandoId(id),
    onSettled: () => setCambiandoId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Usuarios</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            El correo debe coincidir con la cuenta de Entra ID con la que inician sesión vía Cloudflare Access.
          </p>
        </div>
        <button
          onClick={() => setCreandoNuevo(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-[#E34A26] bg-orange-50 hover:bg-orange-100 border border-orange-200 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Usuario</span>
        </button>
      </div>

      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
        <span className="font-bold text-slate-700">alfredo.mella.v@mtw.cl</span> es administrador del sistema:
        tiene acceso total sin importar el rol o el estado que tenga acá. Queda marcado como "Admin del sistema" y
        solo se le puede editar el nombre -- ni el rol ni el correo tienen efecto real sobre su acceso.
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs font-bold text-rose-600">Error al consultar los usuarios.</p>
          <button onClick={() => refetch()} className="text-xs font-bold text-[#E34A26] hover:underline cursor-pointer">
            Reintentar
          </button>
        </div>
      ) : usuarios.length === 0 ? (
        <div className="py-8 text-center space-y-2">
          <UserCog className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-xs text-slate-500">Aún no hay usuarios registrados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
                u.activo ? 'border-slate-200 hover:bg-slate-50/80' : 'border-slate-200 bg-slate-50/60 opacity-70'
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-bold text-slate-900 truncate">{u.nombre}</div>
                  {u.esAdmin ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[#E34A26]/10 text-[#E34A26] font-bold shrink-0">
                      Admin del sistema
                    </span>
                  ) : (
                    !u.activo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 font-bold shrink-0">
                        Desactivado
                      </span>
                    )
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                <div className="text-[11px] text-slate-500">
                  {u.esAdmin ? (
                    <span>Acceso total (fijado en el backend, no depende de un rol)</span>
                  ) : u.rol ? (
                    <span className="font-semibold text-slate-700">{u.rol.nombre}</span>
                  ) : (
                    <span className="text-amber-600 font-semibold">Sin rol asignado -- sin acceso</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditando(u)}
                  title={u.esAdmin ? 'Solo se puede editar el nombre' : 'Editar'}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:text-[#E34A26] hover:bg-orange-50 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                {!u.esAdmin && (
                  <button
                    onClick={() => toggleActivoMutation.mutate({ id: u.id, activo: !u.activo })}
                    disabled={cambiandoId === u.id}
                    title={u.activo ? 'Desactivar acceso' : 'Reactivar acceso'}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                      u.activo ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                  >
                    {cambiandoId === u.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : u.activo ? (
                      <Ban className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(editando || creandoNuevo) && (
        <UsuarioEditModal
          usuario={editando}
          onClose={() => {
            setEditando(null);
            setCreandoNuevo(false);
          }}
        />
      )}
    </div>
  );
};

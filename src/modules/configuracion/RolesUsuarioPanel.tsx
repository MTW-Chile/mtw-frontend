import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserCog, Plus, Pencil, Trash2, Loader2, Ban, CheckCircle2 } from 'lucide-react';
import { getRoles, eliminarRol, getUsuarios, updateUsuario } from '../../api/client';
import { usePermisos } from '../../lib/permisos';
import { RolEditModal } from './RolEditModal';
import { UsuarioEditModal } from './UsuarioEditModal';
import type { Rol, Usuario } from '../../types';

/**
 * Gestión de Roles (conjuntos de permisos del catálogo de mtw-api) y Usuarios
 * (nombre + correo + rol). El correo de cada Usuario debe coincidir con el de
 * su cuenta de Entra ID: Cloudflare Access autentica, esto decide qué puede
 * hacer una vez adentro. Ver usuarios.ver / usuarios.gestionar.
 */
export const RolesUsuarioPanel: React.FC = () => {
  const { tiene, cargando } = usePermisos();

  if (cargando) {
    return (
      <div className="py-12 flex items-center justify-center text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!tiene('usuarios.ver')) {
    return (
      <div className="p-8 text-center rounded-2xl bg-white border border-slate-200 text-slate-500 text-xs space-y-1">
        <ShieldCheck className="w-6 h-6 text-slate-300 mx-auto mb-1" />
        <p className="font-bold text-slate-700">Acceso restringido</p>
        <p>No tienes permiso para ver usuarios y roles.</p>
      </div>
    );
  }

  const puedeGestionar = tiene('usuarios.gestionar');
  return (
    <div className="space-y-6">
      <RolesSection puedeGestionar={puedeGestionar} />
      <UsuariosSection puedeGestionar={puedeGestionar} />
    </div>
  );
};

const RolesSection: React.FC<{ puedeGestionar: boolean }> = ({ puedeGestionar }) => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Rol | null>(null);
  const [creandoNuevo, setCreandoNuevo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['roles'], queryFn: getRoles });
  const roles: Rol[] = data?.data || [];
  const sinAsignar = data?.permisosSinAsignar ?? [];

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
            Cada rol es un conjunto de permisos. Lo que un usuario puede hacer depende del rol que tenga asignado.
          </p>
        </div>
        {puedeGestionar && (
        <button
          onClick={() => setCreandoNuevo(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Rol</span>
        </button>
        )}
      </div>

      {sinAsignar.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
          <span className="font-bold">{sinAsignar.length} permiso(s) sin asignar</span> a ningún rol (solo los tiene el
          administrador de negocio): <span className="font-mono">{sinAsignar.join(', ')}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs font-bold text-rose-600">Error al consultar los roles.</p>
          <button onClick={() => refetch()} className="text-xs font-bold text-brand-600 hover:underline cursor-pointer">
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
                {r.descripcion && <div className="text-[11px] text-slate-600">{r.descripcion}</div>}
                <div className="text-[11px] text-slate-500">
                  {r.esAdministradorNegocio ? (
                    <span className="font-semibold text-amber-700">Administrador de negocio · todos los permisos</span>
                  ) : (
                    <>
                      {r.permisos.length} {r.permisos.length === 1 ? 'permiso' : 'permisos'}
                    </>
                  )}
                  {' · '}
                  {r._count?.usuarios ?? 0} {r._count?.usuarios === 1 ? 'usuario' : 'usuarios'}
                </div>
              </div>
              {puedeGestionar && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditando(r)}
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
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
              )}
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

const UsuariosSection: React.FC<{ puedeGestionar: boolean }> = ({ puedeGestionar }) => {
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
        {puedeGestionar && (
          <button
            onClick={() => setCreandoNuevo(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 border border-brand-200 transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Usuario</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 flex items-center justify-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : isError ? (
        <div className="py-6 text-center space-y-2">
          <p className="text-xs font-bold text-rose-600">Error al consultar los usuarios.</p>
          <button onClick={() => refetch()} className="text-xs font-bold text-brand-600 hover:underline cursor-pointer">
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
                  {u.esSuperadmin && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-white font-bold shrink-0"
                      title="Superadministrador técnico (variable de entorno): tiene acceso total sin importar su rol"
                    >
                      Superadmin
                    </span>
                  )}
                  {!u.activo && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-600 font-bold shrink-0">
                      Desactivado
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{u.email}</div>
                <div className="text-[11px] text-slate-500">
                  {u.rol ? (
                    <span className="font-semibold text-slate-700">{u.rol.nombre}</span>
                  ) : (
                    <span className="text-amber-600 font-semibold">Sin rol asignado -- sin acceso</span>
                  )}
                </div>
              </div>
              {puedeGestionar && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditando(u)}
                  title="Editar"
                  className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:text-brand-600 hover:bg-brand-50 transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar</span>
                </button>
                {(
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
              )}
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

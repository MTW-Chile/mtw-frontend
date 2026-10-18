import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, UserCog, Plus, Pencil, Trash2, Ban, CheckCircle2 } from 'lucide-react';
import { getRoles, eliminarRol, getUsuarios, updateUsuario } from '../../api/client';
import { usePermisos } from '../../lib/permisos';
import { mostrarToast } from '../../lib/toast';
import { Button } from '../../components/ui/Button';
import { IconButton } from '../../components/ui/IconButton';
import { Badge } from '../../components/ui/Badge';
import { Aviso } from '../../components/ui/Aviso';
import { Seccion } from '../../components/ui/Seccion';
import { FilaLista, Lista } from '../../components/ui/Lista';
import { Cargando, EstadoVacio, ErrorCarga } from '../../components/ui/Estados';
import { useConfirmar } from '../../components/ui/Confirmar';
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

  if (cargando) return <Cargando />;
  if (!tiene('usuarios.ver')) {
    return <EstadoVacio icono={ShieldCheck} titulo="Acceso restringido" descripcion="No tienes permiso para ver usuarios y roles." />;
  }

  const puedeGestionar = tiene('usuarios.gestionar');
  return (
    <div className="space-y-6">
      <RolesSection puedeGestionar={puedeGestionar} />
      <UsuariosSection puedeGestionar={puedeGestionar} />
    </div>
  );
};

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const RolesSection: React.FC<{ puedeGestionar: boolean }> = ({ puedeGestionar }) => {
  const queryClient = useQueryClient();
  const { confirmar } = useConfirmar();
  const [editando, setEditando] = useState<Rol | 'nuevo' | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['roles'], queryFn: getRoles });
  const roles: Rol[] = data?.data || [];
  const sinAsignar = data?.permisosSinAsignar ?? [];

  const eliminar = useMutation({
    mutationFn: (id: string) => eliminarRol(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  const pedirEliminar = async (r: Rol) => {
    const usuarios = r._count?.usuarios ?? 0;
    if (usuarios > 0) {
      mostrarToast(`No se puede eliminar: ${plural(usuarios, 'usuario tiene', 'usuarios tienen')} este rol asignado.`);
      return;
    }
    if (await confirmar({ titulo: `¿Eliminar el rol "${r.nombre}"?`, confirmar: 'Eliminar', peligro: true })) eliminar.mutate(r.id);
  };

  return (
    <Seccion
      icono={ShieldCheck}
      antetitulo="Sistema"
      sinRelleno
      titulo="Roles"
      descripcion="Cada rol es un conjunto de permisos. Lo que un usuario puede hacer depende del rol que tenga asignado."
      acciones={
        puedeGestionar && (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditando('nuevo')}>
            Nuevo rol
          </Button>
        )
      }
    >
      {sinAsignar.length > 0 && (
        <div className="px-5 pt-4">
          <Aviso tono="advertencia" titulo={`${sinAsignar.length} permiso(s) sin asignar a ningún rol`}>
            Solo los tiene el administrador de negocio: <span className="font-mono">{sinAsignar.join(', ')}</span>
          </Aviso>
        </div>
      )}

      {isLoading ? (
        <Cargando />
      ) : isError ? (
        <ErrorCarga que="los roles" onReintentar={refetch} />
      ) : roles.length === 0 ? (
        <EstadoVacio enTarjeta={false} icono={ShieldCheck} titulo="Aún no hay roles configurados" />
      ) : (
        <Lista>
          {roles.map((r) => (
            <FilaLista
              key={r.id}
              titulo={r.nombre}
              acciones={
                puedeGestionar && (
                  <>
                    <Button size="sm" variant="ghost" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditando(r)}>
                      Editar
                    </Button>
                    <IconButton
                      icono={Trash2}
                      tono="peligro"
                      etiqueta={`Eliminar el rol ${r.nombre}`}
                      cargando={eliminar.isPending && eliminar.variables === r.id}
                      onClick={() => pedirEliminar(r)}
                    />
                  </>
                )
              }
            >
              {r.descripcion && <div className="text-slate-600">{r.descripcion}</div>}
              <div>
                {r.esAdministradorNegocio ? (
                  <span className="font-semibold text-amber-700">Administrador de negocio · todos los permisos</span>
                ) : (
                  plural(r.permisos.length, 'permiso', 'permisos')
                )}
                {' · '}
                {plural(r._count?.usuarios ?? 0, 'usuario', 'usuarios')}
              </div>
            </FilaLista>
          ))}
        </Lista>
      )}

      {editando && <RolEditModal rol={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />}
    </Seccion>
  );
};

const UsuariosSection: React.FC<{ puedeGestionar: boolean }> = ({ puedeGestionar }) => {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Usuario | 'nuevo' | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: async () => (await getUsuarios()).data,
  });
  const usuarios = data || [];

  const cambiarActivo = useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) => updateUsuario(id, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  return (
    <Seccion
      icono={UserCog}
      antetitulo="Sistema"
      sinRelleno
      titulo="Usuarios"
      descripcion="El correo debe coincidir con la cuenta de Entra ID con la que inician sesión vía Cloudflare Access."
      acciones={
        puedeGestionar && (
          <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditando('nuevo')}>
            Nuevo usuario
          </Button>
        )
      }
    >
      {isLoading ? (
        <Cargando />
      ) : isError ? (
        <ErrorCarga que="los usuarios" onReintentar={refetch} />
      ) : usuarios.length === 0 ? (
        <EstadoVacio enTarjeta={false} icono={UserCog} titulo="Aún no hay usuarios registrados" />
      ) : (
        <Lista>
          {usuarios.map((u) => (
            <FilaLista
              key={u.id}
              titulo={u.nombre}
              atenuada={!u.activo}
              insignias={
                <>
                  {u.esSuperadmin && (
                    <Badge size="sm" variant="dark" title="Superadministrador técnico (variable de entorno): tiene acceso total sin importar su rol">
                      Superadmin
                    </Badge>
                  )}
                  {!u.activo && <Badge size="sm">Desactivado</Badge>}
                </>
              }
              acciones={
                puedeGestionar && (
                  <>
                    <Button size="sm" variant="ghost" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditando(u)}>
                      Editar
                    </Button>
                    <IconButton
                      icono={u.activo ? Ban : CheckCircle2}
                      tono={u.activo ? 'peligro' : 'exito'}
                      etiqueta={u.activo ? 'Desactivar acceso' : 'Reactivar acceso'}
                      cargando={cambiarActivo.isPending && cambiarActivo.variables?.id === u.id}
                      onClick={() => cambiarActivo.mutate({ id: u.id, activo: !u.activo })}
                    />
                  </>
                )
              }
            >
              <div className="truncate">{u.email}</div>
              <div>
                {u.rol ? <span className="font-semibold text-slate-700">{u.rol.nombre}</span> : <span className="text-amber-600 font-semibold">Sin rol asignado: sin acceso</span>}
              </div>
            </FilaLista>
          ))}
        </Lista>
      )}

      {editando && <UsuarioEditModal usuario={editando === 'nuevo' ? null : editando} onClose={() => setEditando(null)} />}
    </Seccion>
  );
};

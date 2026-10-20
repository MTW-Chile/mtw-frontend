import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Aviso } from '../../components/ui/Aviso';
import { Casilla } from '../../components/ui/Campos';
import { createUsuario, updateUsuario, getRoles } from '../../api/client';
import type { Rol, Usuario } from '../../types';

interface UsuarioEditModalProps {
  usuario: Usuario | null; // null = crear nuevo (invitar por correo)
  onClose: () => void;
}

export const UsuarioEditModal: React.FC<UsuarioEditModalProps> = ({ usuario, onClose }) => {
  const queryClient = useQueryClient();
  const esNuevo = !usuario;
  // Superadministrador tecnico (SUPERADMIN_EMAILS en mtw-api): tiene acceso
  // total por variable de entorno; su rol aca solo aplica si deja de serlo.
  const esSuperadmin = !!usuario?.esSuperadmin;

  const { data: rolesData } = useQuery({ queryKey: ['roles'], queryFn: getRoles });
  const roles: Rol[] = rolesData?.data ?? [];

  const [nombre, setNombre] = useState(usuario?.nombre || '');
  const [email, setEmail] = useState(usuario?.email || '');
  const [rolId, setRolId] = useState<string>(usuario?.rolId || '');
  const [recibeCorreos, setRecibeCorreos] = useState(usuario?.recibeNotificacionesCorreo ?? true);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (esNuevo) {
        return createUsuario({ nombre: nombre.trim(), email: email.trim(), rolId: rolId || null });
      }
      return updateUsuario(usuario!.id, {
        nombre: nombre.trim(),
        email: email.trim(),
        rolId: rolId || null,
        recibeNotificacionesCorreo: recibeCorreos,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      queryClient.invalidateQueries({ queryKey: ['misPermisos'] });
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
    <Modal
      icono={UserCog}
      ancho="sm"
      titulo={esNuevo ? 'Nuevo usuario' : usuario!.nombre}
      subtitulo={esSuperadmin ? 'Superadministrador técnico: acceso total por configuración del servidor' : 'El correo debe coincidir con el de su cuenta de Entra ID/Microsoft'}
      onClose={onClose}
      cerrable={!mutation.isPending}
      onSubmit={handleSubmit}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            Guardar usuario
          </Button>
        </Modal.Pie>
      }
    >
      {generalError && <Aviso tono="peligro">{generalError}</Aviso>}
      <Input label="Nombre" placeholder="Ej: Juan Pérez" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <Input label="Correo" type="email" placeholder="nombre@mtw.cl" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Select
        label="Rol"
        value={rolId}
        onChange={(e) => setRolId(e.target.value)}
        options={[{ value: '', label: 'Sin rol asignado (sin acceso)' }, ...roles.map((r) => ({ value: r.id, label: r.nombre }))]}
      />
      {!esNuevo && <Casilla checked={recibeCorreos} onChange={setRecibeCorreos} label="Recibe avisos por correo de las aprobaciones que puede resolver" />}
    </Modal>
  );
};

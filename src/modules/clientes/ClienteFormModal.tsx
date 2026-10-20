import React, { useState } from 'react';
import { Users, Receipt } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { createCliente, updateCliente } from '../../api/client';
import type { Cliente } from '../../types';
import { SubTabs } from '../../components/ui/PageHeader';
import { Modal } from '../../components/ui/Modal';
import { Aviso } from '../../components/ui/Aviso';

interface ClienteFormModalProps {
  // null = crear uno nuevo; un Cliente = editar ese.
  cliente: Cliente | null;
  onClose: () => void;
  // Se llama con el cliente guardado (creado o editado) antes de cerrar --
  // lo usa ClientePicker para seleccionar al cliente recien creado.
  onGuardado?: (cliente: Cliente) => void;
}

type FormData = {
  nombre: string;
  razonSocial: string;
  rut: string;
  giro: string;
  direccion: string;
  localidad: string;
  telefono: string;
  email: string;
  contacto: string;
};

/**
 * Crear/editar en el maestro de Clientes. Dos pestañas: Datos Generales
 * (lo que ya existe hoy en Cliente) y Cobranza -- esta ultima todavia no
 * tiene de donde sacar datos reales (no hay conexion con Finanzas/Clay
 * para clientes todavia, a diferencia de Proveedor/OC), asi que por ahora
 * es un estado vacio a proposito, no datos de prueba. Deja el lugar listo
 * para cuando esa integracion exista.
 *
 * Nota: `nombre` se rotula "Razón Social" (asi lo usa el resto de la app,
 * ver ClienteManager.tsx en el wizard de Cotizaciones) y el campo
 * `razonSocial` -- vestigial, sin uso hasta ahora -- se rotula "Nombre de
 * Fantasía" para darle un proposito real sin tener que migrar la columna.
 */
export const ClienteFormModal: React.FC<ClienteFormModalProps> = ({ cliente, onClose, onGuardado }) => {
  const queryClient = useQueryClient();
  const esNuevo = !cliente;
  const [tab, setTab] = useState<'general' | 'cobranza'>('general');
  const [formData, setFormData] = useState<FormData>({
    nombre: cliente?.nombre || '',
    razonSocial: cliente?.razonSocial || '',
    rut: cliente?.rut || '',
    giro: cliente?.giro || '',
    direccion: cliente?.direccion || '',
    localidad: cliente?.localidad || '',
    telefono: cliente?.telefono || '',
    email: cliente?.email || '',
    contacto: cliente?.contacto || '',
  });
  const [generalError, setGeneralError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!formData.nombre.trim()) throw new Error('La razón social es obligatoria.');
      const payload: Partial<Cliente> = {
        nombre: formData.nombre.trim(),
        razonSocial: formData.razonSocial.trim() || null,
        rut: formData.rut.trim() || null,
        giro: formData.giro.trim() || null,
        direccion: formData.direccion.trim() || null,
        localidad: formData.localidad.trim() || null,
        telefono: formData.telefono.trim() || null,
        email: formData.email.trim() || null,
        contacto: formData.contacto.trim() || null,
      };
      return esNuevo ? createCliente(payload) : updateCliente(cliente!.id, payload);
    },
    onSuccess: (resultado) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      onGuardado?.(resultado.data);
      onClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'No se pudo guardar el cliente.');
    },
  });

  const set = (field: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <Modal
      icono={Users}
      ancho="lg"
      titulo={esNuevo ? 'Nuevo cliente' : cliente!.nombre}
      subtitulo={esNuevo ? 'Se agrega al maestro de clientes' : 'Editar datos del maestro'}
      onClose={onClose}
      cerrable={!mutation.isPending}
      onSubmit={() => {
        setGeneralError(null);
        mutation.mutate();
      }}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" isLoading={mutation.isPending}>
            Guardar
          </Button>
        </Modal.Pie>
      }
    >
      <SubTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'general', label: 'Datos generales' },
          { id: 'cobranza', label: 'Cobranza' },
        ]}
      />
      {generalError && <Aviso tono="peligro">{generalError}</Aviso>}

      {tab === 'general' ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Razón Social" value={formData.nombre} onChange={set('nombre')} required />
            <Input label="RUT" value={formData.rut} onChange={set('rut')} placeholder="Ej: 76.123.456-7" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Nombre de Fantasía" value={formData.razonSocial} onChange={set('razonSocial')} />
            <Input label="Giro Comercial" value={formData.giro} onChange={set('giro')} />
          </div>
          <Input label="Dirección" value={formData.direccion} onChange={set('direccion')} />
          <Input label="Comuna / Ciudad" value={formData.localidad} onChange={set('localidad')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Contacto Principal" value={formData.contacto} onChange={set('contacto')} />
            <Input label="Teléfono" value={formData.telefono} onChange={set('telefono')} />
          </div>
          <Input label="Correo Electrónico" type="email" value={formData.email} onChange={set('email')} />
        </>
      ) : (
        <div className="py-10 text-center text-xs text-slate-400 space-y-2">
          <Receipt className="w-8 h-8 mx-auto text-slate-300" />
          <p className="text-slate-500 font-semibold">Sin información de cobranza todavía</p>
          <p className="max-w-xs mx-auto">
            Facturas, saldos y estado de pago se van a mostrar acá cuando este módulo se conecte con Finanzas.
          </p>
        </div>
      )}
    </Modal>
  );
};

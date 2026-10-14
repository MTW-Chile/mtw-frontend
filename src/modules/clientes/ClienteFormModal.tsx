import React, { useState } from 'react';
import { X, Users, AlertCircle, Receipt } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { createCliente, updateCliente } from '../../api/client';
import type { Cliente } from '../../types';

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
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">{esNuevo ? 'Nuevo Cliente' : cliente!.nombre}</h2>
              <p className="text-[11px] text-slate-500">{esNuevo ? 'Se agrega al maestro de clientes' : 'Editar datos del maestro'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-3 flex items-center gap-1.5 border-b border-slate-100 shrink-0">
          {(['general', 'cobranza'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 rounded-t-lg text-xs font-bold transition-colors cursor-pointer ${
                tab === t ? 'text-brand-600 border-b-2 border-brand-600' : 'text-slate-400 hover:text-slate-700 border-b-2 border-transparent'
              }`}
            >
              {t === 'general' ? 'Datos Generales' : 'Cobranza'}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setGeneralError(null);
            mutation.mutate();
          }}
          className="p-5 space-y-3.5 overflow-y-auto flex-1"
        >
          {generalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{generalError}</span>
            </div>
          )}

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

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" isLoading={mutation.isPending}>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

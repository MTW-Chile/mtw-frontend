import React, { useState } from 'react';
import { X, Building2, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { updateProveedor, type ProveedorFacturacionPayload } from '../../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Proveedor } from '../../../types';

interface ProveedorEditModalProps {
  proveedor: Proveedor | null;
  onClose: () => void;
}

/**
 * Datos de facturación de un proveedor, organizados en las mismas 3
 * secciones del set real chileno (identificación tributaria, contacto,
 * financiero/comercial). En la práctica HETMO (VTAS_PROVEEDORES) casi nunca
 * trae esto lleno -- solo nombre y moneda llegan consistentes -- así que
 * este formulario es la fuente real para casi todo, tanto para un
 * proveedor importado de HETMO como para uno creado a mano. El sync nunca
 * borra lo que se complete acá: solo pisa un campo si HETMO trae un valor
 * real para ese campo puntual (ver syncProveedores en sync-service.ts).
 */
export const ProveedorEditModal: React.FC<ProveedorEditModalProps> = ({ proveedor, onClose }) => {
  const queryClient = useQueryClient();
  const esDeHetmo = proveedor?.codigoHetmo != null;

  const [formData, setFormData] = useState<ProveedorFacturacionPayload>({
    nombre: proveedor?.nombre || '',
    rut: proveedor?.rut || '',
    nombreFantasia: proveedor?.nombreFantasia || '',
    giroComercial: proveedor?.giroComercial || '',
    direccion: proveedor?.direccion || '',
    comuna: proveedor?.comuna || '',
    region: proveedor?.region || '',
    pais: proveedor?.pais || '',
    telefono: proveedor?.telefono || '',
    sitioWeb: proveedor?.sitioWeb || '',
    contactoNombre: proveedor?.contactoNombre || '',
    email: proveedor?.email || '',
    emailFacturacion: proveedor?.emailFacturacion || '',
    emailPedidos: proveedor?.emailPedidos || '',
    emailAvisoPago: proveedor?.emailAvisoPago || '',
    condicionesPago: proveedor?.condicionesPago || '',
    banco: proveedor?.banco || '',
    tipoCuenta: proveedor?.tipoCuenta || '',
    numeroCuenta: proveedor?.numeroCuenta || '',
    monedaDefecto: proveedor?.monedaDefecto || '',
    categoria: proveedor?.categoria || '',
    ibanSwift: proveedor?.ibanSwift || '',
  });
  const [generalError, setGeneralError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!proveedor) throw new Error('Proveedor no encontrado');
      return updateProveedor(proveedor.id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      onClose();
    },
    onError: (err: any) => {
      setGeneralError(err?.response?.data?.error || err?.message || 'Error al guardar el proveedor.');
    },
  });

  if (!proveedor) return null;

  const set = (field: keyof ProveedorFacturacionPayload) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2 first:pt-0">{children}</h3>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] animate-slide-up sm:animate-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#E34A26]/10 border border-[#E34A26]/20 flex items-center justify-center text-[#E34A26] shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight text-slate-900">{proveedor.nombre}</h2>
              <p className="text-[11px] text-slate-500">
                {esDeHetmo
                  ? 'Datos de facturación -- HETMO casi nunca trae esto lleno, se completa a mano igual'
                  : 'Datos de facturación -- proveedor creado a mano, sin fuente automática'}
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

          <SectionTitle>Identificación y Datos Tributarios</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Razón Social" value={formData.nombre} onChange={set('nombre')} required />
            <Input label="RUT" value={formData.rut || ''} onChange={set('rut')} placeholder="Ej: 76.123.456-7" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Nombre de Fantasía" value={formData.nombreFantasia || ''} onChange={set('nombreFantasia')} />
            <Input label="Giro Comercial" value={formData.giroComercial || ''} onChange={set('giroComercial')} />
          </div>
          <Input label="Dirección Fiscal / Casa Matriz" value={formData.direccion || ''} onChange={set('direccion')} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input label="Comuna" value={formData.comuna || ''} onChange={set('comuna')} />
            <Input label="Región" value={formData.region || ''} onChange={set('region')} />
            <Input label="País" value={formData.pais || ''} onChange={set('pais')} />
          </div>

          <SectionTitle>Contacto y Comunicación</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Email de Facturación Electrónica" type="email" value={formData.emailFacturacion || ''} onChange={set('emailFacturacion')} placeholder="Para recibir DTE (XML/PDF)" />
            <Input label="Teléfono" value={formData.telefono || ''} onChange={set('telefono')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Sitio Web" value={formData.sitioWeb || ''} onChange={set('sitioWeb')} />
            <Input label="Contacto Comercial / Ejecutivo" value={formData.contactoNombre || ''} onChange={set('contactoNombre')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Email General" type="email" value={formData.email || ''} onChange={set('email')} />
            <Input label="Email de Pedidos" type="email" value={formData.emailPedidos || ''} onChange={set('emailPedidos')} />
          </div>

          <SectionTitle>Datos Financieros y Comerciales</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Condiciones de Pago" value={formData.condicionesPago || ''} onChange={set('condicionesPago')} placeholder="Ej: 30 días, contado" />
            <Input label="Categoría" value={formData.categoria || ''} onChange={set('categoria')} placeholder="Ej: materias primas, transporte" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input label="Banco" value={formData.banco || ''} onChange={set('banco')} />
            <Input label="Tipo de Cuenta" value={formData.tipoCuenta || ''} onChange={set('tipoCuenta')} placeholder="Corriente, Vista..." />
            <Input label="Número de Cuenta" value={formData.numeroCuenta || ''} onChange={set('numeroCuenta')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input label="Email Aviso de Pago" type="email" value={formData.emailAvisoPago || ''} onChange={set('emailAvisoPago')} />
            <Input label="Moneda Predeterminada" value={formData.monedaDefecto || ''} onChange={set('monedaDefecto')} placeholder="CLP, USD, EUR..." />
          </div>
          <Input
            label="IBAN / SWIFT (solo transferencias internacionales)"
            value={formData.ibanSwift || ''}
            onChange={set('ibanSwift')}
          />

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

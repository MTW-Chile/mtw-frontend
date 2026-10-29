import React, { useState } from 'react';
import { Building2 } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { useMonedas, resolverMoneda } from '../../../lib/monedas';
import { updateProveedor, type ProveedorFacturacionPayload } from '../../../api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Proveedor } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';

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
 * pisa lo que se complete acá: HETMO solo completa campos vacíos (ver
 * dominio/catalogo/proveedores.ts en mtw-api).
 */
export const ProveedorEditModal: React.FC<ProveedorEditModalProps> = ({ proveedor, onClose }) => {
  const queryClient = useQueryClient();
  const esDeHetmo = (proveedor?.origenesHetmo?.length ?? 0) > 0;
  // La moneda se guarda con el codigo de HETMO ("2" = dolar): se elige y se
  // muestra por nombre y simbolo, nunca el codigo crudo.
  const monedas = useMonedas();

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

  const set = (field: keyof ProveedorFacturacionPayload) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const opcionesMoneda = monedas.map((m) => {
    const r = resolverMoneda(m.codigo, monedas);
    return { value: String(m.codigo), label: r.simbolo ? `${r.nombre} (${r.simbolo})` : r.nombre };
  });
  const monedaActual = formData.monedaDefecto || '';
  if (monedaActual && !opcionesMoneda.some((o) => o.value === monedaActual)) {
    const r = resolverMoneda(monedaActual, monedas);
    opcionesMoneda.push({ value: monedaActual, label: r.simbolo ? `${r.nombre} (${r.simbolo})` : r.nombre });
  }

  const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2 first:pt-0">{children}</h3>
  );

  return (
    <Modal
      titulo={proveedor.nombre}
      subtitulo={esDeHetmo
                  ? `Vinculado a HETMO (código ${proveedor.origenesHetmo!.map((o) => o.codigoHetmo).join(', ')}). Lo que edites acá no lo pisa el sync`
                  : 'Datos de facturación -- proveedor creado a mano, sin fuente automática'}
      icono={Building2}
      ancho="lg"
      onClose={onClose}
      onSubmit={(e) => {
            e.preventDefault();
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
      {generalError && <Aviso tono="peligro">{generalError}</Aviso>}

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
        <Select label="Moneda Predeterminada" value={monedaActual} onChange={set('monedaDefecto')}>
          <option value="">Sin definir</option>
          {opcionesMoneda.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <Input
        label="IBAN / SWIFT (solo transferencias internacionales)"
        value={formData.ibanSwift || ''}
        onChange={set('ibanSwift')}
      />

    </Modal>
  );
};

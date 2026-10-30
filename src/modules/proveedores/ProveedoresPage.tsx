import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { HeaderSeccion } from '../../components/layout/HeaderSeccion';
import { Button } from '../../components/ui/Button';
import { PAGE_CONTAINER_CLASS } from '../../lib/designSystem';
import { usePermisos } from '../../lib/permisos';
import { ProveedoresPanel } from '../cotizaciones/components/ProveedoresPanel';
import { ProveedorEditModal } from '../cotizaciones/components/ProveedorEditModal';

/** Comercial › Proveedores: datos de facturación de cada proveedor (antes dentro del Maestro). */
export const ProveedoresPage: React.FC = () => {
  const { tiene } = usePermisos();
  const [creando, setCreando] = useState(false);
  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <HeaderSeccion
        titulo="Proveedores"
        acciones={
          tiene('catalogo.editar') && (
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreando(true)}>
              Nuevo proveedor
            </Button>
          )
        }
      />
      <ProveedoresPanel />
      {creando && <ProveedorEditModal proveedor={null} onClose={() => setCreando(false)} />}
    </div>
  );
};

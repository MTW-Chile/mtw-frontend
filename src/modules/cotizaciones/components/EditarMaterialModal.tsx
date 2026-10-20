import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProveedores, getTiposProducto, getUnidadesMedida, updateMaterial } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { extraerErrorParaToast } from '../../../lib/toast';
import type { Material } from '../../../types';
import { Modal } from '../../../components/ui/Modal';
import { Casilla } from '../../../components/ui/Campos';
import { Aviso } from '../../../components/ui/Aviso';

/**
 * Edita lo que es del ERP en un material (docs/ARQUITECTURA.md 2.2): su tipo
 * de producto, su formato de compra propio (ej. un perfil que este proveedor
 * vende en barras de 6,5 m en vez de las 5,8 m del tipo) y su proveedor. Lo
 * que viene de HETMO (SKU, descripción, familia) no se edita acá.
 */
export const EditarMaterialModal: React.FC<{ material: Material; onClose: () => void }> = ({ material, onClose }) => {
  const queryClient = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ['tiposProducto'], queryFn: getTiposProducto });
  const { data: unidades = [] } = useQuery({ queryKey: ['unidadesMedida'], queryFn: getUnidadesMedida });
  const { data: proveedores = [] } = useQuery({ queryKey: ['proveedores'], queryFn: async () => (await getProveedores()).data });

  const [tipoProductoId, setTipoProductoId] = useState(material.tipoProductoId);
  const [formatoPropio, setFormatoPropio] = useState(material.unidadCompraId != null || material.factorCompra != null);
  const [unidadCompraId, setUnidadCompraId] = useState(material.unidadCompraId ?? '');
  const [factorCompra, setFactorCompra] = useState(material.factorCompra != null ? String(Number(material.factorCompra)) : '');
  const [proveedorId, setProveedorId] = useState(material.proveedorId ?? '');
  const [error, setError] = useState<string | null>(null);

  const tipo = tipos.find((t) => t.id === tipoProductoId);
  const factor = Number(factorCompra.replace(',', '.'));
  const formatoValido = !formatoPropio || (!!unidadCompraId && Number.isFinite(factor) && factor > 0);

  const guardar = useMutation({
    mutationFn: () =>
      updateMaterial(material.id, {
        tipoProductoId,
        unidadCompraId: formatoPropio ? unidadCompraId : null,
        factorCompra: formatoPropio ? factor : null,
        ...(proveedorId !== (material.proveedorId ?? '') ? { proveedorId: proveedorId || null } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materiales'] });
      // Cambia como se calcula el material en las versiones en curso.
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail'] });
      onClose();
    },
    onError: (err) => setError(extraerErrorParaToast(err).mensaje),
  });

  return (
    <Modal
      titulo={material.skuInterno}
      subtitulo={material.descripcion}
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={!formatoValido} isLoading={guardar.isPending}>
            Guardar
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}

      <Select
        label="Tipo de producto"
        options={tipos.filter((t) => t.activo || t.id === tipoProductoId).map((t) => ({ value: t.id, label: `${t.nombre} · ${t.partida.nombre}` }))}
        value={tipoProductoId}
        onChange={(e) => setTipoProductoId(e.target.value)}
        helperText={`Familia en HETMO: ${material.familia || '—'}`}
      />

      <div className="rounded-xl border border-slate-200 p-3.5 space-y-3">
        <Casilla
          checked={formatoPropio}
          onChange={setFormatoPropio}
          label="Formato de compra propio"
          descripcion={
            tipo
              ? `Por defecto se compra como su tipo: ${tipo.unidadCompra.nombre.toLowerCase()}${Number(tipo.factorCompra) !== 1 ? ` de ${Number(tipo.factorCompra).toLocaleString('es-CL')} ${tipo.unidadPrecio.simbolo}` : ''}.`
              : 'Por defecto se compra como su tipo.'
          }
        />
        {formatoPropio && (
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Unidad de compra"
              options={[{ value: '', label: 'Elige…' }, ...unidades.filter((u) => u.activa || u.id === unidadCompraId).map((u) => ({ value: u.id, label: `${u.nombre} (${u.simbolo})` }))]}
              value={unidadCompraId}
              onChange={(e) => setUnidadCompraId(e.target.value)}
            />
            <Input
              label={`${tipo?.unidadPrecio.simbolo ?? 'unid.'} por unidad`}
              inputMode="decimal"
              value={factorCompra}
              onChange={(e) => setFactorCompra(e.target.value)}
              placeholder="Ej: 6,5"
            />
          </div>
        )}
      </div>

      <Select
        label="Proveedor"
        options={[{ value: '', label: 'Sin proveedor asignado' }, ...proveedores.map((p) => ({ value: p.id, label: p.nombre }))]}
        value={proveedorId}
        onChange={(e) => setProveedorId(e.target.value)}
        helperText="Elegido a mano, el sync con HETMO ya no lo cambia."
      />
    </Modal>
  );
};

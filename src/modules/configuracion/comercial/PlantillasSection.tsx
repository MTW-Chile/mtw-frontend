import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, FileText } from 'lucide-react';
import { createPlantillaOferta, getPlantillasOferta, getTiposProyecto, updatePlantillaOferta, type PlantillaOfertaPayload } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { extraerErrorParaToast } from '../../../lib/toast';
import type { PlantillaOferta, TipoDocumentoComercial } from '../../../types';
import { Seccion } from '../../../components/ui/Seccion';
import { Interruptor, Textarea } from '../../../components/ui/Campos';
import { Cargando, ErrorCarga } from '../../../components/ui/Estados';
import { Modal } from '../../../components/ui/Modal';
import { Aviso } from '../../../components/ui/Aviso';
import { Tabla, Tbody, Td, Th, Thead, Tr } from '../../../components/ui/Tabla';

const ETIQUETA_DOCUMENTO: Record<TipoDocumentoComercial, string> = { COTIZACION: 'Cotización', ADICIONAL: 'Adicional' };

const PlantillaModal: React.FC<{ plantilla: PlantillaOferta | null; onClose: () => void }> = ({ plantilla, onClose }) => {
  const queryClient = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ['tiposProyecto'], queryFn: getTiposProyecto });
  const [form, setForm] = useState<PlantillaOfertaPayload>({
    nombre: plantilla?.nombre ?? '',
    tipoDocumento: plantilla?.tipoDocumento ?? 'COTIZACION',
    tipoProyectoId: plantilla?.tipoProyectoId ?? null,
    textoPresentacion: plantilla?.textoPresentacion ?? '',
    condicionesComerciales: plantilla?.condicionesComerciales ?? '',
    porDefecto: plantilla?.porDefecto ?? false,
    activa: plantilla?.activa ?? true,
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PlantillaOfertaPayload>(k: K, v: PlantillaOfertaPayload[K]) => setForm((f) => ({ ...f, [k]: v }));

  const guardar = useMutation({
    mutationFn: () => (plantilla ? updatePlantillaOferta(plantilla.id, form) : createPlantillaOferta(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantillasOferta'] });
      queryClient.invalidateQueries({ queryKey: ['plantillaProyecto'] });
      onClose();
    },
    onError: (err) => setError(extraerErrorParaToast(err).mensaje),
  });
  const completo = form.nombre.trim() && form.textoPresentacion.trim() && form.condicionesComerciales.trim();

  return (
    <Modal
      titulo={plantilla ? plantilla.nombre : 'Nueva plantilla'}
      icono={FileText}
      ancho="lg"
      onClose={onClose}
      cerrable={!guardar.isPending}
      pie={
        <Modal.Pie>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={!completo} isLoading={guardar.isPending}>
            Guardar
          </Button>
        </Modal.Pie>
      }
    >
      {error && <Aviso tono="peligro">{error}</Aviso>}
      <Input label="Nombre" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <Select
          label="Documento"
          options={[
            { value: 'COTIZACION', label: 'Cotización' },
            { value: 'ADICIONAL', label: 'Adicional' },
          ]}
          value={form.tipoDocumento}
          onChange={(e) => set('tipoDocumento', e.target.value as TipoDocumentoComercial)}
        />
        <Select
          label="Tipo de proyecto"
          options={[{ value: '', label: 'Todos (general)' }, ...tipos.filter((t) => t.activo || t.id === form.tipoProyectoId).map((t) => ({ value: t.id, label: t.nombre }))]}
          value={form.tipoProyectoId ?? ''}
          onChange={(e) => set('tipoProyectoId', e.target.value || null)}
        />
      </div>
      <Textarea label="Texto de presentación" rows={3} value={form.textoPresentacion} onChange={(e) => set('textoPresentacion', e.target.value)} />
      <Textarea
        label="Condiciones comerciales"
        rows={8}
        value={form.condicionesComerciales}
        onChange={(e) => set('condicionesComerciales', e.target.value)}
        helperText="Una condición por línea."
      />
      <div className="flex flex-wrap gap-5">
        <Interruptor valor={!!form.porDefecto} etiqueta="Por defecto" label="Por defecto para este documento y tipo de proyecto" onChange={(v) => set('porDefecto', v)} />
        <Interruptor valor={form.activa !== false} etiqueta="Activa" label="Activa" onChange={(v) => set('activa', v)} />
      </div>
    </Modal>
  );
};

/**
 * Plantillas de texto de presentación y condiciones comerciales, por documento
 * (cotización, adicional) y tipo de proyecto. Una cotización parte de la
 * plantilla por defecto de su tipo de proyecto (o la general) y se puede
 * cambiar o editar por versión.
 */
export const PlantillasSection: React.FC<{ puedeEditar: boolean }> = ({ puedeEditar }) => {
  const { data: plantillas = [], isLoading, isError, refetch } = useQuery({ queryKey: ['plantillasOferta', 'todas'], queryFn: () => getPlantillasOferta() });
  const [editando, setEditando] = useState<PlantillaOferta | 'nueva' | null>(null);

  if (isLoading) return <Cargando />;
  if (isError) return <ErrorCarga que="las plantillas" onReintentar={refetch} />;

  return (
    <>
      <Seccion
        titulo="Plantillas de textos"
        descripcion="Texto de presentación y condiciones comerciales de cotizaciones y adicionales, por tipo de proyecto. Cada versión parte de la plantilla por defecto y la puede cambiar o editar."
        sinRelleno
        acciones={
          puedeEditar ? (
            <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditando('nueva')}>
              Nueva plantilla
            </Button>
          ) : undefined
        }
      >
        <Tabla>
          <Thead>
            <Tr>
              <Th>Plantilla</Th>
              <Th>Documento</Th>
              <Th>Tipo de proyecto</Th>
              {puedeEditar && <Th alinear="derecha">Acciones</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {plantillas.map((p) => (
              <Tr key={p.id} tono={p.activa ? undefined : 'atenuada'}>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-900">{p.nombre}</span>
                    {p.porDefecto && <Badge size="sm" variant="brand">Por defecto</Badge>}
                    {!p.activa && <Badge size="sm" variant="default">Inactiva</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate max-w-md" title={p.textoPresentacion}>
                    {p.textoPresentacion}
                  </div>
                </Td>
                <Td>{ETIQUETA_DOCUMENTO[p.tipoDocumento]}</Td>
                <Td>{p.tipoProyecto?.nombre ?? 'Todos (general)'}</Td>
                {puedeEditar && (
                  <Td alinear="derecha">
                    <Button size="sm" variant="ghost" leftIcon={<Pencil className="w-3.5 h-3.5" />} onClick={() => setEditando(p)}>
                      Editar
                    </Button>
                  </Td>
                )}
              </Tr>
            ))}
          </Tbody>
          </Tabla>
      </Seccion>
      {editando && <PlantillaModal plantilla={editando === 'nueva' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
};

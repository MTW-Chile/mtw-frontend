import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, X, FileText, AlertCircle } from 'lucide-react';
import { createPlantillaOferta, getPlantillasOferta, getTiposProyecto, updatePlantillaOferta, type PlantillaOfertaPayload } from '../../../api/client';
import { TABLE_CLASS, TABLE_WRAPPER_CLASS } from '../../../lib/designSystem';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { extraerErrorParaToast } from '../../../lib/toast';
import type { PlantillaOferta, TipoDocumentoComercial } from '../../../types';
import { Cargando, ErrorCarga, Interruptor, Seccion } from '../catalogo/comun';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/10 border border-brand-600/20 flex items-center justify-center text-brand-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-sm font-black tracking-tight text-slate-900">{plantilla ? plantilla.nombre : 'Nueva plantilla'}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer" aria-label="Cerrar">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
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
          <label className="block space-y-1.5">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Texto de presentación</span>
            <textarea rows={3} value={form.textoPresentacion} onChange={(e) => set('textoPresentacion', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-600" />
          </label>
          <label className="block space-y-1.5">
            <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Condiciones comerciales</span>
            <textarea rows={8} value={form.condicionesComerciales} onChange={(e) => set('condicionesComerciales', e.target.value)} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-brand-600" />
            <span className="block text-[11px] text-slate-400">Una condición por línea.</span>
          </label>
          <div className="flex flex-wrap gap-5 text-xs">
            <label className="flex items-center gap-2">
              <Interruptor valor={!!form.porDefecto} etiqueta="Por defecto" onChange={(v) => set('porDefecto', v)} />
              <span>Por defecto para este documento y tipo de proyecto</span>
            </label>
            <label className="flex items-center gap-2">
              <Interruptor valor={form.activa !== false} etiqueta="Activa" onChange={(v) => set('activa', v)} />
              <span>Activa</span>
            </label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2.5 shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => guardar.mutate()} disabled={!completo} isLoading={guardar.isPending}>
            Guardar
          </Button>
        </div>
      </div>
    </div>
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
        accion={
          puedeEditar ? (
            <Button size="sm" variant="outline" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setEditando('nueva')}>
              Nueva plantilla
            </Button>
          ) : undefined
        }
      >
        <div className={TABLE_WRAPPER_CLASS}>
          <table className={`${TABLE_CLASS} text-left text-slate-700`}>
            <thead className="bg-slate-50/80 border-b border-slate-200 uppercase">
              <tr>
                <th className="py-3">Plantilla</th>
                <th className="py-3">Documento</th>
                <th className="py-3">Tipo de proyecto</th>
                {puedeEditar && <th className="py-3 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {plantillas.map((p) => (
                <tr key={p.id} className={`hover:bg-slate-50/80 ${p.activa ? '' : 'opacity-60'}`}>
                  <td className="py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">{p.nombre}</span>
                      {p.porDefecto && <Badge size="sm" variant="brand">Por defecto</Badge>}
                      {!p.activa && <Badge size="sm" variant="default">Inactiva</Badge>}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate max-w-md" title={p.textoPresentacion}>
                      {p.textoPresentacion}
                    </div>
                  </td>
                  <td className="py-2.5">{ETIQUETA_DOCUMENTO[p.tipoDocumento]}</td>
                  <td className="py-2.5">{p.tipoProyecto?.nombre ?? 'Todos (general)'}</td>
                  {puedeEditar && (
                    <td className="py-2.5 text-right">
                      <button onClick={() => setEditando(p)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-brand-600 hover:bg-brand-50 cursor-pointer">
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
      {editando && <PlantillaModal plantilla={editando === 'nueva' ? null : editando} onClose={() => setEditando(null)} />}
    </>
  );
};

import React from 'react';
import { User, AlertTriangle, Search, Plus, Unlink, Check } from 'lucide-react';
import type { Cliente, Proyecto } from '../../../../types';
import type { NuevoClienteForm } from '../../hooks/useCotizadorWorkspace';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Buscador } from '../../../../components/ui/Buscador';
import { BotonFila } from '../../../../components/ui/Lista';

interface ClienteManagerProps {
  proyecto: Proyecto;
  currentClient?: Cliente | null;
  clientMode: 'view' | 'select' | 'create';
  setClientMode: (mode: 'view' | 'select' | 'create') => void;
  searchClientTerm: string;
  setSearchClientTerm: (term: string) => void;
  filteredMasterClientes: Cliente[];
  nuevoCliente: NuevoClienteForm;
  onUpdateNuevoCliente: (field: keyof NuevoClienteForm, value: string) => void;
  onVincularCliente: (clienteId: string | null) => void;
  onCrearCliente: () => void;
  isCrearPending: boolean;
  embedded?: boolean;
}

export const ClienteManager: React.FC<ClienteManagerProps> = ({
  proyecto,
  currentClient,
  clientMode,
  setClientMode,
  searchClientTerm,
  setSearchClientTerm,
  filteredMasterClientes,
  nuevoCliente,
  onUpdateNuevoCliente,
  onVincularCliente,
  onCrearCliente,
  isCrearPending,
  embedded = false,
}) => {
  return (
    <section className={embedded ? 'space-y-3.5 sm:space-y-4' : 'rounded-2xl bg-white border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-600/10 text-brand-600 border border-brand-600/20 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Identificación Comercial
            </div>
            <div className="text-xs sm:text-sm font-bold text-slate-900">
              Identificación y Asignación del Cliente
            </div>
          </div>
        </div>
        <div className="text-[11px] sm:text-xs text-slate-500 font-medium self-start sm:self-auto">
          Origen HETMO: <strong className="text-slate-800">{proyecto.clienteNombreRaw || 'Sin nombre'}</strong> {proyecto.clienteRutRaw ? `(${proyecto.clienteRutRaw})` : ''}
        </div>
      </div>

      {/* CASO A: CLIENTE YA ASIGNADO FORMALMENTE */}
      {currentClient && clientMode === 'view' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Cliente Oficial Vinculado
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setClientMode('select')}>
                Cambiar cliente
              </Button>
              <Button variant="ghost" size="sm" className="text-rose-600! hover:bg-rose-50!" leftIcon={<Unlink className="w-3.5 h-3.5" />} title="Desvincular cliente de este proyecto" onClick={() => onVincularCliente(null)}>
                Desvincular
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-xs">
            <div>
              <span className="text-slate-500 block">Razón Social:</span>
              <strong className="text-slate-900 text-sm">{currentClient.nombre}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">RUT:</span>
              <strong className="text-slate-900 font-mono">{currentClient.rut || 'No registrado'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Giro Comercial:</span>
              <strong className="text-slate-800">{currentClient.giro || 'No especificado'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Contacto:</span>
              <strong className="text-slate-800">{currentClient.contacto || 'No especificado'}</strong>
            </div>
            <div>
              <span className="text-slate-500 block">Dirección Fiscal / Comuna:</span>
              <strong className="text-slate-800">
                {currentClient.direccion || 'No especificada'} {currentClient.localidad ? `(${currentClient.localidad})` : ''}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Teléfono / Email:</span>
              <strong className="text-slate-800">
                {currentClient.telefono || currentClient.email || 'No especificado'}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* CASO B: SIN CLIENTE ASIGNADO (ESTADO INICIAL) */}
      {!currentClient && clientMode === 'view' && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 mt-0.5 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900">Proyecto sin Cliente Oficial del Maestro</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Este proyecto se importó de HETMO con el nombre temporal <strong>"{proyecto.clienteNombreRaw}"</strong>. Para emitir presupuestos oficiales válidos y exportar a PDF, debes vincular un cliente de tu catálogo o registrar uno nuevo.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 pt-2">
            <Button variant="outline" className="w-full sm:w-auto" leftIcon={<Search className="w-3.5 h-3.5 text-brand-600" />} onClick={() => setClientMode('select')}>
              Buscar en maestro de clientes
            </Button>

            <Button className="w-full sm:w-auto" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={() => setClientMode('create')}>
              Crear y vincular nuevo cliente
            </Button>
          </div>
        </div>
      )}

      {/* MODO BUSCAR EN MAESTRO */}
      {clientMode === 'select' && (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-brand-600" />
              <span>Seleccionar Cliente del Maestro</span>
            </h4>
            <div className="flex items-center gap-2">
              <Button variant="link" size="sm" onClick={() => setClientMode('create')}>
                + Crear cliente nuevo
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setClientMode('view')}>
                Cancelar
              </Button>
            </div>
          </div>

          <Buscador valor={searchClientTerm} onChange={setSearchClientTerm} placeholder="Buscar por razón social o RUT…" />

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {filteredMasterClientes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <p>No hay clientes registrados en el Maestro con ese criterio.</p>
                <Button size="sm" onClick={() => setClientMode('create')}>
                  Crear "{searchClientTerm || 'nuevo cliente'}"
                </Button>
              </div>
            ) : (
              filteredMasterClientes.map((c) => (
                <BotonFila key={c.id} onClick={() => onVincularCliente(c.id)} className="group p-3.5! flex items-center justify-between">
                  <div>
                    <div className="font-bold text-xs text-slate-900 group-hover:text-brand-600 transition-colors">{c.nombre}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {c.rut || 'Sin RUT'} {c.localidad ? `· ${c.localidad}` : ''}
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-slate-100 group-hover:bg-brand-600 group-hover:text-white text-slate-700 text-xs font-semibold transition-all">Asignar</span>
                </BotonFila>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODO CREAR NUEVO CLIENTE */}
      {clientMode === 'create' && (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand-600" />
              <span>Registrar Nuevo Cliente en el Maestro</span>
            </h4>
            <Button variant="ghost" size="sm" onClick={() => setClientMode('view')}>
              Cancelar
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <Input label="Razón Social" required type="text" value={nuevoCliente.nombre} onChange={(e) => onUpdateNuevoCliente('nombre', e.target.value)} placeholder="Ej: Constructora San Felipe S.A." className="font-bold" />

            <Input label="RUT Fiscal" type="text" value={nuevoCliente.rut} onChange={(e) => onUpdateNuevoCliente('rut', e.target.value)} placeholder="Ej: 76.543.210-K" className="font-mono font-semibold" />

            <Input label="Giro Comercial" type="text" value={nuevoCliente.giro} onChange={(e) => onUpdateNuevoCliente('giro', e.target.value)} placeholder="Ej: Construcción de Edificios" />

            <Input label="Contacto Principal" type="text" value={nuevoCliente.contacto} onChange={(e) => onUpdateNuevoCliente('contacto', e.target.value)} placeholder="Ej: Marcelo Morales" />

            <Input label="Dirección Fiscal" type="text" value={nuevoCliente.direccion} onChange={(e) => onUpdateNuevoCliente('direccion', e.target.value)} placeholder="Ej: Av. Vitacura 5000, Of 301" />

            <Input label="Comuna / Ciudad" type="text" value={nuevoCliente.localidad} onChange={(e) => onUpdateNuevoCliente('localidad', e.target.value)} placeholder="Ej: Las Condes, Santiago" />

            <Input label="Teléfono" type="text" value={nuevoCliente.telefono} onChange={(e) => onUpdateNuevoCliente('telefono', e.target.value)} placeholder="+56 9 9876 5432" />

            <Input label="Correo Electrónico" type="text" value={nuevoCliente.email} onChange={(e) => onUpdateNuevoCliente('email', e.target.value)} placeholder="contacto@constructora.cl" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setClientMode('view')}>
              Cancelar
            </Button>

            <Button onClick={onCrearCliente} disabled={!nuevoCliente.nombre.trim()} isLoading={isCrearPending} leftIcon={<Check className="w-4 h-4" />}>
              Guardar en maestro y asignar
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};

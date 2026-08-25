import React from 'react';
import { User, AlertTriangle, Search, Plus, Unlink, Check } from 'lucide-react';
import type { Cliente, Proyecto } from '../../../../types';
import type { NuevoClienteForm } from '../../hooks/useCotizadorWorkspace';

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
}) => {
  return (
    <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
          <User className="w-4 h-4 text-[#E34A26]" />
          <span>1. Identificación y Asignación del Cliente</span>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Origen HETMO: <strong className="text-slate-800">{proyecto.clienteNombreRaw || 'Sin nombre'}</strong> ({proyecto.clienteRutRaw || 'Sin RUT'})
        </div>
      </div>

      {/* CASO A: CLIENTE YA ASIGNADO FORMALMENTE */}
      {currentClient && clientMode === 'view' && (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Cliente Oficial Vinculado
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setClientMode('select')}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-700 transition-colors shadow-sm"
              >
                Cambiar Cliente
              </button>
              <button
                onClick={() => onVincularCliente(null)}
                className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 text-xs font-semibold transition-colors"
                title="Desvincular cliente de este proyecto"
              >
                <Unlink className="w-3.5 h-3.5 inline mr-1" /> Desvincular
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1 text-xs">
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
        <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-amber-900">Proyecto sin Cliente Oficial del Maestro</h4>
              <p className="text-xs text-amber-800 leading-relaxed">
                Este proyecto se importó de HETMO con el nombre temporal <strong>"{proyecto.clienteNombreRaw}"</strong>. Para emitir presupuestos oficiales válidos y exportar a PDF, debes vincular un cliente de tu catálogo o registrar uno nuevo.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setClientMode('select')}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs shadow-sm flex items-center gap-2 transition-all"
            >
              <Search className="w-3.5 h-3.5 text-[#E34A26]" />
              <span>Buscar en Maestro de Clientes</span>
            </button>

            <button
              onClick={() => setClientMode('create')}
              className="px-4 py-2 rounded-xl bg-[#E34A26] hover:bg-[#C13615] text-white font-bold text-xs shadow-sm shadow-[#E34A26]/20 flex items-center gap-2 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Crear y Vincular Nuevo Cliente</span>
            </button>
          </div>
        </div>
      )}

      {/* MODO BUSCAR EN MAESTRO */}
      {clientMode === 'select' && (
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-[#E34A26]" />
              <span>Seleccionar Cliente del Maestro</span>
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setClientMode('create')}
                className="text-xs text-[#E34A26] font-bold hover:underline"
              >
                + Crear cliente nuevo
              </button>
              <button
                onClick={() => setClientMode('view')}
                className="text-xs text-slate-500 hover:text-slate-800 ml-3"
              >
                Cancelar
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchClientTerm}
              onChange={(e) => setSearchClientTerm(e.target.value)}
              placeholder="Buscar por Razón Social o RUT..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-[#E34A26]"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
            {filteredMasterClientes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <p>No hay clientes registrados en el Maestro con ese criterio.</p>
                <button
                  onClick={() => setClientMode('create')}
                  className="px-3 py-1.5 rounded-lg bg-[#E34A26] text-white text-xs font-bold shadow-sm"
                >
                  Crear "{searchClientTerm || 'Nuevo Cliente'}"
                </button>
              </div>
            ) : (
              filteredMasterClientes.map((c) => (
                <div
                  key={c.id}
                  onClick={() => onVincularCliente(c.id)}
                  className="p-3.5 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors group"
                >
                  <div>
                    <div className="font-bold text-xs text-slate-900 group-hover:text-[#E34A26] transition-colors">{c.nombre}</div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {c.rut || 'Sin RUT'} {c.localidad ? `· ${c.localidad}` : ''}
                    </div>
                  </div>
                  <button className="px-3 py-1 rounded-lg bg-slate-100 group-hover:bg-[#E34A26] group-hover:text-white text-slate-700 text-xs font-semibold transition-all">
                    Asignar
                  </button>
                </div>
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
              <Plus className="w-4 h-4 text-[#E34A26]" />
              <span>Registrar Nuevo Cliente en el Maestro</span>
            </h4>
            <button
              onClick={() => setClientMode('view')}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Razón Social *</label>
              <input
                type="text"
                value={nuevoCliente.nombre}
                onChange={(e) => onUpdateNuevoCliente('nombre', e.target.value)}
                placeholder="Ej: Constructora San Felipe S.A."
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-[#E34A26]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">RUT Fiscal</label>
              <input
                type="text"
                value={nuevoCliente.rut}
                onChange={(e) => onUpdateNuevoCliente('rut', e.target.value)}
                placeholder="Ej: 76.543.210-K"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#E34A26]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Giro Comercial</label>
              <input
                type="text"
                value={nuevoCliente.giro}
                onChange={(e) => onUpdateNuevoCliente('giro', e.target.value)}
                placeholder="Ej: Construcción de Edificios"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Contacto Principal</label>
              <input
                type="text"
                value={nuevoCliente.contacto}
                onChange={(e) => onUpdateNuevoCliente('contacto', e.target.value)}
                placeholder="Ej: Marcelo Morales"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Dirección Fiscal</label>
              <input
                type="text"
                value={nuevoCliente.direccion}
                onChange={(e) => onUpdateNuevoCliente('direccion', e.target.value)}
                placeholder="Ej: Av. Vitacura 5000, Of 301"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Comuna / Ciudad</label>
              <input
                type="text"
                value={nuevoCliente.localidad}
                onChange={(e) => onUpdateNuevoCliente('localidad', e.target.value)}
                placeholder="Ej: Las Condes, Santiago"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Teléfono</label>
              <input
                type="text"
                value={nuevoCliente.telefono}
                onChange={(e) => onUpdateNuevoCliente('telefono', e.target.value)}
                placeholder="+56 9 9876 5432"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Correo Electrónico</label>
              <input
                type="text"
                value={nuevoCliente.email}
                onChange={(e) => onUpdateNuevoCliente('email', e.target.value)}
                placeholder="contacto@constructora.cl"
                className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={() => setClientMode('view')}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-semibold text-xs transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={onCrearCliente}
              disabled={!nuevoCliente.nombre.trim() || isCrearPending}
              className="px-5 py-2 rounded-xl bg-[#E34A26] hover:bg-[#C13615] text-white font-bold text-xs shadow-md shadow-[#E34A26]/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isCrearPending ? 'Guardando...' : 'Guardar en Maestro y Asignar'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

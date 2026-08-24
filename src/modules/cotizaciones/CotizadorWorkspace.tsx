import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  Building2, 
  DollarSign, 
  Layers, 
  Boxes, 
  Ruler, 
  RotateCcw, 
  CheckCircle2, 
  ArrowRight,
  User,
  Coins,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  Calculator,
  FileText,
  Search,
  Plus,
  Unlink,
  Check,
  Building
} from 'lucide-react';
import { getProyectoById, updateVersionConfig, triggerManualSync, updateProyectoCliente, getClientes, createCliente } from '../../api/client';
import { formatNumber } from '../../lib/utils';
import type { Ventana, ProyectoVersion, Cliente } from '../../types';

interface CotizadorWorkspaceProps {
  proyectoId: string;
  onBack: () => void;
}

export const CotizadorWorkspace: React.FC<CotizadorWorkspaceProps> = ({ proyectoId, onBack }) => {
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const [showReimportModal, setShowReimportModal] = useState(false);

  // Form State para Paso 1 (Divisas)
  const [dolar, setDolar] = useState<string>('950');
  const [uf, setUf] = useState<string>('38500');
  const [euro, setEuro] = useState<string>('1030');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // UI State para Gestión de Clientes (Paso 1)
  const [clientMode, setClientMode] = useState<'view' | 'select' | 'create'>('view');
  const [searchClientTerm, setSearchClientTerm] = useState('');
  const [selectedMasterClientId, setSelectedMasterClientId] = useState<string | null>(null);

  // Form State para Crear Nuevo Cliente en el Maestro
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoRut, setNuevoRut] = useState('');
  const [nuevoGiro, setNuevoGiro] = useState('');
  const [nuevoDireccion, setNuevoDireccion] = useState('');
  const [nuevoLocalidad, setNuevoLocalidad] = useState('');
  const [nuevoContacto, setNuevoContacto] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoEmail, setNuevoEmail] = useState('');

  const { data: proyecto, isLoading, isError } = useQuery({
    queryKey: ['proyectoDetail', proyectoId],
    queryFn: () => getProyectoById(proyectoId),
    enabled: !!proyectoId,
  });

  const { data: clientesData } = useQuery({
    queryKey: ['clientesMaster'],
    queryFn: () => getClientes(),
  });

  const masterClientes: Cliente[] = clientesData?.data || [];

  const activeVersion: ProyectoVersion | undefined = 
    proyecto?.versiones[selectedVersionIdx] || proyecto?.versiones[0];

  useEffect(() => {
    if (activeVersion) {
      setDolar(activeVersion.tipoCambioDolar ? String(activeVersion.tipoCambioDolar) : '950');
      setUf(activeVersion.tipoCambioUF ? String(activeVersion.tipoCambioUF) : '38500');
      setEuro(activeVersion.tipoCambioEuro ? String(activeVersion.tipoCambioEuro) : '1030');
    }
    if (proyecto) {
      if (proyecto.cliente) {
        setSelectedMasterClientId(proyecto.cliente.id);
        setClientMode('view');
      } else {
        // Precargar formulario de creación con los datos crudos de HETMO como sugerencia
        setNuevoNombre(proyecto.clienteNombreRaw || '');
        setNuevoRut(proyecto.clienteRutRaw || '');
        setNuevoDireccion(proyecto.clienteDireccionRaw || '');
        setNuevoLocalidad(proyecto.clienteLocalidadRaw || '');
      }
    }
  }, [activeVersion, proyecto]);

  // Mutación para vincular un cliente existente del maestro
  const vincularClienteMutation = useMutation({
    mutationFn: async (clienteId: string | null) => {
      return updateProyectoCliente(proyectoId, clienteId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setClientMode('view');
    },
  });

  // Mutación para crear nuevo cliente en el maestro y vincularlo
  const crearClienteMutation = useMutation({
    mutationFn: async () => {
      const resp = await createCliente({
        nombre: nuevoNombre,
        rut: nuevoRut || null,
        giro: nuevoGiro || null,
        direccion: nuevoDireccion || null,
        localidad: nuevoLocalidad || null,
        contacto: nuevoContacto || null,
        telefono: nuevoTelefono || null,
        email: nuevoEmail || null,
      });
      if (resp.data?.id) {
        await updateProyectoCliente(proyectoId, resp.data.id);
      }
      return resp.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['clientesMaster'] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setClientMode('view');
    },
  });

  // Mutación para guardar divisas
  const updateConfigMutation = useMutation({
    mutationFn: async () => {
      if (!activeVersion) return;
      return updateVersionConfig(activeVersion.id, {
        tipoCambioDolar: dolar ? Number(dolar) : null,
        tipoCambioUF: uf ? Number(uf) : null,
        tipoCambioEuro: euro ? Number(euro) : null,
        estadoAprobacion: activeVersion.estadoAprobacion === 'BORRADOR' ? 'EN_COTIZACION' : activeVersion.estadoAprobacion,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
  });

  const reimportMutation = useMutation({
    mutationFn: async () => triggerManualSync(true),
    onSuccess: () => {
      setShowReimportModal(false);
      queryClient.invalidateQueries({ queryKey: ['proyectoDetail', proyectoId] });
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 text-slate-700">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-[#E34A26] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-mono">Cargando cotizador de la obra...</div>
        </div>
      </div>
    );
  }

  if (isError || !proyecto) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 text-slate-700">
        <div className="text-center space-y-4">
          <div className="text-red-500 font-bold text-sm">Error al cargar la obra.</div>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold text-white hover:bg-slate-700"
          >
            Volver al listado
          </button>
        </div>
      </div>
    );
  }

  const ventanas: Ventana[] = activeVersion?.ventanas || [];
  const currentClient = proyecto.cliente;

  // Filtrar clientes del maestro en el buscador
  const filteredMasterClientes = masterClientes.filter(c => {
    const term = searchClientTerm.toLowerCase().trim();
    if (!term) return true;
    return c.nombre.toLowerCase().includes(term) || (c.rut && c.rut.toLowerCase().includes(term));
  });

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 animate-fade-in">
      
      {/* HEADER SUPERIOR */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Obras</span>
          </button>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center font-bold text-xs">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900">{proyecto.obra}</h1>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-slate-100 border border-slate-300 text-slate-700">
                  {proyecto.codigoInterno || `PRJ-${proyecto.numeroPresupuesto}`}
                </span>
                {activeVersion?.esCongelado ? (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" /> Aprobado Gerencia
                  </span>
                ) : (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-[#E34A26]/10 border border-[#E34A26]/30 text-[#E34A26]">
                    {activeVersion?.estadoAprobacion || 'En Cotización'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {proyecto.versiones.length > 1 && (
            <div className="flex items-center rounded-xl p-1 bg-slate-100 border border-slate-200">
              {proyecto.versiones.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionIdx(idx)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    selectedVersionIdx === idx
                      ? 'bg-[#E34A26] text-white font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Rev {v.versionNumero}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setShowReimportModal(true)}
            disabled={activeVersion?.esCongelado}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 hover:border-amber-400 text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-40"
            title="Restablecer presupuesto leyendo los datos originales de HETMO"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
            <span className="hidden md:inline">Reimportar HETMO</span>
          </button>
        </div>
      </header>

      {/* STEPPER HORIZONTAL DE LOS 5 PASOS */}
      <div className="bg-white border-b border-slate-200 shadow-sm px-4 sm:px-8 py-3 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 min-w-max">
          {[
            { step: 1, label: 'Datos & Cliente' },
            { step: 2, label: 'Revisión de Líneas' },
            { step: 3, label: 'Analítica de Materiales' },
            { step: 4, label: 'Hoja de Fijación' },
            { step: 5, label: 'Consolidación & PDF' },
          ].map((s, idx) => (
            <React.Fragment key={s.step}>
              <button
                onClick={() => setCurrentStep(s.step as any)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  currentStep === s.step
                    ? 'bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/30 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  currentStep === s.step
                    ? 'bg-[#E34A26] text-white'
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {s.step}
                </span>
                <span>{s.label}</span>
              </button>
              {idx < 4 && (
                <span className="text-slate-300 font-bold">➔</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        
        {/* PASO 1 */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-fade-in">
            
            {/* Tarjetas de Resumen Técnico */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Total Ventanas</div>
                  <div className="text-lg font-bold font-mono text-slate-900">
                    {activeVersion?.totalVentanas || 0}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#E34A26]/10 text-[#E34A26] border border-[#E34A26]/20 flex items-center justify-center shrink-0">
                  <Ruler className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Superficie Total</div>
                  <div className="text-lg font-bold font-mono text-slate-900">
                    {formatNumber(activeVersion?.totalM2Ventanas, 2)} <span className="text-xs font-normal text-slate-500">m²</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Materiales Base</div>
                  <div className="text-lg font-bold font-mono text-slate-900">
                    {activeVersion?.totalMateriales || 0}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Importe Base HETMO</div>
                  <div className="text-lg font-bold font-mono text-emerald-600">
                    {activeVersion?.monedaSimbolo || '$'} {formatNumber(activeVersion?.importeTotal, 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 1: IDENTIFICACIÓN Y ASIGNACIÓN DE CLIENTE */}
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
                        onClick={() => vincularClienteMutation.mutate(null)}
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
                      <strong className="text-slate-800">{currentClient.direccion || 'No especificada'} {currentClient.localidad ? `(${currentClient.localidad})` : ''}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Teléfono / Email:</span>
                      <strong className="text-slate-800">{currentClient.telefono || currentClient.email || 'No especificado'}</strong>
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
                          onClick={() => vincularClienteMutation.mutate(c.id)}
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
                        value={nuevoNombre}
                        onChange={(e) => setNuevoNombre(e.target.value)}
                        placeholder="Ej: Constructora San Felipe S.A."
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-bold focus:outline-none focus:border-[#E34A26]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">RUT Fiscal</label>
                      <input
                        type="text"
                        value={nuevoRut}
                        onChange={(e) => setNuevoRut(e.target.value)}
                        placeholder="Ej: 76.543.210-K"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 font-mono font-semibold text-slate-900 focus:outline-none focus:border-[#E34A26]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Giro Comercial</label>
                      <input
                        type="text"
                        value={nuevoGiro}
                        onChange={(e) => setNuevoGiro(e.target.value)}
                        placeholder="Ej: Construcción de Edificios"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Contacto Principal</label>
                      <input
                        type="text"
                        value={nuevoContacto}
                        onChange={(e) => setNuevoContacto(e.target.value)}
                        placeholder="Ej: Marcelo Morales"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Dirección Fiscal</label>
                      <input
                        type="text"
                        value={nuevoDireccion}
                        onChange={(e) => setNuevoDireccion(e.target.value)}
                        placeholder="Ej: Av. Vitacura 5000, Of 301"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Comuna / Ciudad</label>
                      <input
                        type="text"
                        value={nuevoLocalidad}
                        onChange={(e) => setNuevoLocalidad(e.target.value)}
                        placeholder="Ej: Las Condes, Santiago"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Teléfono</label>
                      <input
                        type="text"
                        value={nuevoTelefono}
                        onChange={(e) => setNuevoTelefono(e.target.value)}
                        placeholder="+56 9 9876 5432"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:border-[#E34A26]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Correo Electrónico</label>
                      <input
                        type="text"
                        value={nuevoEmail}
                        onChange={(e) => setNuevoEmail(e.target.value)}
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
                      onClick={() => crearClienteMutation.mutate()}
                      disabled={!nuevoNombre.trim() || crearClienteMutation.isPending}
                      className="px-5 py-2 rounded-xl bg-[#E34A26] hover:bg-[#C13615] text-white font-bold text-xs shadow-md shadow-[#E34A26]/20 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      <span>{crearClienteMutation.isPending ? 'Guardando...' : 'Guardar en Maestro y Asignar'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: DIVISAS DE LA OBRA */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <Coins className="w-4 h-4 text-[#E34A26]" />
                  <span>2. Parámetros Económicos y Divisas de la Obra</span>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Valores específicos para este presupuesto
                </span>
              </div>

              <p className="text-xs text-slate-600">
                Define los tipos de cambio para convertir las compras internacionales (USD/EUR) al costo real en pesos chilenos y cotizar en UF.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Dólar Observado (USD)</span>
                    <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={dolar}
                    onChange={(e) => setDolar(e.target.value)}
                    placeholder="950.00"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-[#E34A26] transition-colors"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Unidad de Fomento (UF)</span>
                    <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={uf}
                    onChange={(e) => setUf(e.target.value)}
                    placeholder="38500.00"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-[#E34A26] transition-colors"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Euro Oficial (EUR)</span>
                    <span className="text-[10px] text-[#E34A26] font-mono font-bold">$ CLP</span>
                  </label>
                  <input
                    type="number"
                    value={euro}
                    onChange={(e) => setEuro(e.target.value)}
                    placeholder="1030.00"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-[#E34A26] transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: TIPOLOGÍAS IMPORTADAS */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                  <FileSpreadsheet className="w-4 h-4 text-[#E34A26]" />
                  <span>3. Tipologías Importadas de Fábrica ({ventanas.length} modelos)</span>
                </div>
                <span className="text-xs text-slate-500">
                  Total: <strong className="font-mono text-slate-900">{activeVersion?.totalVentanas} ventanas</strong>
                </span>
              </div>

              <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100 text-[11px] uppercase tracking-wider sticky top-0 text-slate-600">
                    <tr>
                      <th className="px-4 py-2.5 font-semibold">Línea</th>
                      <th className="px-4 py-2.5 font-semibold">Modelo</th>
                      <th className="px-4 py-2.5 font-semibold text-center">Uds</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Dimensiones (mm)</th>
                      <th className="px-4 py-2.5 font-semibold text-right">Superficie (m²)</th>
                      <th className="px-4 py-2.5 font-semibold">Acabado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {ventanas.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-slate-500">#{v.lineaHetmo}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-900">{v.modelo}</td>
                        <td className="px-4 py-2.5 text-center font-bold text-[#E34A26]">{v.unidades}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{formatNumber(v.anchoMm, 0)} × {formatNumber(v.altoMm, 0)}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{formatNumber(v.m2Ventana, 2)}</td>
                        <td className="px-4 py-2.5 text-slate-500">{v.acabadoCodigo || 'Estándar'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PASO 2 */}
        {currentStep === 2 && (
          <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Paso 2: Revisión de Líneas y Tipologías</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Inspección técnica de cada ventana con sus medidas, aperturas, comentarios de taller y precios unitarios.
            </p>
          </div>
        )}

        {/* PASO 3 */}
        {currentStep === 3 && (
          <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
              <Boxes className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Paso 3: Analítica de Materiales</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Ajuste macro de precios en moneda origen, reclasificación de familias, exclusión de vidrios fantasma y sustitución de productos.
            </p>
          </div>
        )}

        {/* PASO 4 */}
        {currentStep === 4 && (
          <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Paso 4: Hoja de Fijación y Extras</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Cálculo de fijaciones, tornillería, sellantes, grúas, traslados y mano de obra de instalación.
            </p>
          </div>
        )}

        {/* PASO 5 */}
        {currentStep === 5 && (
          <div className="p-12 text-center space-y-3 rounded-2xl bg-white border border-slate-200 shadow-sm animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-[#E34A26]/10 border border-[#E34A26]/30 flex items-center justify-center text-[#E34A26] mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Paso 5: Consolidación, Aprobación & PDF</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Resumen comercial, control de Aprobación de Gerencia y generación del Presupuesto final en PDF.
            </p>
          </div>
        )}

      </main>

      {/* FOOTER INFERIOR */}
      <footer className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5 animate-fade-in">
              <CheckCircle2 className="w-4 h-4" /> Parámetros guardados con éxito en la base de datos
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentStep > 1 && (
            <button
              onClick={() => setCurrentStep((prev) => (prev - 1) as any)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-colors border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
            >
              ← Paso Anterior
            </button>
          )}

          {currentStep === 1 && (
            <button
              onClick={() => {
                updateConfigMutation.mutate();
                setCurrentStep(2);
              }}
              disabled={updateConfigMutation.isPending}
              className="px-5 py-2.5 rounded-xl bg-[#E34A26] hover:bg-[#C13615] text-white font-bold text-xs shadow-lg shadow-[#E34A26]/20 transition-all flex items-center gap-2"
            >
              <span>Guardar y Pasar a Revisión de Líneas</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          {currentStep > 1 && currentStep < 5 && (
            <button
              onClick={() => setCurrentStep((prev) => (prev + 1) as any)}
              className="px-5 py-2.5 rounded-xl bg-[#E34A26] hover:bg-[#C13615] text-white font-bold text-xs shadow-lg shadow-[#E34A26]/20 transition-all flex items-center gap-2"
            >
              <span>Continuar al Paso {currentStep + 1}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </footer>

      {/* MODAL REIMPORTAR HETMO */}
      {showReimportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4 border bg-white border-amber-300">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-base font-bold text-slate-900">¿Reimportar desde HETMO?</h3>
              <p className="text-xs text-slate-600">
                Esta acción volverá a leer los datos crudos desde SQL Server. Si realizaste modificaciones personalizadas de precios o sustituciones en esta versión, se restablecerán a los valores originales de fábrica.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowReimportModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-colors bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => reimportMutation.mutate()}
                disabled={reimportMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${reimportMutation.isPending ? 'animate-spin' : ''}`} />
                <span>{reimportMutation.isPending ? 'Reimportando...' : 'Sí, Reimportar'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

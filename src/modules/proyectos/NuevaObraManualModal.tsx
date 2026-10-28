import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crearObraManual, getNumeroObraManual } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { ClientePicker } from '../clientes/ClientePicker';
import type { Cliente, Proyecto } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { extraerErrorParaToast } from '../../lib/toast';

interface Props {
  onClose: () => void;
  onCreada: (proyecto: Proyecto) => void;
}

// Obra que ya esta en curso y nunca se cotizo (cada piso es un documento
// suelto de HETMO). Nace ya aceptada, sin presupuesto: despues se le vinculan
// sus documentos de fabricacion desde la seccion Fabricacion. Exige un cliente
// del maestro (adjuntar o crear), igual que el presupuesto manual de
// Cotizaciones, y el numero de proyecto: el mismo que lleva su carpeta de
// OneDrive y que forma el codigo PRJ-año-numero, como en las obras de HETMO.
// La API comprueba que no choque con una obra existente; aqui se avisa al
// escribirlo para no esperar al "Crear".
//
// No usa <form>: el selector de cliente puede abrir el formulario de cliente
// y sus eventos de envio no deben llegar a este modal.
export const NuevaObraManualModal: React.FC<Props> = ({ onClose, onCreada }) => {
  const queryClient = useQueryClient();
  const [obra, setObra] = useState('');
  // null = la persona no ha escrito: se muestra el siguiente numero libre.
  const [numeroEscrito, setNumeroEscrito] = useState<string | null>(null);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [direccion, setDireccion] = useState('');

  // Siguiente numero libre, como sugerencia inicial (se puede cambiar).
  const siguiente = useQuery({ queryKey: ['obraManual', 'siguienteNumero'], queryFn: () => getNumeroObraManual(), staleTime: 0 });
  const numero = numeroEscrito ?? (siguiente.data ? String(siguiente.data.siguiente) : '');
  const numeroTocado = numeroEscrito !== null;
  const numeroValido = /^\d+$/.test(numero.trim()) && Number(numero) > 0 ? Number(numero) : null;

  // Comprueba el numero escrito cuando la persona deja de escribir.
  const [numeroAConsultar, setNumeroAConsultar] = useState<number | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNumeroAConsultar(numeroValido), 350);
    return () => clearTimeout(t);
  }, [numeroValido]);
  const disponibilidad = useQuery({
    queryKey: ['obraManual', 'numero', numeroAConsultar],
    queryFn: () => getNumeroObraManual(numeroAConsultar!),
    enabled: numeroAConsultar !== null,
    staleTime: 0,
  });
  const comprobado = disponibilidad.data && disponibilidad.data.numero === numeroValido ? disponibilidad.data : null;
  const ocupado = comprobado?.disponible === false;

  const errorNumero = numeroTocado && numero.trim() !== '' && numeroValido === null
    ? 'Escribe un número entero mayor que cero.'
    : ocupado
      ? `Ya lo usa la obra "${comprobado!.usadoPor?.obra}"${comprobado!.usadoPor?.codigoInterno ? ` (${comprobado!.usadoPor.codigoInterno})` : ''}.`
      : undefined;
  const ayudaNumero = numeroValido && comprobado?.disponible
    ? `Disponible. La obra quedará como PRJ-${new Date().getFullYear()}-${numeroValido}.`
    : 'El que lleva la carpeta de OneDrive de la obra. Sugerido: el siguiente libre.';

  const puedeCrear = !!obra.trim() && !!cliente && numeroValido !== null && !ocupado;

  const crear = useMutation({
    mutationFn: () =>
      crearObraManual({
        obra: obra.trim(),
        clienteId: cliente!.id,
        numeroPresupuesto: numeroValido!,
        direccion: direccion.trim() || undefined,
      }),
    onSuccess: ({ proyecto }) => {
      queryClient.invalidateQueries({ queryKey: ['proyectos'] });
      queryClient.invalidateQueries({ queryKey: ['proyectosCount'] });
      onCreada(proyecto);
    },
  });
  const errorCrear = crear.error ? extraerErrorParaToast(crear.error).mensaje : null;

  const enviar = () => {
    if (puedeCrear && !crear.isPending) crear.mutate();
  };
  const alEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') enviar();
  };

  return (
    <Modal
      titulo="Nueva obra manual"
      ancho="sm"
      onClose={onClose}
      pie={
        <Modal.Pie>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" size="sm" disabled={!puedeCrear} isLoading={crear.isPending} onClick={enviar}>
            Crear obra
          </Button>
        </Modal.Pie>
      }
    >
      <p className="text-xs text-slate-500">
        Para una obra que ya está en curso y nunca se cotizó. Nace aceptada y sin presupuesto: después le vinculas sus
        documentos de fabricación desde Taller › Fabricación.
      </p>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <Input
              label="N° de proyecto"
              id="obra-manual-numero"
              inputMode="numeric"
              value={numero}
              onChange={(e) => setNumeroEscrito(e.target.value.replace(/[^\d]/g, ''))}
              onKeyDown={alEnter}
              placeholder={siguiente.data ? String(siguiente.data.siguiente) : '…'}
              maxLength={10}
              error={errorNumero}
              rightIcon={disponibilidad.isFetching ? <span className="text-[10px] text-slate-400">…</span> : undefined}
            />
          </div>
          <div className="col-span-2">
            <Input label="Obra" id="obra-manual-nombre" autoFocus value={obra} onChange={(e) => setObra(e.target.value)} onKeyDown={alEnter} placeholder="Nombre de la obra" maxLength={200} />
          </div>
        </div>
        {!errorNumero && <p className="text-[11px] text-slate-500 -mt-1">{ayudaNumero}</p>}
        <ClientePicker value={cliente} onChange={setCliente} />
        <div>
          <Input
            label="Dirección de la obra (opcional)"
            id="obra-manual-direccion"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            onKeyDown={alEnter}
            placeholder="Si se deja vacía, se usa la del cliente"
            maxLength={300}
          />
        </div>
        {errorCrear && (
          <p className="text-xs text-rose-700 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2" role="alert">
            {errorCrear}
          </p>
        )}
      </div>
    </Modal>
  );
};

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';

interface ReimportModalProps {
  isOpen: boolean;
  isPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ReimportModal: React.FC<ReimportModalProps> = ({ isOpen, isPending, onClose, onConfirm }) => {
  if (!isOpen) return null;
  return (
    <Modal
      icono={AlertTriangle}
      ancho="sm"
      titulo="¿Reimportar desde HETMO?"
      onClose={onClose}
      cerrable={!isPending}
      pie={
        <Modal.Pie>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={isPending} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
            Sí, reimportar
          </Button>
        </Modal.Pie>
      }
    >
      <p className="text-xs text-slate-600">
        Esta acción vuelve a leer los datos originales de HETMO. Si modificaste precios o sustituiste materiales en esta versión, se restablecen a los valores
        originales.
      </p>
    </Modal>
  );
};

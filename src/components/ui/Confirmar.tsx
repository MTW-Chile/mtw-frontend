import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Textarea } from './Campos';

interface OpcionesConfirmar {
  titulo: string;
  mensaje?: React.ReactNode;
  /** Texto del botón de confirmar (por defecto "Confirmar"). */
  confirmar?: string;
  /** Acción destructiva: botón rojo. */
  peligro?: boolean;
}

interface OpcionesTexto extends OpcionesConfirmar {
  etiqueta: string;
  /** Sin texto no se puede confirmar. */
  requerido?: boolean;
  valorInicial?: string;
}

type Pedido =
  | ({ tipo: 'confirmar'; resolver: (v: boolean) => void } & OpcionesConfirmar)
  | ({ tipo: 'texto'; resolver: (v: string | null) => void } & OpcionesTexto);

const Contexto = createContext<{
  confirmar: (o: OpcionesConfirmar) => Promise<boolean>;
  pedirTexto: (o: OpcionesTexto) => Promise<string | null>;
} | null>(null);

/**
 * Reemplaza window.confirm y window.prompt (DESIGN.md 5) por un modal del
 * sistema de diseño, con la misma forma de uso:
 *
 *   const { confirmar, pedirTexto } = useConfirmar();
 *   if (!(await confirmar({ titulo: '¿Anular el adicional?', peligro: true, confirmar: 'Anular' }))) return;
 *   const motivo = await pedirTexto({ titulo: 'Rechazo', etiqueta: 'Motivo', requerido: true });
 */
export const ConfirmarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [texto, setTexto] = useState('');
  const pedidoRef = useRef<Pedido | null>(null);
  pedidoRef.current = pedido;

  const confirmar = useCallback(
    (o: OpcionesConfirmar) => new Promise<boolean>((resolver) => setPedido({ tipo: 'confirmar', resolver, ...o })),
    []
  );
  const pedirTexto = useCallback(
    (o: OpcionesTexto) =>
      new Promise<string | null>((resolver) => {
        setTexto(o.valorInicial ?? '');
        setPedido({ tipo: 'texto', resolver, ...o });
      }),
    []
  );

  const cerrar = (aceptado: boolean) => {
    const p = pedidoRef.current;
    if (!p) return;
    if (p.tipo === 'confirmar') p.resolver(aceptado);
    else p.resolver(aceptado ? texto.trim() : null);
    setPedido(null);
  };

  const puedeAceptar = !pedido || pedido.tipo !== 'texto' || !pedido.requerido || !!texto.trim();

  return (
    <Contexto.Provider value={{ confirmar, pedirTexto }}>
      {children}
      {pedido && (
        <Modal
          titulo={pedido.titulo}
          icono={pedido.peligro ? AlertTriangle : HelpCircle}
          ancho="sm"
          onClose={() => cerrar(false)}
          pie={
            <Modal.Pie>
              <Button variant="outline" onClick={() => cerrar(false)}>
                Cancelar
              </Button>
              <Button variant={pedido.peligro ? 'danger' : 'primary'} disabled={!puedeAceptar} onClick={() => cerrar(true)}>
                {pedido.confirmar ?? 'Confirmar'}
              </Button>
            </Modal.Pie>
          }
        >
          {pedido.mensaje && <div className="text-xs text-slate-600 leading-relaxed">{pedido.mensaje}</div>}
          {pedido.tipo === 'texto' && (
            <Textarea
              label={pedido.etiqueta}
              autoFocus
              rows={3}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && puedeAceptar) {
                  e.preventDefault();
                  cerrar(true);
                }
              }}
            />
          )}
        </Modal>
      )}
    </Contexto.Provider>
  );
};

export function useConfirmar() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useConfirmar necesita <ConfirmarProvider> (ver App.tsx).');
  return ctx;
}

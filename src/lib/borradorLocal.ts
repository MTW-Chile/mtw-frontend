/**
 * Borradores guardados en este dispositivo (IndexedDB), para que un trabajo a
 * medio hacer en terreno no se pierda si se sale de la pantalla, el navegador
 * recarga la pestaña (pasa en tablets al volver de la cámara) o se corta la
 * batería. IndexedDB guarda las fotos (File) tal cual; localStorage no puede.
 *
 * Nunca lanza: si el navegador no deja usar IndexedDB (modo privado, cuota
 * llena), simplemente no hay borrador y la pantalla funciona igual.
 */
const BASE = 'mtw-borradores';
const ALMACEN = 'borradores';

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolver) => {
    try {
      if (typeof indexedDB === 'undefined') return resolver(null);
      const pedido = indexedDB.open(BASE, 1);
      pedido.onupgradeneeded = () => {
        if (!pedido.result.objectStoreNames.contains(ALMACEN)) pedido.result.createObjectStore(ALMACEN);
      };
      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => resolver(null);
      pedido.onblocked = () => resolver(null);
    } catch {
      resolver(null);
    }
  });
}

async function operar<T>(modo: IDBTransactionMode, accion: (almacen: IDBObjectStore) => IDBRequest | null): Promise<T | null> {
  const db = await abrir();
  if (!db) return null;
  return new Promise((resolver) => {
    try {
      const tx = db.transaction(ALMACEN, modo);
      const pedido = accion(tx.objectStore(ALMACEN));
      tx.oncomplete = () => {
        db.close();
        resolver(pedido ? ((pedido.result as T) ?? null) : null);
      };
      tx.onerror = () => {
        db.close();
        resolver(null);
      };
      tx.onabort = () => {
        db.close();
        resolver(null);
      };
    } catch {
      db.close();
      resolver(null);
    }
  });
}

export function leerBorrador<T>(clave: string): Promise<T | null> {
  return operar<T>('readonly', (a) => a.get(clave));
}

export async function guardarBorrador<T>(clave: string, valor: T): Promise<void> {
  await operar('readwrite', (a) => a.put(valor, clave));
}

export async function borrarBorrador(clave: string): Promise<void> {
  await operar('readwrite', (a) => a.delete(clave));
}

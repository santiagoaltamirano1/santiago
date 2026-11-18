// Lumi Finance · Acceso a Firestore del MOTOR (corre en el navegador, con el SDK cliente de Firebase).
// Versión de prueba (Starter Tier de AI Studio): la app escribe en Firestore protegida por firestore.rules
// (cada persona solo lee y escribe usuarios/{su uid}/...). El servidor ya no toca Firestore.
// Este archivo da una forma sencilla de leer y escribir (col().doc().get(), transaccion(...)) para que
// motor/dinero.ts, altas.ts y reportes.ts no dependan de los detalles del SDK.
import {
  type Firestore, type DocumentReference, type Query, type CollectionReference, type DocumentSnapshot,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, query, where, limit, runTransaction, getCountFromServer,
} from 'firebase/firestore';

let bd: Firestore | null = null;
/** La app (src/services/firebase.ts) o las pruebas indican qué base usar. */
export const usarBd = (b: Firestore) => { bd = b; };
const base = () => { if (!bd) throw new Error('BD_SIN_CONFIGURAR: falta conectar Firestore'); return bd; };

export interface Foto { id: string; exists: boolean; data: () => any }
const foto = (s: DocumentSnapshot): Foto => ({ id: s.id, exists: s.exists(), data: () => s.data() });

export class Doc {
  constructor(public ref: DocumentReference) {}
  async get(): Promise<Foto> { return foto(await getDoc(this.ref)); }
  set(datos: Record<string, unknown>, opciones?: { merge: boolean }) { return opciones ? setDoc(this.ref, datos, opciones) : setDoc(this.ref, datos); }
  update(datos: Record<string, unknown>) { return updateDoc(this.ref, datos); }
}

export class Consulta {
  constructor(public q: Query) {}
  where(campo: string, op: '==' | '>=' | '<=' | '>' | '<', valor: unknown) { return new Consulta(query(this.q, where(campo, op, valor))); }
  limit(n: number) { return new Consulta(query(this.q, limit(n))); }
  async get() {
    const s = await getDocs(this.q);
    return { empty: s.empty, size: s.size, docs: s.docs.map((d) => ({ id: d.id, exists: true, data: () => d.data() })) };
  }
  count() { return { get: async () => { const n = (await getCountFromServer(this.q)).data().count; return { data: () => ({ count: n }) }; } }; }
}

export class Coleccion extends Consulta {
  constructor(public c: CollectionReference) { super(c); }
  doc(id: string) { return new Doc(doc(this.c, id)); }
}

export type NombreColeccion = 'cuentas' | 'categorias' | 'metas' | 'deudas' | 'movimientos' | 'capturas' | 'exportaciones';
export const col = (uid: string, c: NombreColeccion) => new Coleccion(collection(base(), 'usuarios', uid, c));
export const docUsuario = (uid: string) => new Doc(doc(base(), 'usuarios', uid));

/** Transacción: o se guarda todo o nada. Leer SIEMPRE antes de escribir.
 *  Las consultas (where/limit) se leen fuera de la transacción (el SDK cliente no las permite dentro). */
export interface Tx {
  get(x: Doc): Promise<Foto>;
  get(x: Consulta): ReturnType<Consulta['get']>;
  set(ref: Doc, datos: Record<string, unknown>): void;
  update(ref: Doc, datos: Record<string, unknown>): void;
}
export function transaccion<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runTransaction(base(), async (t) => {
    const tx: Tx = {
      get: (async (x: Doc | Consulta) => (x instanceof Doc ? foto(await t.get(x.ref)) : x.get())) as Tx['get'],
      set: (ref, datos) => { t.set(ref.ref, datos); },
      update: (ref, datos) => { t.update(ref.ref, datos); },
    };
    return fn(tx);
  });
}

export const nuevoId = () => crypto.randomUUID();

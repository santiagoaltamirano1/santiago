// Lumi Finance · Iteración 2 · F6 · Set de evaluación de la voz (MESA_VOZ_v2.md §1): 30 frases difíciles colombianas.
// Lo usa /api/dev/evaluar-voz (corre el modelo) y server/voz/calificador.ts (califica).
// NO se usa para escribir los ejemplos del prompt (los ejemplos de voz-v2 son otras frases), para no "aprenderse" el examen.
import type { Contexto } from "./prompt.ts";

export const HOY_EVAL = "2026-11-18"; // miércoles
export const CUENTA_DEFECTO_EVAL = "c-efe";

export const CTX_EVAL: Contexto = {
  cuentas: [
    { id: "c-efe", nombre: "Efectivo", tipo: "efectivo", moneda: "COP" },
    { id: "c-neq", nombre: "Nequi", tipo: "bolsillo", moneda: "COP" },
    { id: "c-ban", nombre: "Bancolombia", tipo: "ahorro", moneda: "COP" },
    { id: "c-vis", nombre: "Visa", tipo: "tarjeta", moneda: "COP" },
  ],
  categorias: [
    { id: "g-com", nombre: "Comida", tipo: "gasto" }, { id: "g-tra", nombre: "Transporte", tipo: "gasto" },
    { id: "g-mer", nombre: "Mercado", tipo: "gasto" }, { id: "g-ser", nombre: "Servicios", tipo: "gasto" },
    { id: "g-sal", nombre: "Salidas", tipo: "gasto" }, { id: "g-sau", nombre: "Salud", tipo: "gasto" },
    { id: "g-otr", nombre: "Otros gastos", tipo: "gasto" },
    { id: "i-sal", nombre: "Salario", tipo: "ingreso" }, { id: "i-fre", nombre: "Freelance", tipo: "ingreso" },
    { id: "i-reg", nombre: "Regalos", tipo: "ingreso" }, { id: "i-otr", nombre: "Otros ingresos", tipo: "ingreso" },
  ],
  metas: [{ id: "m-mac", nombre: "MacBook" }, { id: "m-car", nombre: "Viaje Cartagena" }],
  deudas: [
    { id: "d-fin", contraparte: "Financiera", concepto: "Crédito", moneda: "COP", relacion: "le debo", pendiente: 3000000 },
    { id: "d-jua", contraparte: "Juan", concepto: "Préstamo", moneda: "COP", relacion: "me debe", pendiente: 200000 },
    { id: "d-mam", contraparte: "Mamá", concepto: "Préstamo", moneda: "COP", relacion: "le debo", pendiente: 0 },
  ],
};

export interface Esperado {
  tipo: string | string[];
  monto: number;
  moneda?: string;                       // por defecto COP
  cuenta?: string | null;                // id esperado (null = debe quedar sin cuenta)
  destino?: string | null;
  categoria?: string | null | (string | null)[];
  meta?: string | null;
  deuda?: string | null;
  fecha?: string | null;                 // null = hoy
}
export interface CasoEval { n: number; frase: string; esperado: Esperado[]; dudas?: string[][]; nota?: string }

// dudas: por cada movimiento esperado, los campos de los que DEBE preguntar (al menos uno de la lista)
export const SET_EVAL: CasoEval[] = [
  { n: 1, frase: "me gasté 25 lucas en almuerzo", esperado: [{ tipo: "gasto", monto: 25000, cuenta: "c-efe", categoria: "g-com" }] },
  { n: 2, frase: "pagué un palo y medio de arriendo por Bancolombia", esperado: [{ tipo: "gasto", monto: 1500000, cuenta: "c-ban", categoria: null }], dudas: [["categoria"]] },
  { n: 3, frase: "taxi 18 mil y TransMilenio 2.950 con Nequi", esperado: [{ tipo: "gasto", monto: 18000, cuenta: "c-neq", categoria: "g-tra" }, { tipo: "gasto", monto: 2950, cuenta: "c-neq", categoria: "g-tra" }] },
  { n: 4, frase: "me llegó la quincena, 2 palos 300 a Bancolombia", esperado: [{ tipo: "ingreso", monto: 2300000, cuenta: "c-ban", categoria: "i-sal" }] },
  { n: 5, frase: "pasé 200 mil de Bancolombia a Nequi", esperado: [{ tipo: "transferencia", monto: 200000, cuenta: "c-ban", destino: "c-neq" }] },
  { n: 6, frase: "saqué 100 lucas del cajero", esperado: [{ tipo: "transferencia", monto: 100000, cuenta: "c-ban", destino: "c-efe" }] },
  { n: 7, frase: "aparté 300 mil para el viaje a Cartagena", esperado: [{ tipo: "aporte_meta", monto: 300000, meta: "m-car" }] },
  { n: 8, frase: "saqué 500 mil de la plata del Mac", esperado: [{ tipo: "retiro_meta", monto: 500000, meta: "m-mac" }] },
  { n: 9, frase: "le aboné 150 a la financiera por Nequi", esperado: [{ tipo: "abono_capital", monto: 150000, cuenta: "c-neq", deuda: "d-fin" }] },
  { n: 10, frase: "Juan me pagó 50 mil de lo que me debía, me lo mandó a Nequi", esperado: [{ tipo: "abono_capital", monto: 50000, cuenta: "c-neq", deuda: "d-jua" }] },
  { n: 11, frase: "mi mamá me prestó 400 mil", esperado: [{ tipo: "prestamo_capital", monto: 400000, cuenta: "c-efe", deuda: "d-mam" }] },
  { n: 12, frase: "le presté 80 lucas a Camilo", esperado: [{ tipo: "prestamo_capital", monto: 80000, cuenta: "c-efe", deuda: null }], dudas: [["deuda"]] },
  { n: 13, frase: "ayer en la noche gasté 60 mil en cerveza", esperado: [{ tipo: "gasto", monto: 60000, cuenta: "c-efe", categoria: "g-sal", fecha: "2026-11-17" }] },
  { n: 14, frase: "el lunes pagué el internet, 95 mil", esperado: [{ tipo: "gasto", monto: 95000, cuenta: "c-efe", categoria: "g-ser", fecha: "2026-11-16" }] },
  { n: 15, frase: "el 3 de noviembre me pagaron un freelance de 400 dólares", esperado: [{ tipo: "ingreso", monto: 400, moneda: "USD", cuenta: "c-efe", categoria: "i-fre", fecha: "2026-11-03" }] },
  { n: 16, frase: "pagué 20 dólares de Netflix con la Visa", esperado: [{ tipo: "gasto", monto: 20, moneda: "USD", cuenta: "c-vis", categoria: "g-ser" }] },
  { n: 17, frase: "compré mercado por 180 mil, no, mejor dicho fueron 185", esperado: [{ tipo: "gasto", monto: 185000, cuenta: "c-efe", categoria: "g-mer" }] },
  { n: 18, frase: "gasté 30 mil en el almuerzo… no espera, 20 mil", esperado: [{ tipo: "gasto", monto: 20000, cuenta: "c-efe", categoria: "g-com" }] },
  { n: 19, frase: "puse 50 mil en Daviplata", esperado: [{ tipo: ["transferencia", "ingreso", "gasto"], monto: 50000 }], dudas: [["cuenta", "destino"]], nota: "Daviplata no existe: no se puede resolver en silencio" },
  { n: 20, frase: "como 20 o 30 mil en domicilios", esperado: [{ tipo: "gasto", monto: 20000, cuenta: "c-efe", categoria: "g-com" }], dudas: [["monto"]] },
  { n: 21, frase: "media luca de chicle", esperado: [{ tipo: "gasto", monto: 500, cuenta: "c-efe", categoria: ["g-com", "g-otr"] }] },
  { n: 22, frase: "una gamba para el mercado", esperado: [{ tipo: "gasto", monto: 100000, cuenta: "c-efe", categoria: "g-mer" }] },
  { n: 23, frase: "eh pues este hoy hoy compré un un tinto de 3 mil eh", esperado: [{ tipo: "gasto", monto: 3000, cuenta: "c-efe", categoria: "g-com" }] },
  { n: 24, frase: "recibí 120 mil de regalo de cumpleaños de mi tía y me gasté 40 en la torta", esperado: [{ tipo: "ingreso", monto: 120000, cuenta: "c-efe", categoria: "i-reg" }, { tipo: "gasto", monto: 40000, cuenta: "c-efe", categoria: "g-com" }] },
  { n: 25, frase: "hola cómo estás", esperado: [] },
  { n: 26, frase: "gasté 15 mil en taxi, 15 mil en taxi", esperado: [{ tipo: "gasto", monto: 15000, cuenta: "c-efe", categoria: "g-tra" }, { tipo: "gasto", monto: 15000, cuenta: "c-efe", categoria: "g-tra" }] },
  { n: 27, frase: "pagué 2 millones de la Visa desde Bancolombia", esperado: [{ tipo: "transferencia", monto: 2000000, cuenta: "c-ban", destino: "c-vis" }] },
  { n: 28, frase: "me gasté 12 k en Rappi", esperado: [{ tipo: "gasto", monto: 12000, cuenta: "c-efe", categoria: "g-com" }] },
  { n: 29, frase: "vendí la bici en 600 mil y me llegó a Nequi, de eso aparté 200 para el Mac", esperado: [{ tipo: "ingreso", monto: 600000, cuenta: "c-neq", categoria: "i-otr" }, { tipo: "aporte_meta", monto: 200000, meta: "m-mac" }] },
  { n: 30, frase: "el arriendo son 900 mil pero todavía no lo he pagado", esperado: [] },
];

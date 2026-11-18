// Iteración 2 · F4 · Agente "lumi-analista": la parte FIJA del paquete ([A] instrucciones, plantilla, [D] solicitud).
// El texto vive en src/ia/agente/instrucciones.md y plantilla.html (se generan con scripts/generar-agente.mjs).
// Cualquier cambio a [A] sube la versión (v1.1…) y exige volver a pasar prueba-informe-ia.
import { INSTRUCCIONES, PLANTILLA, PLANTILLA_HASH_FUENTE } from './agente/textos.generado';

// v1.1 (2026-11-18): tras la primera prueba real (1 de 4): no redondear, pagar deudas no es ahorro, sin intereses en deudas
// con personas, fecha de hoy para los días de la semana, CONTINUAR solo si hace falta.
// v1.2 (2026-11-18): tras la segunda prueba real (3 de 4): metas de cada palanca precalculadas y calendario de 7 días.
// v1.3 (2026-11-18): tras la tercera prueba (5 de 8): % hormiga del gasto y faltante mensual de cada meta precalculados.
export const VERSION_AGENTE = 'lumi-analista v1.3';
export const FECHA_AGENTE = '2026-11-18';
export const PLANTILLA_HTML = PLANTILLA;
export const PLANTILLA_HASH = PLANTILLA_HASH_FUENTE;

export type Foco = 'todo' | 'gastos' | 'deudas' | 'meta' | 'ingresos';
export const FOCOS: { id: Foco; texto: string }[] = [
  { id: 'todo', texto: 'Todo' },
  { id: 'gastos', texto: 'Gastos del día a día' },
  { id: 'deudas', texto: 'Salir de deudas' },
  { id: 'meta', texto: 'Mi meta' },
  { id: 'ingresos', texto: 'Ingresos que cambian' },
];

export const LINEA_ENTRADA = 'Hola. Abajo están las instrucciones de un analista financiero y mis datos de Lumi. Síguelas y entrégame el informe.';

export function bloqueInstrucciones(): string {
  return `<instrucciones_agente version="${VERSION_AGENTE}" fecha="${FECHA_AGENTE}">\n${INSTRUCCIONES}\n\n# Plantilla del visualizador\n${PLANTILLA}\n</instrucciones_agente>`;
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** "miércoles 18 de noviembre de 2026" (la IA no debe adivinar el día de la semana). */
export function fechaLarga(iso: string): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/** "jueves 19, viernes 20, …": los 7 días siguientes, para que la IA no calcule días de la semana. */
export function proximosDias(iso: string): string {
  const base = Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  return Array.from({ length: 7 }, (_, k) => { const d = new Date(base + (k + 1) * 864e5); return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()}`; }).join(', ');
}

export function solicitud(foco: Foco = 'todo', corte?: string): string {
  const texto = FOCOS.find((f) => f.id === foco)?.texto || 'Todo';
  return `<solicitud>
${corte ? `Hoy es ${fechaLarga(corte)}. Próximos días: ${proximosDias(corte)}.\n` : ''}Foco: ${texto}. Horizonte: 3, 6 y 12 meses.
Entrégame el informe completo, secciones 1 a 10.
Recuerda: cada cifra exacta y con su ID, sin redondear; no hagas cálculos propios (ni porcentajes ni diferencias: si no está en los datos, no la escribas); pagar una deuda no es ahorro; máximo 5 recomendaciones, cada una con su primer paso de esta semana; ninguna entidad ni producto; ningún nombre de terceros; en el visualizador, graficos_json copiado tal cual.
</solicitud>`;
}

/** Los 10 títulos obligatorios del informe (los usa el verificador). */
export const TITULOS_INFORME = [
  'En 30 segundos', 'Tu foto de hoy', '¿En qué se te va la plata?', 'Lo que me preocupa', 'Si sigues así',
  'Tu plan', 'Lo que no sé', 'Anexo técnico', 'Tu visualizador', 'Aviso',
];

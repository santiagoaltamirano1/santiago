// Genera src/ia/agente/textos.generado.ts a partir de instrucciones.md y plantilla.html.
// Se edita SOLO el .md y el .html; luego:  node scripts/generar-agente.mjs
// prueba-paquete.ts falla si el generado no coincide con las fuentes.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = new URL('../src/ia/agente/', import.meta.url);
const instrucciones = readFileSync(new URL('instrucciones.md', dir), 'utf8').trimEnd();
const plantilla = readFileSync(new URL('plantilla.html', dir), 'utf8').trimEnd();
const hash = createHash('sha256').update(plantilla).digest('hex').slice(0, 16);
const ts = `// ARCHIVO GENERADO por scripts/generar-agente.mjs: no editar a mano.
// Fuentes: src/ia/agente/instrucciones.md y src/ia/agente/plantilla.html
export const INSTRUCCIONES: string = ${JSON.stringify(instrucciones)};
export const PLANTILLA: string = ${JSON.stringify(plantilla)};
export const PLANTILLA_HASH_FUENTE = ${JSON.stringify(hash)};
`;
writeFileSync(new URL('textos.generado.ts', dir), ts);
console.log('textos.generado.ts listo · plantilla', hash);

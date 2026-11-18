# LEEME · Para el agente de Google AI Studio

Lumi Finance es una app de finanzas personales para jóvenes en Colombia. Está **completa y probada**.
Tu trabajo es **alojarla con Firebase y Gemini sin cambiar cómo funciona**. Trabaja **por pasos**: la dueña te dará un prompt a la vez (`guia-ai-studio/CADENA_DE_PROMPTS.md`).

## 5 reglas que no se rompen
1. **Toda la app habla en español de Colombia**, en tuteo y con frases cortas.
2. **El dinero solo lo escribe el servidor.** La app LEE Firestore y ESCRIBE llamando a `/api/*` (`server.ts`). No agregues escrituras a Firestore desde el navegador y no cambies `firestore.rules`.
3. **Las reglas de dinero existen dos veces:** `server/dinero.ts` (la verdad) y `src/utils/reglas.ts` (la copia para la pantalla). Si cambias una, cambias las dos en el mismo paso.
4. **Ninguna llave va en el código.** Gemini usa el secreto `GEMINI_API_KEY`. Firebase usa `firebase-applet-config.json`.
5. **No reescribas lo que funciona.** Si algo falla, arregla lo mínimo y di qué cambiaste.

## Mapa en 30 segundos
| Qué | Dónde |
|---|---|
| Pantallas (React + Vite + Tailwind + Zustand) | `src/` (`components/`, `store/useFinanceStore.ts`) |
| Conexión de la app con Firebase (Auth con correo y contraseña, lectura de Firestore) | `src/services/firebase.ts` |
| Llamadas de la app al servidor | `src/services/api.ts`, `financeService.ts`, `currency.ts`, `exportService.ts`, `ia.ts` |
| Servidor Express (rutas `/api/*`, sirve la app) | `server.ts` |
| Reglas de dinero, altas, tasas, reportes | `server/dinero.ts`, `server/altas.ts`, `server/tasas.ts`, `server/reportes.ts` |
| Voz con Gemini (prompt versionado, set de 30 frases, calificador) | `server/voz/` |
| Permisos de Firestore (solo lectura de lo propio) | `firestore.rules` |
| Pruebas | `scripts/` (ver `guia-ai-studio/contexto/07_PRUEBAS.md`) |

## Si necesitas más detalle, lee SOLO el archivo del tema
`guia-ai-studio/contexto/`:
- `01_PRODUCTO.md`
- `02_ARQUITECTURA.md`
- `03_REGLAS_DE_DINERO.md`
- `04_DATOS_FIRESTORE.md`
- `05_API.md`
- `06_VOZ_Y_AGENTE.md`
- `07_PRUEBAS.md`

No leas todo de una vez.

## Comandos
- `npm run dev`: servidor más la app en el puerto 3000.
- `npm run build` y luego `npm start`: producción.
- `npm run lint`: revisión de tipos.
- `npm run prueba:local`: reglas, indicadores, exportar y voz, sin internet.

# LEEME · Para el agente de Google AI Studio

Lumi Finance es una app de finanzas personales para jóvenes en Colombia. Está **completa y probada**.
Tu trabajo es **alojarla con Firebase y Gemini sin cambiar cómo funciona**. Trabaja **por pasos**: la dueña te dará un prompt a la vez (`guia-ai-studio/CADENA_DE_PROMPTS.md`).

## 5 reglas que no se rompen
1. **Toda la app habla en español de Colombia**, en tuteo y con frases cortas.
2. **Versión DEMO para el plan gratuito (Starter Tier):** la app lee y escribe Firestore desde el navegador con el **motor** (`motor/`), protegido por `firestore.rules`, donde cada persona solo ve lo suyo. El servidor (`server.ts`) **no toca Firestore**: solo la voz con Gemini y las tasas. No cambies esto ni las reglas.
3. **Las reglas de dinero existen dos veces:** `motor/dinero.ts` (la verdad) y `src/utils/reglas.ts` (la copia para la pantalla). Si cambias una, cambias las dos en el mismo paso.
4. **Ninguna llave va en el código.** Gemini usa el secreto `GEMINI_API_KEY`. Firebase usa `firebase-applet-config.json`.
5. **No reescribas lo que funciona.** Si algo falla, arregla lo mínimo y di qué cambiaste.

## Mapa en 30 segundos
| Qué | Dónde |
|---|---|
| Pantallas (React + Vite + Tailwind + Zustand) | `src/` (`components/`, `store/useFinanceStore.ts`) |
| Conexión de la app con Firebase (Auth con correo y contraseña, lectura de Firestore) | `src/services/firebase.ts` |
| Llamadas `/api/...` (casi todas se resuelven en el navegador con `motor/rutas.ts`) | `src/services/api.ts`, `financeService.ts`, `currency.ts`, `exportService.ts`, `ia.ts` |
| Servidor Express (voz con Gemini, tasas en vivo; sirve la app) | `server.ts`, `server/` |
| Motor (corre en el navegador): dinero, altas, reportes, voz (captura) | `motor/dinero.ts`, `motor/altas.ts`, `motor/reportes.ts`, `motor/voz.ts`, `motor/bd.ts` |
| Voz con Gemini (prompt versionado, set de 30 frases, calificador) | `server/voz/` |
| Permisos de Firestore (cada quien lee y escribe solo lo suyo) | `firestore.rules` |
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

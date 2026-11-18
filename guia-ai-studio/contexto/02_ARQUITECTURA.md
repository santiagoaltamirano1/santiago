# 02 · Arquitectura (Google: Firebase + Gemini + servidor propio)

```
Navegador (React)                          Servidor (server.ts, Express, Cloud Run)              Firebase
─────────────────                          ─────────────────────────────────────────              ────────
Firebase Auth (correo + contraseña) ──token──►  verifica el token (firebase-admin)
Lee Firestore (solo lo suyo) ◄──────────────────────────────────────────────────────────────  Firestore
Escribe SOLO con /api/* ──────────────────►  server/dinero.ts · altas.ts · tasas.ts  ──escribe──► Firestore
                                             server/reportes.ts (resumen, exportar)
                                             server/voz/ ──► Gemini (secreto GEMINI_API_KEY)
                                             tasas: datos.gov.co (TRM) y frankfurter (BCE)
```

## Por qué así
- **Seguridad:** `firestore.rules` NO deja escribir desde el navegador. Nadie puede inventarse un saldo.
- **Una sola verdad:** las reglas de dinero viven en `server/dinero.ts`. Corren en una transacción de Firestore: o se guarda todo o nada.
- **Tiempo real:** la app escucha Firestore (`onSnapshot`, en `financeService.subscribeToAll`) y se recarga cuando algo cambia.
- **Sin tareas programadas:** las tasas se actualizan al pedirlas si tienen más de 1 hora (`server/tasas.ts`).

## Configuración
| Qué | Dónde | Quién lo pone |
|---|---|---|
| Proyecto de Firebase (app y servidor) | `firebase-applet-config.json` (raíz) | AI Studio, al activar la integración de Firebase |
| Llave de Gemini | Secreto `GEMINI_API_KEY` | AI Studio, automático |
| Modelo de Gemini (opcional) | Secreto `GEMINI_MODELO` | La dueña, si quiere otro (por defecto `gemini-2.5-flash`) |
| Permiso del servidor para escribir en Firestore | Credenciales del entorno. Si no alcanzan, secreto `FIREBASE_SERVICE_ACCOUNT` (JSON) | Ver paso 2 de la cadena |
| Medir la voz | Secreto `EVAL_VOZ=1` (temporal) | La dueña, en el paso 6 |

## Archivos clave del servidor
| Archivo | Responsabilidad |
|---|---|
| `server.ts` | Rutas `/api/*`, sesión obligatoria, errores, sirve la app (Vite en desarrollo y `dist/` en producción) |
| `server/firebase.ts` | Conexión con Firebase Admin, verificación del token y rutas de las colecciones |
| `server/util.ts` | Errores de negocio (`CODIGO: detalle`), redondeo, fechas de Bogotá, conversión de monedas |
| `server/dinero.ts` | `registrarMovimiento`, `ajustarSaldo` y `disponibleCop` |
| `server/altas.ts` | Crear cuentas, categorías, metas y deudas (nacen en 0), borrado suave, datos iniciales |
| `server/tasas.ts` | TRM y euro: consulta, validación y tasa del día |
| `server/reportes.ts` | Resumen del tablero y exportación |
| `server/voz/` | `prompt.ts` (versionado), `gemini.ts`, `capturas.ts`, `eval_set.ts` (30 frases) y `calificador.ts` |

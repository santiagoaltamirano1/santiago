# Cadena de prompts para Google AI Studio

**Cómo usarla:** pega **un prompt a la vez** y espera la respuesta. Si la respuesta no trae lo que pide "Respóndeme con", no pases al siguiente: pégale otra vez el mismo prompt o dile qué faltó.

Cada prompt tiene la misma forma:
- **Objetivo:** uno solo.
- **Lee solo:** pocos archivos, para que no se ahogue.
- **No toques:** lo que debe quedar igual.
- **Comprueba:** cómo saber que quedó bien.
- **Respóndeme con:** un formato corto, para que tú puedas verificar.

---

## Prompt 1 · Conocer el proyecto (sin cambiar nada)
```
Objetivo: entender el proyecto antes de tocar nada. NO cambies ningún archivo en este paso.
Lee solo: LEEME_AI_STUDIO.md y guia-ai-studio/contexto/02_ARQUITECTURA.md.
Respóndeme con, en máximo 10 líneas y en español:
1) Qué hace la app, en una frase.
2) Quién escribe en Firestore y quién solo lee.
3) Dónde están las reglas de dinero (los dos archivos).
4) Qué secretos y qué archivo de configuración necesita el servidor.
5) Una duda, si tienes alguna. Si no tienes, escribe "Sin dudas".
```

## Prompt 2 · Arrancar y conectar Firebase
```
Objetivo: que la app arranque en la vista previa conectada a Firebase.
Lee solo: guia-ai-studio/contexto/02_ARQUITECTURA.md y server/firebase.ts.
No toques: server/dinero.ts, server/altas.ts, src/utils/reglas.ts, firestore.rules.
Haz:
- Confirma que existe firebase-applet-config.json en la raíz, con projectId y, si aplica, firestoreDatabaseId. El servidor y la app ya lo leen.
- La app arranca con "npm run dev" (server.ts sirve la app con Vite en el puerto 3000). No cambies esa forma de arrancar.
- Abre /api/salud y muéstrame el JSON completo.
Comprueba: "firebase.firestore" debe ser "ok" e "ia.llave" debe ser true.
Si firestore NO es "ok": NO cambies el código para saltarte el permiso. Dime el error exacto. La solución es el secreto FIREBASE_SERVICE_ACCOUNT, que pongo yo.
Respóndeme con: el JSON de /api/salud y la lista de archivos que cambiaste (lo ideal es ninguno).
```

## Prompt 3 · Reglas de seguridad de Firestore
```
Objetivo: que Firestore use EXACTAMENTE las reglas de firestore.rules.
Lee solo: firestore.rules y guia-ai-studio/contexto/04_DATOS_FIRESTORE.md.
No toques: el contenido de firestore.rules. No generes reglas nuevas y no abras permisos de escritura.
Haz: publica firestore.rules en el proyecto de Firebase. Si no puedes publicarlas tú, dime "Publícalas a mano" y yo las pego en la consola.
Comprueba: con una sesión iniciada, la app lee sus cuentas; ninguna escritura directa desde el navegador está permitida.
Respóndeme con: "Reglas publicadas" o "Publícalas a mano", y confirma que no cambiaste el archivo.
```

## Prompt 4 · Entrar y datos iniciales
```
Objetivo: comprobar el inicio de sesión con correo y contraseña.
Lee solo: src/components/Auth/AuthGate.tsx y src/services/firebase.ts.
No toques: el diseño de la pantalla de entrada. No agregues "Entrar con Google": decidí usar solo correo y contraseña.
Haz: en la vista previa crea una cuenta de usuario de prueba nueva.
Comprueba: después de entrar aparecen las cuentas "Efectivo" y "Ahorros Principal" en $0 y 5 categorías (Comida, Transporte, Otros gastos, Salario, Otros ingresos). En Firestore existe usuarios/{uid} con sus subcolecciones.
Si sale "Falta activar Correo/contraseña", dímelo: lo activo yo en la consola de Firebase.
Respóndeme con: qué viste y si hubo algún error, con el texto exacto.
```

## Prompt 5 · Dinero de punta a punta
```
Objetivo: verificar que las reglas de dinero funcionan igual que antes.
Lee solo: guia-ai-studio/contexto/03_REGLAS_DE_DINERO.md y guia-ai-studio/contexto/07_PRUEBAS.md.
No toques: server/dinero.ts y src/utils/reglas.ts, salvo que encuentres un error real. En ese caso explícamelo ANTES de cambiarlo.
Haz:
- Si puedes correr comandos: "npm run lint" y "npm run prueba:local".
- Recorre la "Lista manual" de 07_PRUEBAS.md, pasos 1 a 8, en la vista previa.
Comprueba: cada paso da exactamente las cifras de la lista.
Respóndeme con: una tabla Paso | Esperado | Visto | ✓/✗, y los resultados de los comandos si los corriste.
```

## Prompt 6 · Voz con Gemini
```
Objetivo: comprobar la voz con Gemini y medirla con las 30 frases.
Lee solo: guia-ai-studio/contexto/06_VOZ_Y_AGENTE.md y server/voz/gemini.ts.
No toques: server/voz/prompt.ts, server/voz/eval_set.ts, server/voz/calificador.ts.
Haz:
1) Prueba el micrófono o el texto con: "gasté 8 mil en un taxi y me pagaron 50 mil" → Revisar antes. Deben salir 2 movimientos.
2) Ya puse el secreto EVAL_VOZ=1. En Analítica › Ajustes usa "Medir la voz" y muéstrame el resultado.
3) Si sale NO APROBADA: dime qué reglas fallaron y las 5 fallas más repetidas. NO cambies el prompt para "pasar la prueba": propón el cambio y espera mi aprobación.
4) Si el modelo gemini-2.5-flash ya no existe, dime cuál es el Flash vigente. Lo pongo en el secreto GEMINI_MODELO.
Respóndeme con: el resultado (perfectas por corrida, reglas ✓/✗, p95) y el modelo usado.
```

## Prompt 7 · Publicar
```
Objetivo: publicar la app (Cloud Run) con el servidor incluido.
Lee solo: package.json y server.ts (solo la función arrancar).
No toques: la lógica de /api/*. Producción se arranca con "npm run build" y luego "npm start" (NODE_ENV=production, sirve dist/).
Haz: publica la app. Abre https://<la app publicada>/api/salud.
Comprueba: "ok": true. Entra con tu usuario de prueba y anota un gasto.
Recuérdame borrar el secreto EVAL_VOZ si sigue puesto.
Respóndeme con: la URL publicada, el JSON de /api/salud y si el gasto quedó guardado.
```

## Prompt 8 · Para cualquier cambio futuro (pégalo al inicio de cada pedido)
```
Antes de cambiar algo en Lumi Finance:
- Lee LEEME_AI_STUDIO.md y SOLO el archivo de guia-ai-studio/contexto/ que tenga que ver con el pedido.
- Ubica el cambio en su módulo y subsección (Calculadora, Anotar, Metas y Deudas, Analítica).
- Si toca reglas de dinero: cambia server/dinero.ts y src/utils/reglas.ts juntos, y corre "npm run prueba:local".
- Si toca el prompt de voz: crea una versión nueva en server/voz/prompt.ts y mídela con "Medir la voz" antes de usarla.
- No escribas en Firestore desde el navegador, no cambies firestore.rules y no pongas llaves en el código.
- Haz el cambio mínimo y dime: qué archivos cambiaste, por qué y cómo lo probaste.
Mi pedido: <escribe aquí lo que quieres>
```

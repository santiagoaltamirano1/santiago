# Pasos para ti (dueña) · Llevar Lumi Finance a Google AI Studio + Firebase

Tiempo aproximado: **1 a 2 horas**, en orden. Cada paso dice qué haces tú y qué prompt le pegas a AI Studio.
Los prompts están en `CADENA_DE_PROMPTS.md`. **Pega uno a la vez** y espera su respuesta antes del siguiente.

---

## Paso 0 · Subir el código (tú)
AI Studio trae código existente desde **GitHub**: en el modo **Build**, botón **+** → **Import from GitHub**.
1. Descomprime el zip en tu computador.
2. En GitHub crea un repositorio **privado** vacío, por ejemplo `lumi-finance`.
3. En ese repositorio usa **Add file → Upload files**, arrastra **todo el contenido** de la carpeta descomprimida (no la carpeta) y confirma con **Commit**.
4. En AI Studio → **Build** → **+** → **Import from GitHub** → elige `lumi-finance`.
   - Si tu AI Studio ofrece subir un zip o una carpeta directamente, también sirve.

## Paso 1 · Activar Firebase (tú, dentro de AI Studio)
1. En la app importada: **Settings → Integrations → Firebase Firestore & Auth** → actívalo. Debe aparecer el archivo **`firebase-applet-config.json`** en la raíz.
2. Abre la **consola de Firebase** del proyecto que se creó (el enlace aparece en esa misma pantalla de integraciones):
   - **Authentication → Sign-in method → Correo electrónico/contraseña → Habilitar → Guardar.** Decidiste usar solo correo y contraseña, así que no actives Google.
   - **Authentication → Settings → Password policy** (si aparece): mínimo 6 caracteres.
3. Pega el **Prompt 1** y luego el **Prompt 2**.

## Paso 2 · Si el Prompt 2 dice que el servidor NO puede escribir en Firestore (tú)
1. Consola de Firebase → ⚙️ **Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada**. Se descarga un `.json`.
2. AI Studio → **Settings → Secrets** → nuevo secreto **`FIREBASE_SERVICE_ACCOUNT`** → pega **todo** el contenido del `.json`.
3. **Nunca pegues ese archivo en el chat ni en el código.** Es una llave. Borra el `.json` de tu computador cuando termines.
4. Pega otra vez el **Prompt 2**.

## Paso 3 · Reglas de seguridad → Prompt 3
Si AI Studio no puede publicarlas: consola de Firebase → **Firestore Database → Reglas** → pega el contenido de `firestore.rules` → **Publicar**.

## Paso 4 · Probar la app → Prompts 4 y 5
Usa la **lista manual** de `contexto/07_PRUEBAS.md`, desde la vista previa, con una cuenta de usuario nueva tuya.

## Paso 5 · Medir la voz con Gemini → Prompt 6
1. AI Studio → **Settings → Secrets** → crea **`EVAL_VOZ`** con el valor `1`.
2. En la app: **Analítica → Ajustes → "Medir la voz"**. Tarda 1 a 3 minutos y gasta un poco de saldo de Gemini.
3. Descarga los resultados (.json) y guárdalos. Si dice **NO APROBADA**, pégale a AI Studio el Prompt 6 con el resultado, o tráemelo a mí.
4. **Borra el secreto `EVAL_VOZ`** al terminar.

## Paso 6 · Publicar → Prompt 7
Usa **Deploy / Publish** de AI Studio (Cloud Run). Después abre `https://TU-APP/api/salud`: debe decir `"ok": true`.

## Paso 7 · Para siempre → Prompt 8
Cada vez que pidas un cambio, empieza con el Prompt 8. Así AI Studio respeta las reglas del proyecto.

---

### Problemas comunes
| Ves | Haz |
|---|---|
| "Falta conectar Firebase" | El Paso 1 no se completó: falta `firebase-applet-config.json`. |
| "Falta activar Correo/contraseña en Firebase Authentication" | Paso 1, punto 2. |
| `auth/unauthorized-domain` | Firebase → Authentication → Settings → **Authorized domains** → agrega el dominio de tu app. |
| `/api/salud` muestra `firestore` con un error de permisos | Paso 2. |
| La voz dice "No pudimos organizar el texto" | En `/api/salud`, `ia.llave` debe ser `true`. Si es `false`, revisa que exista el secreto `GEMINI_API_KEY`. |
| El micrófono no funciona en la vista previa | Ábrela en una pestaña aparte o usa la app publicada. `metadata.json` ya pide permiso de micrófono. |

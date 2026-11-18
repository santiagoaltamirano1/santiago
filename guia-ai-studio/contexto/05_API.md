# 05 · API del servidor (`server.ts`)

Todas exigen `Authorization: Bearer <idToken de Firebase>`, menos `/api/salud`. La app usa `src/services/api.ts`.
Error de negocio: HTTP 4xx con `{ "error": { "code": "SOBREPAGO", "message": "SOBREPAGO: 100000" } }`. Error inesperado: HTTP 500 `ERROR_SERVIDOR`, y la app reintenta.

| Método y ruta | Cuerpo / consulta | Respuesta |
|---|---|---|
| GET `/api/salud` | — | `{ ok, firebase: {config, proyecto, base, firestore}, ia: {llave, modelos}, evaluacion_voz }` |
| POST `/api/semilla` | `{ correo }` | `{ creo }` (2 cuentas y 5 categorías si no tiene) |
| GET `/api/tasas` | — | `[ {moneda, cop_por_unidad, vigente_desde, vigente_hasta, fuente, consultado_en, proxima} ]` |
| POST `/api/movimientos` | `{ id, tipo, monto, cuenta_id, destino_cuenta_id, categoria_id, meta_id, deuda_id, operacion_deuda, fecha, fecha_local_str, notas, cuenta_nombre, categoria_nombre, supercategoria, origen, captura_id }` | `{ id }` |
| POST `/api/ajustar-saldo` | `{ id, cuenta_id, saldo_objetivo, notas }` | `{ id, diferencia, saldo_nuevo, repetido }` |
| POST `/api/cuentas` · `/api/categorias` · `/api/metas` · `/api/deudas` | los campos de 04 (con `id` opcional) | el documento creado (nace en 0) |
| DELETE `/api/{cuentas, categorias, metas o deudas}/{id}` | — | `{ ok }` (borrado suave) |
| GET `/api/resumen?mes=AAAA-MM&meses=6` | — | `{ mes, hoy, meses[], patrimonio[], categorias[] }` |
| GET `/api/exportar?desde=&hasta=` | — | `{ resumen, filas[] }` (forma en `src/ia/tipos.ts`) |
| POST `/api/exportaciones` | `{ formato, desde, hasta, secciones, filas }` | `{ ok }` |
| POST `/api/voz/interpretar` | `{ texto, texto_dictado, transcriptor, cuenta_por_defecto, hoy }` | `{ captura_id, modelo, version_prompt, movimientos[], aclaracion }` |
| POST `/api/voz/cerrar` | `{ captura_id, confirmados[] }` | `{ ya_cerrada, correcciones }` |
| POST `/api/dev/evaluar-voz` | `{ intentos: 1 a 3 }` (solo con `EVAL_VOZ=1`) | `{ corridas, veredicto, peor, filas }` |

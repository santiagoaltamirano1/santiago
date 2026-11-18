# 04 · Datos en Firestore

Todo lo de una persona vive bajo **`usuarios/{uid}/…`**. Solo esa persona puede leerlo, y nadie escribe desde el navegador (`firestore.rules`).
Las fechas van en texto ISO (`2026-11-18T15:04:05.000Z`) y los días en `AAAA-MM-DD`. Los números van redondeados a 2 decimales.

| Colección | Campos principales |
|---|---|
| `usuarios/{uid}` | `id`, `nombre`, `moneda_principal`, `created_at` |
| `…/cuentas/{id}` | `nombre`, `tipo` (ahorro, bolsillo, broker, efectivo, corriente, tarjeta), `moneda` (COP, USD, EUR), `saldo_actual`, `mascara`, `color_badge`, `is_active` |
| `…/categorias/{id}` | `nombre`, `tipo` (gasto, ingreso), `supercategoria`, `icono`, `is_active` |
| `…/metas/{id}` | `nombre`, `monto_objetivo`, `monto_actual`, `porcentaje`, `color`, `fecha_limite`, `is_active` |
| `…/deudas/{id}` | `contraparte`, `concepto`, `tipo` (por_cobrar, por_pagar), `moneda`, `monto_total`, `monto_pagado`, `estado` (activa, saldada), `fecha_vencimiento`, `detalles_pago`, `is_active` |
| `…/movimientos/{id}` | `tipo`, `monto`, `moneda`, `cuenta_id`, `destino_cuenta_id`, `categoria_id`, `meta_id`, `deuda_id`, `operacion_deuda`, `fecha`, `fecha_local_str`, `notas`, `cuenta_nombre`, `categoria_nombre`, `supercategoria`, `origen` (manual, ia_voz, recuperada, ajuste), `monto_aplicado`, `tasa_cop`, `saldo_anterior`, `saldo_nuevo`, `captura_id`, `is_active`, `created_at` |
| `…/capturas/{id}` (voz) | `texto`, `texto_dictado`, `transcriptor`, `version_prompt`, `modelo`, `respuesta` (con `validados`), `estado` (interpretada, confirmada, error), `metricas`, `confirmado`, `correcciones`, `cerrada_en`, `creado_en` |
| `…/exportaciones/{id}` | `formato`, `desde`, `hasta`, `secciones`, `filas`, `creado_en` (nunca el contenido) |
| `tasas/{MONEDA_fecha_FUENTE}` | `moneda`, `cop_por_unidad`, `vigente_desde`, `vigente_hasta`, `fuente`, `consultado_en` (se lee con sesión) |
| `sistema/config` | `usd_cop` y `eur_cop` del día, `fuente`, `updated_at` (se lee con sesión) |
| `sistema/tasas_estado` | `ultima_consulta`, `intentos` (solo el servidor) |

**Índices:** no hace falta ninguno compuesto. Las consultas usan un solo campo (`is_active`, `fecha`, `creado_en`, `moneda`).

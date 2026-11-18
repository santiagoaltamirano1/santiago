# 03 · Reglas de dinero (NO se cambian sin la dueña)

Viven en **`server/dinero.ts`** (la verdad) y en la copia **`src/utils/reglas.ts`** (valida antes de enviar, aplica el efecto optimista y deshace). **Cambiar una obliga a cambiar la otra** y a correr las pruebas (07).

## Tipos de movimiento y su efecto
| Tipo | Cuenta de origen | Otra cosa que cambia | ¿Cuenta como ingreso o gasto? |
|---|---|---|---|
| `ingreso` | + monto | — | Sí (ingreso) |
| `gasto` | − monto | — | Sí (gasto) |
| `transferencia` | − monto | destino + monto convertido a su moneda | No |
| `aporte_meta` | no se usa cuenta | meta + monto (en COP) | No |
| `retiro_meta` | no se usa cuenta | meta − monto | No |
| `prestamo_capital` | por cobrar ("le presté"): −; por pagar ("me prestaron"): + | deuda: total + monto | No |
| `abono_capital` | por cobrar ("me pagó"): +; por pagar ("pagué"): − | deuda: pagado + monto (si completa, queda `saldada`) | No |
| `ajuste` | queda en el saldo exacto que dijo la persona | se guarda saldo_anterior y saldo_nuevo | No (solo con `/api/ajustar-saldo`) |

## Reglas
1. El monto es siempre **positivo** en la base, y el tipo dice la dirección. En pantalla, "−5000" es gasto y "5000" es ingreso.
2. **La moneda del movimiento es la moneda de la cuenta de origen.** Metas en COP; cada deuda en su moneda. Las conversiones pasan por COP con la tasa del día (`sistema/config`), y cada movimiento guarda su `tasa_cop`.
3. **Disponible** = saldo de las cuentas que no son tarjeta (en COP) − lo apartado en metas activas. No se puede apartar más que el disponible.
4. **Metas virtuales:** apartar o sacar no mueve las cuentas.
5. Gasto e ingreso **exigen categoría del mismo tipo**. Los demás tipos no guardan categoría.
6. Un movimiento va a una meta **o** a una deuda, nunca a las dos.
7. **Idempotencia:** el id lo crea la app (UUID). Si llega dos veces, se guarda una sola.
8. Cuentas, metas y deudas **nacen en 0**. El saldo inicial entra como `ajuste`.
9. Todo se calcula en el **día de Bogotá** (UTC−5).

## Códigos de error (el servidor responde `CODIGO: detalle`; la app los traduce en `reglas.ts › mensajeError`)
MONTO_INVALIDO · TIPO_INVALIDO · ORIGEN_INVALIDO · CUENTA_REQUERIDA · DESTINO_REQUERIDO · MISMA_CUENTA · META_REQUERIDA · DEUDA_REQUERIDA · META_Y_DEUDA · CUENTA_AJENA · DESTINO_AJENO · META_AJENA · DEUDA_AJENA · CATEGORIA_REQUERIDA · CATEGORIA_AJENA · CATEGORIA_INVALIDA · CAPTURA_AJENA · DEUDA_SALDADA · SOBREPAGO: máximo · RETIRO_MAYOR: máximo · DISPONIBLE_INSUFICIENTE: máximo · NO_AUTENTICADO

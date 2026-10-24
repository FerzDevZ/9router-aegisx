# Ahorro de Tokens (Token Saver)

Las herramientas de agente queman el 30–50% de tu presupuesto de prompt en boilerplate: salidas de herramientas interminables (`git diff`, `grep`, logs de tests), resultados duplicados y historial obsoleto que se reenvía en cada turno. El **Token Saver** de 9Router recorta o comprime ese peso muerto *antes* de que la solicitud salga de tu máquina — de forma transparente, por ahorrador, con un marcador en vivo de lo que cada uno ahorró.

Todos los ahorradores son sin pérdida para la toma de decisiones del modelo: se conservan los fallos y detalles que importan; solo el volumen redundante se comprime o descarta.

## Los ahorradores

| Ahorrador | Qué hace | Por defecto |
|---|---|---|
| **Filtros RTK** | Detecta tipos de salida de herramientas (git diff/status, grep, find, ls, tree, logs) y los comprime con filtros por tipo, sin pérdida | On |
| **Dedup de resultados** | Salidas de herramientas idénticas byte a byte en una solicitud pasan a una referencia de una línea (`duplicate of tool result #N`) | On |
| **History GC** | Resultados de herramientas más antiguos que los últimos N turnos de usuario se reducen a un digesto (cabecera + tamaño + huella + pista de re-ejecución) | Off (`historyGcEnabled`, turnos conservados configurables, por defecto 6) |
| **Filtro test-runner** | Comprime salidas vitest/jest/pytest/go/mocha/TAP — conserva fallos + resumen, omite el muro de tests exitosos | Autodetectado |
| **Caché de respuestas** | Caché por solicitud exacta para chat sin streaming (LRU + TTL); aciertos servidos con `x-9r-cache: hit` | Off (`responseCacheEnabled`) |
| **System prompt personalizado** | Inyecta tu propio system prompt en los formatos OpenAI/Claude/Gemini/Kiro | Off |
| **Headroom** | Comprime contexto vía el servicio local Headroom (salidas de herramientas, texto largo; formatos nativos Gemini/Responses/Claude) | Off |
| **Caveman** | Comprime la *salida* del LLM antes de que vuelva a la conversación | Off |
| **Ponytail** | Modo "dev senior perezoso" — recorta historial del asistente verboso | Off |
| **Pxpipe** | Convierte contexto textual grande en imágenes optimizadas (modelos de visión) | Off |

## Activación

Dashboard → **Token Saver**: interruptores para dedup de resultados, History GC (con campo de turnos a conservar) y la caché de respuestas.

Por CLI sobre la DB local:

```bash
node scripts/enable-token-savers.mjs            # RTK + dedup + History GC
node scripts/enable-token-savers.mjs --response-cache --smart-combo
node scripts/enable-token-savers.mjs --revert   # volver a valores por defecto
```

## Marcador

Dashboard → **Usage → Token Saver Scoreboard** muestra en vivo hits, bytes ahorrados y estadísticas de caché de cada ahorrador desde el arranque del proceso (`GET /api/usage/savers`, POST para resetear). El resumen de Usage también muestra tu **Cache Hit Rate** — la proporción de tokens de entrada servidos desde la caché de prompt del proveedor.

## Omitir

Envía la cabecera `X-9Router-Token-Saver: off` en cualquier solicitud de chat para enviarla intacta.

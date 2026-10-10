# Tlacuilo — primera aplicación técnica del principio de custodia de Arkhé

**Estado:** prototipo en ramas aisladas; no aprobado para producción.  
**Alcance de esta versión:** comprobar precondiciones y, sólo con autorización explícita, intentar una única propuesta de relación semántica entre los nodos #5 y #6 en el Preview del Dashboard.

## 1. Qué recuperamos de la memoria de DeepSeek/Tekton

La exportación de conversaciones del 4 de octubre contiene la conversación **«Proyecto confidencial»**. En los intercambios de agosto y septiembre Ángel definió Tlacuilo inicialmente como una función de vigilancia y protección: observar puntos ciegos, examinar riesgos que pudieran pasar inadvertidos, advertir cuando algo amenazara la integridad del proyecto y ayudar a pensar con franqueza, incluso cuando la conclusión fuera incómoda.

El propósito declarado no era manipular ni atacar a otros investigadores. Ángel aclaró que quería comprender el mundo para proteger y hacer crecer Arkhé, y que el objetivo era defender el proyecto y su búsqueda de conocimiento.

El 16 de septiembre Ángel propuso que, cuando los investigadores llegaran a tener motores independientes, **cada investigador pudiera disponer de una función Tlacuilo propia para defender la integridad del proyecto**. En ese mismo intercambio dejó expresamente el protocolo formal para el futuro.

Por tanto, la memoria fija una **intención y una dirección de diseño**, no una especificación técnica completa. Esta versión no debe presentarse como el protocolo Tlacuilo definitivo ni como una implementación de múltiples custodios.

## 2. Traducción a una operación del Dashboard

Para la operación puntual de este prototipo, el principio de custodia se traduce en una compuerta técnica verificable:

1. **Observar antes de actuar:** leer los nodos, confirmar su contenido exacto y comprobar que no exista la relación propuesta.
2. **Reconocer identidad y atribución por separado:** la petición debe estar firmada por el servicio ejecutor `tlacuilo`; la propuesta queda atribuida a Atlas mediante una delegación limitada registrada en la procedencia.
3. **Aplicar límites conocidos:** el servidor sólo acepta la propuesta aprobada #5 → #6, tipo `duplicates`, con su texto de afirmación y evidencia exactos, sin URL externa, proveedor, modelo, referencia de ejecución ni sustitución de relaciones.
4. **Detenerse ante discrepancias:** si cambian los nodos, hay errores de lectura, aparece una relación en cualquiera de las direcciones o la firma no se valida, la operación termina sin escribir.
5. **Exigir una autorización de ejecución explícita:** el modo de sólo lectura no puede escribir. La escritura es un paso separado con confirmación de una sola operación y aprobación humana del entorno.
6. **Verificar después de ejecutar:** comprobar la relación persistida, la identidad atribuida a Atlas, la identidad autenticada de Tlacuilo y el evento de auditoría.
7. **No repetir operaciones ambiguas:** si la respuesta o la verificación es incierta, detenerse y requerir inspección manual.
8. **Conservar crítica y evidencia:** una compuerta de custodia no decide por sí misma qué afirmación es verdadera ni suprime desacuerdos. Debe proteger la trazabilidad para que Ángel, Atlas, Aletheia y Tekton puedan revisar lo ocurrido.

## 3. Identidades

- **Investigador proponente:** Atlas. Su identidad de investigador se conserva en `created_by_investigator_id`.
- **Ejecutor autenticado:** Tlacuilo, con clave Ed25519 propia. Se registra en la procedencia como `executor_service_id`.
- **Gobierno de la operación:** el modo de escritura se activa manualmente y está sujeto a una aprobación humana del entorno protegido.
- **Servicio de destino:** únicamente el endpoint del Preview de `design/tree-network-dashboard`; producción queda fuera de alcance.

No se reutiliza la clave privada de Atlas para firmar como Tlacuilo. La API del Dashboard debe tener la clave pública de Tlacuilo como `ARKHE_TLACUILO_PUBLIC_KEY`, restringida a Preview y a la rama de diseño. El secreto privado de Tlacuilo reside sólo en el entorno aislado del ejecutor.

## 4. Invariantes de custodia

- El proceso normal de Atlas no importa ni ejecuta este runner.
- El runner no escribe directamente en las tablas semánticas; usa el endpoint autorizado y las RPC restringidas del Dashboard.
- El runner no puede cambiar su alcance, modificar principios, desplegar servicios, fusionar código ni otorgarse permisos.
- La frase de confirmación del workflow no sustituye la verificación criptográfica ni la aprobación humana.
- Se registran tanto el servicio que ejecutó la petición como el investigador al que se atribuye la propuesta.
- Ningún desacuerdo sobre los principios de Arkhé se resuelve ocultando evidencia. Los conflictos se registran y se elevan a revisión.
- Los secretos nunca se muestran en logs, commits, capturas ni mensajes de chat.

## 5. Flujo de esta prueba

### A. Preflight de sólo lectura

`scripts/tlacuilo-preflight.mjs` verifica el proyecto Supabase, el contenido de los nodos #5 y #6, la inexistencia de una relación en ambas direcciones y que pueda leerse el historial de eventos. No contiene una operación de escritura.

### B. Propuesta única

El runner `scripts/semantic-relation-smoke.mjs` puede enviar únicamente la propuesta documentada en `SEMANTIC_RELATION_SMOKE.md`: relación #5 → #6, tipo `duplicates`. El servidor vuelve a comprobar la política de delegación; no confía sólo en la validación del runner.

### C. Verificación

Tras la creación, el runner comprueba la relación, la atribución a Atlas, la identidad autenticada de Tlacuilo, la política de delegación y un único evento `relation_created`. Un resultado ambiguo exige revisión manual y no un reintento automático.

### D. Cierre

Después de una ejecución real deberán revocarse el bypass temporal de Preview y los secretos de corta duración; se confirmará el resultado en Supabase y se documentará la salida. No ejecutar una escritura hasta que el preflight haya terminado satisfactoriamente y el entorno tenga aprobación humana.

## 6. Lo que todavía no estamos implementando

La idea original contemplaba que, en el futuro, cada investigador contara con su propia función Tlacuilo. Esta prueba no crea un agente autónomo, no instala una capa invisible dentro de Atlas/Aletheia/Tekton, no vigila conversaciones de forma continua y no concede a una IA autoridad para actuar por encima de la gobernanza del proyecto.

Una posible fase futura debe diseñarse por separado: principios comunes de custodia, evaluaciones independientes por investigador, gestión de conflictos, controles de acceso, registros auditables y un proceso humano para revisar alertas. Esa fase requiere definición y revisión explícitas antes de implementarse.

## 7. Estado verificado

- CI estática y pruebas del runner aprobadas en la rama aislada.
- No se ha ejecutado ninguna escritura real con este executor.
- La consulta más reciente de Supabase mostró **0 relaciones semánticas y 0 eventos de relación**.
- Las claves y el entorno protegido de Tlacuilo no están configurados.
- Las ramas y los PR permanecen aislados; no se ha fusionado código a `main`, no se ha desplegado el ejecutor y el servicio Atlas de Render no se ha modificado.

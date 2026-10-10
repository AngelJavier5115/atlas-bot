# Tlacuilo — primera aplicación técnica del principio de custodia de Arkhé

**Estado:** prototipo en ramas aisladas; no aprobado para producción.  
**Alcance de esta versión:** comprobar precondiciones y, sólo con autorización explícita, intentar una única propuesta de relación semántica entre los nodos #5 y #6 en el Preview del Dashboard.

## 1. Principio de custodia aplicado

Tlacuilo representa aquí una función de revisión de integridad: observar puntos ciegos, examinar riesgos que pudieran pasar inadvertidos, advertir cuando una acción amenace la trazabilidad del proyecto y ayudar a hacer explícitas las decisiones difíciles.

Su finalidad no es manipular ni atacar a otros investigadores. La custodia debe proteger la capacidad de Arkhé para investigar, aprender y corregirse, incluso cuando aparezca información incómoda. Por eso el guard no puede suprimir desacuerdos, esconder evidencia ni sustituir la evaluación epistemológica de los investigadores.

Este prototipo fija una aplicación técnica pequeña y comprobable de ese principio. No debe presentarse como un protocolo Tlacuilo definitivo ni como la futura capa de custodia independiente de cada investigador; ese diseño más amplio queda fuera de alcance y requiere una definición posterior.

## 2. Las cuatro funciones del prototipo

### Observar
Tlacuilo verifica la configuración permitida, lee el contenido exacto de los nodos #5 y #6, consulta ambas direcciones de relación y comprueba que el historial pueda leerse. Registra qué comprobaciones pasaron sin almacenar valores de secretos.

### Proteger
Si el destino es inesperado, cambia el contenido aprobado, existe ya una relación, no hay permisos de lectura suficientes o la autenticación falla, Tlacuilo bloquea la escritura. La política se vuelve a aplicar en la API: no depende sólo del ejecutor.

### Corregir
En este primer prototipo, corregir significa clasificar el problema y preparar una acción concreta y acotada. La corrección automática sólo debe habilitarse para tareas reversibles, no persistentes y permitidas por una lista explícita. En esta operación aún no hay correcciones automáticas autorizadas: cambiar destinos, claves, permisos, nodos, relaciones o afirmaciones requiere revisión humana.

Ejemplos:
- configuración ausente: indicar qué nombre de secreto falta, sin leer ni mostrar su valor;
- destino incorrecto: recomendar la ruta aprobada, sin redirigir la petición automáticamente;
- nodo cambiado: solicitar revisión de la propuesta, sin editar el nodo para hacerlo coincidir;
- permiso insuficiente: pedir la capacidad mínima necesaria, sin elevar credenciales a una clave administrativa;
- resultado ambiguo después del POST: reconciliar manualmente la relación y el historial, sin repetir la operación.

### Rendir cuentas
Cada ejecución emite un informe estructurado y un resumen de GitHub Actions con el resultado, la fase, la anomalía clasificada si la hay, la corrección recomendada, el estado de la escritura y si quedó verificada. No se guardan secretos ni el error bruto. Un resultado ambiguo queda marcado como desconocido y requiere reconciliación humana.

## 3. Traducción a una operación del Dashboard

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

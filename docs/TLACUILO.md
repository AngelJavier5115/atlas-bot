# Tlacuilo — custodio de operaciones controladas de Arkhé

**Estado:** prototipo en rama aislada; no aprobado para producción.  
**Propósito inmediato:** probar de extremo a extremo una sola propuesta de relación semántica entre los nodos #5 y #6 en el Preview de Arkhé.

## Inspiración y límites

Tlacuilo toma su inspiración de la preocupación de Arkhé por proteger el tronco y las raíces sin impedir que el proyecto evolucione. El Archivo Maestro documenta el **Protocolo de Custodia del Proyecto** y distingue los cambios operativos de los cambios que modifican la identidad, los principios o la arquitectura metodológica del proyecto.

Esta implementación es una aplicación técnica propuesta de ese principio; no pretende afirmar que el nombre o todos los detalles operativos ya estuvieran formalizados en la memoria histórica de Tlacuilo.

**Tlacuilo escribe bajo autorización; no gobierna Arkhé.** No puede aprobar una relación, modificar principios, cambiar la configuración del proyecto, desplegar servicios ni fusionar código.

## Invariantes de custodia

1. **Aislamiento:** sólo se ejecuta desde `security/tlacuilo-executor`. El código no se importa desde el proceso normal de Atlas.
2. **Primero lectura:** `mode=preflight` comprueba configuración, texto de los nodos y ausencia de una relación en ambas direcciones. No contiene operaciones de escritura.
3. **Autorización explícita:** crear una relación requiere seleccionar `execute` y escribir exactamente `CREATE_RELATION_5_6_ONCE`.
4. **Destino cerrado:** el ejecutor codifica el endpoint exacto de Preview de `design/tree-network-dashboard` y el proyecto Supabase autorizado. Rechaza destinos distintos.
5. **Identidad criptográfica:** la API deriva la identidad de Atlas de una firma Ed25519 válida. Tlacuilo no envía identidad ni procedencia en el cuerpo de la petición.
6. **Escritura a través de la API:** el ejecutor nunca escribe directamente en las tablas semánticas; las escrituras pasan por la API y sus RPC restringidos.
7. **No repetir tras ambigüedad:** si hay timeout o no se puede verificar el resultado después de una escritura, Tlacuilo se detiene. No reintenta automáticamente.
8. **Secretos fuera del código y los registros:** las claves se almacenan como secretos protegidos de GitHub/Vercel. No se imprimen, guardan como artefactos ni se registran en texto.
9. **Permisos mínimos:** el workflow sólo pide `contents: read`, no despliega y no modifica el repositorio.
10. **Control humano:** los cambios constitucionales, la fusión a `main`, la ejecución de la escritura y la retirada final de credenciales requieren decisión humana explícita.

## Flujo de ejecución

### 1. Preflight de solo lectura

El workflow ejecuta las pruebas del verificador y `scripts/tlacuilo-preflight.mjs`. Verifica:

- que Supabase corresponde al proyecto autorizado;
- que los textos de los nodos #5 y #6 coinciden exactamente con lo aprobado;
- que no exista una relación #5 → #6 ni #6 → #5;
- que todas las lecturas se puedan completar sin errores.

Si cualquier comprobación falla, termina sin escribir.

### 2. Preparar credenciales fuera del repositorio

Crear una pareja Ed25519 nueva en un entorno local confiable o mediante un procedimiento corporativo equivalente. No copiar claves a esta conversación.

- Añadir la **clave privada** como secreto de Environment `tlacuilo-preview`: `TLACUILO_SIGNING_PRIVATE_KEY`.
- Añadir la **clave pública correspondiente** en Vercel como `ARKHE_ATLAS_PUBLIC_KEY`, con ámbito exclusivo `Preview` y rama `design/tree-network-dashboard`.
- Añadir el bypass de automatización de Preview como `TLACUILO_VERCEL_PROTECTION_BYPASS`, sólo si la protección de Vercel lo requiere.
- Añadir `TLACUILO_SUPABASE_READ_KEY` como clave de lectura capaz de consultar los nodos, las relaciones y sus eventos.

El valor de `TLACUILO_SUPABASE_READ_KEY` debe tener el menor permiso posible. Se debe probar primero con una clave de lectura pública/limitada; si las políticas RLS no permiten verificar filas, la ejecución debe detenerse. No sustituirla por una clave administrativa amplia sin diseñar y revisar primero un acceso de lectura más estrecho.

Crear el Environment `tlacuilo-preview` en GitHub y configurar una regla de aprobación humana antes de almacenar o usar los secretos. No guardar secretos en variables públicas, commits, comentarios, capturas ni logs.

### 3. Ejecución única

Desde GitHub Actions:

- Elegir `Tlacuilo - controlled semantic smoke`.
- Seleccionar la rama `security/tlacuilo-executor`.
- Ejecutar primero `preflight`.
- Revisar el resultado.
- Sólo para la operación expresamente aprobada, seleccionar `execute` y escribir `CREATE_RELATION_5_6_ONCE`.

La ejecución sólo intenta crear la relación #5 → #6, tipo `duplicates`, con el texto documentado en `SEMANTIC_RELATION_SMOKE.md`. No inventa proveedor, modelo, referencia de ejecución ni fuente externa.

### 4. Verificación y cierre

Después de la respuesta de la API, el runner verifica la relación, la identidad atribuida a Atlas y el evento de creación. Un resultado incompleto requiere inspección manual y **no** una repetición automática.

Al finalizar:

- comprobar manualmente los resultados;
- retirar/revocar el bypass temporal de Preview;
- eliminar los secretos temporales de GitHub;
- quitar o vaciar la clave pública de prueba de la rama Preview si la clave no se reutilizará;
- registrar si la prueba tuvo éxito, falló antes de escribir o terminó con resultado ambiguo;
- dejar la escritura de nuevas relaciones deshabilitada hasta otra autorización.

## Límite de esta versión

El workflow está preparado para ser manual, pero GitHub sólo ofrece el disparador `workflow_dispatch` cuando el archivo existe en la rama predeterminada del repositorio. Por tanto, este prototipo en rama **no se puede despachar todavía desde Actions sin una decisión adicional**: revisar un PR de workflow en la rama predeterminada o trasladar estos archivos a un repositorio privado dedicado. Esta propuesta no autoriza por sí sola una fusión a `main`.

Hasta que se configure el Environment, se establezcan las claves correctas y se ejecute un preflight satisfactorio, no hay ninguna relación semántica nueva registrada.

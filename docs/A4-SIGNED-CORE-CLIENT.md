# Cliente firmado de Arkhé Core — Atlas

**Estado:** rama de preparación para revisión; no desplegar todavía.  
**PR:** https://github.com/AngelJavier5115/atlas-bot/pull/3

## Qué hace

El cliente identifica el servicio como `atlas` y firma cada POST a Arkhé Core con Ed25519. La firma vincula el identificador de servicio, el timestamp, un nonce único y el hash SHA-256 del JSON serializado exacto que se envía. Cada repositorio contiene la identidad de servicio fija correspondiente; no existe una variable para que el usuario cambie la identidad durante la petición.

El POST no utiliza `ARKHE_CORE_TOKEN` como credencial de autorización. La función de salud GET conserva ese token compartido sólo durante la transición.

## Límite del cliente

El cliente firmado sólo permite estas acciones:
- `obtener_convocatoria`
- `completar_convocatoria`
- `fallar_convocatoria`

Las acciones de gobierno —`iniciar_ronda`, `convocar_investigadores`, `abrir_debate`, `pausar_ronda`, `cerrar_ronda` y `cancelar_ronda`— fallan antes de cualquier petición de red. Requieren el flujo humano WebAuthn del Core; una firma del investigador no es una firma humana.

Los comandos de Discord que antes intentaban crear rondas enviando `actor_id` no son compatibles con esta frontera por diseño y no deben desplegarse junto con este cambio hasta que el flujo de gobierno humano haya sido integrado. No se debe sustituir WebAuthn por el antiguo token compartido ni permitir que un bot declare a Ángel como actor.

## Configuración prevista — sólo Preview, después de revisar A.4

En el servicio Render de Atlas, el secreto local se llamará `ARKHE_SERVICE_PRIVATE_KEY`. Su valor debe ser una llave privada Ed25519 PEM exclusiva de este servicio; nunca se guarda en este repositorio, en el chat ni en una variable `VITE_*`.

En el proyecto Vercel del Dashboard para Preview, la llave pública correspondiente se configura como `ARKHE_ATLAS_PUBLIC_KEY`, limitada a la rama `security/a4-human-auth` o al Preview de integración que el plan de despliegue defina. No añadir esta variable a producción durante la fase de pruebas.

Las llaves de Atlas, Aletheia y Tekton deben ser pares distintos. Si se pierde la llave privada, generar una nueva y rotar su llave pública; no intentar reconstruirla desde la firma.

## Despacho entrante firmado desde Arkhé Core

La ruta `POST /arkhe/invocation` dejó de aceptar `x-arkhe-core-token` como autenticación del despacho en esta rama. Verifica una firma Ed25519 con la clave pública `ARKHE_CORE_DISPATCH_PUBLIC_KEY`, fija el destinatario a `atlas`, valida timestamp/UUID/body exacto y comprueba que `dispatch_id` coincide con el JSON.

Al aceptar:
1. El bot envía al Core una petición firmada con su propia identidad de investigador: `claim_convocation_dispatch`.
2. El Core registra la reclamación de un solo uso en `core_dispatch_claims`. El índice único por `dispatch_id` y la restricción única por `convocatoria_id` impiden reclamar de nuevo la misma convocatoria.
3. Sólo después de registrar la reclamación, el bot responde HTTP `202` con el mismo `dispatch_id` y continúa el procesamiento en segundo plano dentro del proceso Render.

El Core firma el despacho con una llave distinta de las llaves privadas de Atlas/Aletheia/Tekton. Ningún bot almacena esa llave privada del Core. La firma incluye el nombre del destinatario, así que una petición destinada a otro investigador se rechaza.

### Variables de entorno previstas (sólo cuando exista staging)

En el servicio Render de Atlas, únicamente después de crear un servicio de prueba separado, configurar:
- `ARKHE_CORE_DISPATCH_PUBLIC_KEY`: la clave pública del firmante del Core; nunca una clave privada.
- `ARKHE_SERVICE_PRIVATE_KEY`: la llave privada Ed25519 del propio investigador para solicitudes POST a Core.

No fijes estas variables en producción todavía. El host de Preview previsto para este investigador es `https://arkhe-atlas-preview.onrender.com`; debe existir realmente como servicio de prueba separado antes de que el Preview de Vercel pueda despacharle. El código del Core bloquea Preview si el destino no coincide con el hostname de staging exacto, y Production permanece deshabilitado sin `ARKHE_CORE_DISPATCH_ENABLED=true`.

**No hay llaves cargadas ni despliegue hecho por este cambio.** La migración de `core_dispatch_claims` está sólo en la rama Draft del Dashboard y no se ha aplicado al Supabase compartido.

Si el envío resulta ambiguo, no se reenvía automáticamente. La convocatoria queda para reconciliación manual; una reclamación duplicada se rechaza con conflicto. El worker de investigación corre después del HTTP 202 y todavía requiere observabilidad/recuperación operacional antes de producción.

## Pruebas

`npm test` usa `node:test` y pares Ed25519 efímeros generados durante la prueba. No usa secretos, no realiza peticiones reales ni escribe en Supabase. Las pruebas verifican:
- la firma válida del cuerpo exacto;
- que modificar el cuerpo invalida la firma;
- que no se usa el token compartido en POST;
- que la ausencia de la llave privada falla cerrada;
- que una llave de otro algoritmo se rechaza;
- que las acciones de gobierno se bloquean antes de la red.

## Compuertas pendientes antes de fusionar o desplegar

1. Completar el PR A.4 de la API/Core y verificar que su Preview está configurado con la llave pública exacta.
2. Cambiar el flujo de Discord para que los comandos de investigador ejecuten sólo convocatorias ya creadas y no intenten gobernar rondas. La autorización humana debe suceder en el Core por WebAuthn.
3. Probar los tres servicios por separado en Preview con claves exclusivas y registrar rollback.
4. Confirmar que las funciones de completar convocatoria son transaccionales e idempotentes en la rama de integración.
5. No configurar secretos ni cambiar servicios Render/producción durante esta preparación.

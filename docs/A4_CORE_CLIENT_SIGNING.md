# A.4 — Cliente firmado de Arkhé Core

## Alcance de esta rama

Esta rama adapta únicamente el cliente POST de este bot para que firme cada cuerpo JSON con una identidad Ed25519 propia. No cambia el Core desplegado, los comandos del bot, los modelos ni la configuración de Render.

## Variables que serán necesarias en una futura validación Preview

- `ARKHE_CORE_URL`: endpoint Core del entorno aislado que se esté probando.
- `ARKHE_SERVICE_PRIVATE_KEY`: clave privada Ed25519 PEM exclusiva de este servicio. No compartirla con otros bots, no guardarla en Git, artefactos o chat.
- `ARKHE_CORE_TOKEN`: se conserva temporalmente sólo para el GET de `coreHealth()`; las peticiones POST no lo envían ni hacen fallback a él.

La clave pública correspondiente debe configurarse en el entorno Preview autorizado del Dashboard como variable distinta para este investigador. No generar ni configurar llaves de producción como parte de esta rama.

## Contrato de firma

El cliente serializa el cuerpo JSON una sola vez y firma:
`service_id.timestamp.nonce.sha256(serialized_body)`

Headers: `x-arkhe-service-id`, `x-arkhe-timestamp`, `x-arkhe-nonce`, `x-arkhe-signature`.

La API valida la identidad contra la clave pública configurada, rechaza nonces repetidos y deriva el investigador desde el servicio autenticado. Si falta la clave privada o no es Ed25519, la petición falla de forma cerrada.

## Estado

La CI de esta rama prueba la firma, la vinculación al cuerpo exacto y que un POST no envíe el token común. Estas pruebas no demuestran integración runtime ni autorización para configurar secretos o desplegar el servicio.

import { createHash, createPublicKey, verify } from 'node:crypto';

export const CORE_DISPATCH_TARGET = 'atlas';
export const MAX_DISPATCH_CLOCK_SKEW_MS = 2 * 60 * 1000;

function getHeader(headers, name) {
  const value = headers?.[name];
  return Array.isArray(value) ? value[0] : value;
}

export function buildCoreDispatchPayload({
  serviceId,
  timestamp,
  dispatchId,
  serializedBody
}) {
  const bodyHash = createHash('sha256')
    .update(serializedBody, 'utf8')
    .digest('hex');
  return [
    'arkhe-core-dispatch-v1',
    serviceId,
    String(timestamp),
    dispatchId,
    bodyHash
  ].join('.');
}

function dispatchError(message, status = 401) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function authenticateCoreDispatch({
  headers,
  serializedBody,
  expectedServiceId = CORE_DISPATCH_TARGET,
  publicKeyPem = process.env.ARKHE_CORE_DISPATCH_PUBLIC_KEY,
  now = Date.now()
}) {
  if (typeof serializedBody !== 'string' || serializedBody.length > 16384) {
    throw dispatchError('El cuerpo del despacho no es válido.', 400);
  }

  const serviceId = getHeader(headers, 'x-arkhe-dispatch-target');
  const timestamp = getHeader(headers, 'x-arkhe-dispatch-timestamp');
  const dispatchId = getHeader(headers, 'x-arkhe-dispatch-id');
  const signature = getHeader(headers, 'x-arkhe-dispatch-signature');

  if (serviceId !== expectedServiceId) {
    throw dispatchError('El despacho no está dirigido a este investigador.');
  }
  if (!publicKeyPem) {
    throw dispatchError('ARKHE_CORE_DISPATCH_PUBLIC_KEY no está configurado.', 503);
  }

  const numericTimestamp = Number(timestamp);
  if (!Number.isSafeInteger(numericTimestamp) ||
      Math.abs(now - numericTimestamp) > MAX_DISPATCH_CLOCK_SKEW_MS) {
    throw dispatchError('El despacho firmado está fuera de la ventana temporal.');
  }
  if (typeof dispatchId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dispatchId)) {
    throw dispatchError('El identificador del despacho no es un UUID v4.');
  }

  let body;
  try {
    body = JSON.parse(serializedBody);
  } catch {
    throw dispatchError('El cuerpo del despacho no contiene JSON válido.', 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      body.dispatch_id !== dispatchId ||
      typeof body.convocatoria_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.convocatoria_id)) {
    throw dispatchError('El cuerpo del despacho no coincide con el formato esperado.', 400);
  }
  if (body.discord_channel_id != null &&
      (typeof body.discord_channel_id !== 'string' ||
       !/^\\d{17,20}$/.test(body.discord_channel_id))) {
    throw dispatchError('discord_channel_id no es válido.', 400);
  }

  const payload = buildCoreDispatchPayload({
    serviceId,
    timestamp: numericTimestamp,
    dispatchId,
    serializedBody
  });

  try {
    const key = createPublicKey(String(publicKeyPem).replace(/\\n/g, '\n').trim());
    if (key.asymmetricKeyType !== 'ed25519') {
      throw dispatchError('La llave pública de despacho debe ser Ed25519.', 503);
    }
    const verified = verify(
      null,
      Buffer.from(payload, 'utf8'),
      key,
      Buffer.from(signature ?? '', 'base64url')
    );
    if (!verified) throw dispatchError('Firma de despacho inválida.');
  } catch (error) {
    if (error?.status) throw error;
    throw dispatchError('ARKHE_CORE_DISPATCH_PUBLIC_KEY no es una llave Ed25519 válida.', 503);
  }

  return {
    serviceId,
    dispatchId,
    convocatoriaId: body.convocatoria_id,
    discordChannelId: body.discord_channel_id ?? null,
    body
  };
}

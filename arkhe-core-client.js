import { createHash, createPrivateKey, randomUUID, sign } from 'node:crypto';

const CORE_URL = process.env.ARKHE_CORE_URL;
const CORE_TOKEN = process.env.ARKHE_CORE_TOKEN;
const SERVICE_ID = process.env.ARKHE_SERVICE_ID;
const SERVICE_PRIVATE_KEY = process.env.ARKHE_SERVICE_PRIVATE_KEY;

function buildSigningPayload({ serviceId, timestamp, nonce, body }) {
  const bodyHash = createHash('sha256')
    .update(JSON.stringify(body ?? {}), 'utf8')
    .digest('hex');

  return [serviceId, String(timestamp), nonce, bodyHash].join('.');
}

function signedHeaders(body) {
  if (!SERVICE_ID) throw new Error('ARKHE_SERVICE_ID no está configurado.');
  if (!SERVICE_PRIVATE_KEY) throw new Error('ARKHE_SERVICE_PRIVATE_KEY no está configurado.');

  const timestamp = Date.now();
  const nonce = randomUUID();
  const payload = buildSigningPayload({
    serviceId: SERVICE_ID,
    timestamp,
    nonce,
    body
  });

  const signature = sign(
    null,
    Buffer.from(payload, 'utf8'),
    createPrivateKey(SERVICE_PRIVATE_KEY)
  ).toString('base64url');

  return {
    'Content-Type': 'application/json',
    'x-arkhe-service-id': SERVICE_ID,
    'x-arkhe-timestamp': String(timestamp),
    'x-arkhe-nonce': nonce,
    'x-arkhe-signature': signature,
    ...(CORE_TOKEN ? { 'x-arkhe-core-token': CORE_TOKEN } : {})
  };
}

export async function coreRequest(payload) {
  if (!CORE_URL) throw new Error('ARKHE_CORE_URL no está configurado.');

  const response = await fetch(CORE_URL, {
    method: 'POST',
    headers: signedHeaders(payload),
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error('Arkhe Core respondió con HTTP ' + response.status + ' sin JSON válido.');
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || 'Arkhe Core respondió HTTP ' + response.status + '.');
  }

  return data;
}

export async function coreHealth() {
  if (!CORE_URL || !CORE_TOKEN) return { ok: false };

  try {
    const response = await fetch(CORE_URL, {
      headers: { 'x-arkhe-core-token': CORE_TOKEN }
    });

    return response.ok ? await response.json() : { ok: false };
  } catch {
    return { ok: false };
  }
}

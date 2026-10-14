import { createHash, createPrivateKey, randomUUID, sign } from 'node:crypto';

export const CORE_SERVICE_ID = 'atlas';

const INVESTIGATOR_ACTIONS = new Set([
  'obtener_convocatoria',
  'completar_convocatoria',
  'fallar_convocatoria',
  'claim_convocation_dispatch',
  'diagnosticar_conexion'
]);

function normalizePrivateKeyPem(value) {
  return String(value).replace(/\\n/g, '\n').trim();
}

export function buildSigningPayload({ timestamp, nonce, serializedBody }) {
  const bodyHash = createHash('sha256')
    .update(serializedBody, 'utf8')
    .digest('hex');
  return [CORE_SERVICE_ID, String(timestamp), nonce, bodyHash].join('.');
}

export function buildServiceAuthHeaders(serializedBody, {
  privateKeyPem = process.env.ARKHE_SERVICE_PRIVATE_KEY,
  timestamp = Date.now(),
  nonce = randomUUID()
} = {}) {
  if (typeof serializedBody !== 'string') {
    throw new TypeError('El cuerpo firmado debe ser el JSON serializado exacto que se enviará.');
  }
  if (!privateKeyPem) {
    throw new Error('ARKHE_SERVICE_PRIVATE_KEY no está configurado para ' + CORE_SERVICE_ID + '.');
  }
  if (!Number.isSafeInteger(Number(timestamp))) {
    throw new Error('Timestamp de firma no válido.');
  }
  if (typeof nonce !== 'string' || nonce.length < 8 || nonce.length > 200) {
    throw new Error('Nonce de firma no válido.');
  }

  let privateKey;
  try {
    privateKey = createPrivateKey(normalizePrivateKeyPem(privateKeyPem));
  } catch {
    throw new Error('ARKHE_SERVICE_PRIVATE_KEY no contiene una llave privada PEM válida.');
  }
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('ARKHE_SERVICE_PRIVATE_KEY debe ser una llave Ed25519.');
  }

  const signingPayload = buildSigningPayload({
    timestamp,
    nonce,
    serializedBody
  });
  const signature = sign(
    null,
    Buffer.from(signingPayload, 'utf8'),
    privateKey
  ).toString('base64url');

  return {
    'x-arkhe-service-id': CORE_SERVICE_ID,
    'x-arkhe-timestamp': String(timestamp),
    'x-arkhe-nonce': nonce,
    'x-arkhe-signature': signature
  };
}

export function buildCoreProtectionHeaders({
  url = process.env.ARKHE_CORE_URL,
  bypassSecret = process.env.ARKHE_VERCEL_PREVIEW_BYPASS_SECRET,
  previewMode = process.env.ARKHE_A4_PREVIEW_NO_DISCORD
} = {}) {
  if (previewMode !== 'true' || typeof bypassSecret !== 'string' || !bypassSecret.trim()) {
    return {};
  }

  let target;
  try {
    target = new URL(url);
  } catch {
    return {};
  }

  // Never send a deployment-protection bypass to arbitrary URLs or production.
  if (
    target.protocol !== 'https:' ||
    target.hostname !== 'arkhe-dashboard-git-security-a4-idempotent-completion-arkhe7.vercel.app' ||
    target.pathname !== '/api/arkhe-core' ||
    target.search !== ''
  ) {
    return {};
  }

  return { 'x-vercel-protection-bypass': bypassSecret.trim() };
}

export async function coreRequest(payload) {
  const url = process.env.ARKHE_CORE_URL;
  if (!url) throw new Error('ARKHE_CORE_URL no está configurado.');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('La petición de Arkhé Core debe ser un objeto JSON.');
  }
  if (!INVESTIGATOR_ACTIONS.has(payload.action)) {
    throw new Error(
      'La acción "' + String(payload.action ?? 'desconocida') +
      '" requiere autorización humana y no está permitida para el servicio ' +
      CORE_SERVICE_ID + '. Usa el flujo de gobierno humano WebAuthn de Arkhé Core.'
    );
  }

  // Sign the exact JSON bytes that will be posted; do not fall back to the
  // shared bearer token if the service's private signing key is unavailable.
  const serializedBody = JSON.stringify(payload);
  const authHeaders = buildServiceAuthHeaders(serializedBody);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildCoreProtectionHeaders({ url }),
      ...authHeaders
    },
    body: serializedBody
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Arkhe Core respondió con HTTP ${response.status} sin JSON válido.`);
  }

  if (!response.ok || data?.ok === false) {
    const rawError = data?.error;
    const message = typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object'
        ? (typeof rawError.message === 'string' ? rawError.message
          : typeof rawError.code === 'string' ? rawError.code
          : 'Core devolvió un objeto de error sin mensaje legible.')
        : `Arkhe Core respondió HTTP ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    if (typeof rawError?.code === 'string') error.code = rawError.code;
    throw error;
  }

  return data;
}

// Transitional health check only. POST actions use per-service Ed25519 signatures.
export async function coreHealth() {
  const url = process.env.ARKHE_CORE_URL;
  const token = process.env.ARKHE_CORE_TOKEN;
  if (!url || !token) return { ok: false };
  try {
    const response = await fetch(url, {
      headers: { 'x-arkhe-core-token': token }
    });
    return response.ok ? await response.json() : { ok: false };
  } catch {
    return { ok: false };
  }
}

const CORE_URL = process.env.ARKHE_CORE_URL;
const CORE_TOKEN = process.env.ARKHE_CORE_TOKEN;

export async function coreRequest(payload) {
  if (!CORE_URL) throw new Error('ARKHE_CORE_URL no está configurado.');
  if (!CORE_TOKEN) throw new Error('ARKHE_CORE_TOKEN no está configurado.');

  const response = await fetch(CORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-arkhe-core-token': CORE_TOKEN
    },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Arkhe Core respondió con HTTP ${response.status} sin JSON válido.`);
  }

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || `Arkhe Core respondió HTTP ${response.status}.`);
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

import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { coreRequest } from '../arkhe-core-client.js';

export const SMOKE_CONFIRMATION = 'CREATE_RELATION_5_6_ONCE';
export const ATLAS_ID = '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f';
export const EXPECTED_NODE_TEXTS = Object.freeze({
  5: 'El uso de arquitecturas basadas en eventos optimiza la sincronización entre nodos en tiempo real.',
  6: 'El uso de arquitecturas orientadas a eventos optimiza la sincronización en tiempo real.',
});

export function buildApprovedRelationBody() {
  return {
    action: 'create',
    source_node_id: 5,
    target_node_id: 6,
    relation_type: 'duplicates',
    assertion: 'Los nodos #5 y #6 parecen expresar la misma afirmación general: que las arquitecturas basadas u orientadas a eventos favorecen la sincronización en tiempo real. Con los textos disponibles no se aprecia una diferencia conceptual clara entre ambos registros; la relación queda como propuesta y puede ser discutida o rechazada.',
    evidence_text: 'Comparación directa de los registros existentes. El nodo #5 afirma que las arquitecturas basadas en eventos optimizan la sincronización entre nodos en tiempo real; el nodo #6 afirma que las arquitecturas orientadas a eventos optimizan la sincronización en tiempo real. Coinciden en la idea central y difieren en formulación y alcance explícito (entre nodos). No se ha aportado una fuente externa en esta prueba; la clasificación se apoya sólo en el texto de ambos nodos y no equivale a verificación externa.',
    evidence_node_id: null,
    evidence_uri: null,
    provider: null,
    model: null,
    run_ref: null,
    supersedes_relation_id: null,
  };
}

export function validateSmokeConfiguration(env = process.env) {
  if (env.ARKHE_ENABLE_SEMANTIC_RELATION_SMOKE !== SMOKE_CONFIRMATION) {
    throw new Error('La escritura está deshabilitada. Configura ARKHE_ENABLE_SEMANTIC_RELATION_SMOKE con la confirmación exacta sólo para la ejecución aislada aprobada.');
  }
  if (env.ARKHE_SERVICE_ID !== 'atlas') {
    throw new Error('El cliente de smoke sólo está autorizado para ARKHE_SERVICE_ID=atlas.');
  }

  const required = [
    'ARKHE_CORE_URL',
    'ARKHE_SERVICE_PRIVATE_KEY',
    'ARKHE_VERCEL_PROTECTION_BYPASS',
    'SUPABASE_URL',
    'SUPABASE_KEY',
  ];
  const missing = required.filter(name => !String(env[name] ?? '').trim());
  if (missing.length) throw new Error('Faltan variables necesarias: ' + missing.join(', ') + '. No se ha enviado ninguna petición.');

  let coreUrl;
  let supabaseUrl;
  try {
    coreUrl = new URL(env.ARKHE_CORE_URL);
    supabaseUrl = new URL(env.SUPABASE_URL);
  } catch {
    throw new Error('ARKHE_CORE_URL y SUPABASE_URL deben ser URL válidas.');
  }

  if (
    coreUrl.protocol !== 'https:' ||
    coreUrl.hostname !== 'arkhe-dashboard-git-design-tree-network-dashboard-arkhe7.vercel.app' ||
    coreUrl.pathname !== '/api/semantic-relations' ||
    coreUrl.search ||
    coreUrl.hash
  ) {
    throw new Error('La URL Core debe ser exclusivamente el endpoint /api/semantic-relations del Preview de design/tree-network-dashboard; producción queda bloqueada.');
  }
  if (supabaseUrl.protocol !== 'https:' || supabaseUrl.hostname !== 'xbdbdwfzcuqqudrbapom.supabase.co') {
    throw new Error('El smoke sólo puede leer y verificar el proyecto Supabase de Arkhé autorizado.');
  }

  return true;
}

async function selectExistingRelations(supabase) {
  const [forward, reverse] = await Promise.all([
    supabase.from('arkhe_semantic_relations')
      .select('id, source_node_id, target_node_id, relation_type')
      .eq('source_node_id', 5).eq('target_node_id', 6),
    supabase.from('arkhe_semantic_relations')
      .select('id, source_node_id, target_node_id, relation_type')
      .eq('source_node_id', 6).eq('target_node_id', 5),
  ]);
  if (forward.error || reverse.error) {
    throw new Error('No se pudo comprobar si ya existe una relación entre los nodos #5 y #6; se cancela sin escribir.');
  }
  return [...(forward.data ?? []), ...(reverse.data ?? [])];
}

export async function runSemanticRelationSmoke({
  env = process.env,
  request = coreRequest,
  createSupabaseClient = createClient,
} = {}) {
  validateSmokeConfiguration(env);

  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: nodes, error: nodesError } = await supabase
    .from('investigaciones')
    .select('id, contenido')
    .in('id', [5, 6]);

  if (nodesError || !Array.isArray(nodes) || nodes.length !== 2) {
    throw new Error('No se pudieron verificar los dos nodos existentes; se cancela sin escribir.');
  }

  const nodeMap = new Map(nodes.map(node => [Number(node.id), node]));
  for (const [rawId, expectedText] of Object.entries(EXPECTED_NODE_TEXTS)) {
    const node = nodeMap.get(Number(rawId));
    if (!node || node.contenido !== expectedText) {
      throw new Error('El contenido del nodo #' + rawId + ' no coincide con la versión aprobada; se cancela sin escribir.');
    }
  }

  const existing = await selectExistingRelations(supabase);
  if (existing.length) {
    throw new Error('Ya existe una relación entre #5 y #6 (' + existing.map(row => row.id).join(', ') + '). No se crea duplicado; revisa los registros antes de continuar.');
  }

  const result = await request(buildApprovedRelationBody());
  const relationId = result?.relation_id;
  if (result?.ok !== true || typeof relationId !== 'string' || !relationId) {
    throw new Error('La API no confirmó la creación. No repitas automáticamente la operación; revisa la base antes de reintentar.');
  }

  // A timeout or a verification failure after HTTP 201 must never trigger a
  // second POST: the relation may already be persistent.
  const { data: relation, error: relationError } = await supabase
    .from('arkhe_semantic_relations')
    .select('id, source_node_id, target_node_id, relation_type, assertion, evidence_text, created_by_investigator_id, origin_kind, origin_channel, provenance')
    .eq('id', relationId)
    .maybeSingle();

  if (relationError || !relation) {
    throw new Error('La API devolvió HTTP 201, pero no se pudo verificar la relación ' + relationId + '. No reintentes: comprueba la fila manualmente.');
  }

  const validRelation =
    Number(relation.source_node_id) === 5 &&
    Number(relation.target_node_id) === 6 &&
    relation.relation_type === 'duplicates' &&
    relation.created_by_investigator_id === ATLAS_ID &&
    relation.origin_kind === 'investigator' &&
    relation.origin_channel === 'signed-service-api' &&
    relation.provenance?.authentication?.service_id === 'atlas' &&
    relation.provenance?.authentication?.signature_verified === true &&
    relation.provenance?.provider_attestation?.status === 'not_independently_verified';

  if (!validRelation) {
    throw new Error('La relación ' + relationId + ' existe, pero la identidad o procedencia no coincide con el contrato esperado. No reintentes; requiere revisión.');
  }

  const { data: events, error: eventError } = await supabase
    .from('arkhe_semantic_relation_events')
    .select('id, event_type, actor_investigator_id, actor_kind')
    .eq('relation_id', relationId)
    .order('created_at', { ascending: true });

  if (eventError || !Array.isArray(events) || events.length !== 1 ||
      events[0].event_type !== 'relation_created' ||
      events[0].actor_investigator_id !== ATLAS_ID ||
      events[0].actor_kind !== 'investigator') {
    throw new Error('La relación ' + relationId + ' existe, pero el historial no coincide con una única creación esperada. No reintentes; requiere revisión.');
  }

  return {
    ok: true,
    relation_id: relationId,
    source_node_id: 5,
    target_node_id: 6,
    relation_type: 'duplicates',
    created_by_investigator_id: ATLAS_ID,
    origin_channel: 'signed-service-api',
    verified_creation_events: 1,
    independent_provider_attestation: false,
  };
}

async function main() {
  try {
    const result = await runSemanticRelationSmoke();
    console.log('[Arkhé semantic smoke] Resultado verificado:', JSON.stringify(result));
  } catch (error) {
    console.error('[Arkhé semantic smoke] ABORTADO:', error?.message ?? 'Error desconocido.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}

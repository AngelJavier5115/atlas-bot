import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { buildTlacuiloReport, emitTlacuiloReport } from './tlacuilo-custody.mjs';

export const EXPECTED_NODE_TEXTS = Object.freeze({
  5: 'El uso de arquitecturas basadas en eventos optimiza la sincronización entre nodos en tiempo real.',
  6: 'El uso de arquitecturas orientadas a eventos optimiza la sincronización en tiempo real.',
});

const EXPECTED_SUPABASE_HOST = 'xbdbdwfzcuqqudrbapom.supabase.co';

export function validateTlacuiloPreflightConfig(env = process.env) {
  const missing = ['SUPABASE_URL', 'SUPABASE_KEY']
    .filter(name => !String(env[name] ?? '').trim());

  if (missing.length) {
    throw new Error('Falta configuración de lectura: ' + missing.join(', ') + '.');
  }

  let parsed;
  try {
    parsed = new URL(env.SUPABASE_URL);
  } catch {
    throw new Error('SUPABASE_URL no es una URL válida.');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== EXPECTED_SUPABASE_HOST) {
    throw new Error('Tlacuilo sólo puede consultar el proyecto Supabase autorizado de Arkhé.');
  }
}

export async function runTlacuiloPreflight({
  env = process.env,
  createSupabaseClient = createClient,
} = {}) {
  validateTlacuiloPreflightConfig(env);

  const checks = ['Configuración validada contra el proyecto Supabase autorizado.'];
  const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: nodes, error: nodesError } = await supabase
    .from('investigaciones')
    .select('id, contenido')
    .in('id', [5, 6]);

  if (nodesError || !Array.isArray(nodes) || nodes.length !== 2) {
    throw new Error('No se pudieron leer ambos nodos aprobados; Tlacuilo se detiene sin escribir.');
  }

  checks.push('Los nodos #5 y #6 están disponibles para inspección.');
  const nodeMap = new Map(nodes.map(node => [Number(node.id), node]));
  for (const [rawId, expectedText] of Object.entries(EXPECTED_NODE_TEXTS)) {
    if (nodeMap.get(Number(rawId))?.contenido !== expectedText) {
      throw new Error('El contenido del nodo #' + rawId + ' no coincide; Tlacuilo se detiene sin escribir.');
    }
  }

  checks.push('El contenido de ambos nodos coincide exactamente con lo aprobado.');
  const relationProjection = 'id, source_node_id, target_node_id, relation_type, assertion, evidence_text, created_by_investigator_id, origin_kind, origin_channel, provenance';
  const [forward, reverse, eventAccess] = await Promise.all([
    supabase.from('arkhe_semantic_relations')
      .select(relationProjection)
      .eq('source_node_id', 5)
      .eq('target_node_id', 6),
    supabase.from('arkhe_semantic_relations')
      .select(relationProjection)
      .eq('source_node_id', 6)
      .eq('target_node_id', 5),
    // Probe read permission on every event field needed for post-write verification.
    supabase.from('arkhe_semantic_relation_events')
      .select('id, event_type, actor_investigator_id, actor_kind')
      .limit(1),
  ]);

  if (forward.error || reverse.error) {
    throw new Error('No se pudo comprobar la relación en ambas direcciones; Tlacuilo se detiene sin escribir.');
  }
  if (eventAccess.error) {
    throw new Error('No se puede leer el historial necesario para verificar una escritura; Tlacuilo se detiene sin escribir.');
  }

  checks.push('La lectura de relaciones en ambas direcciones y del historial está disponible.');
  const existing = [...(forward.data ?? []), ...(reverse.data ?? [])];
  if (existing.length) {
    throw new Error('Ya existe una relación entre los nodos #5 y #6; Tlacuilo se detiene y no crea duplicados.');
  }

  return {
    ok: true,
    mode: 'preflight',
    source_node_id: 5,
    target_node_id: 6,
    approved_texts_match: true,
    relation_absent_in_both_directions: true,
    writes_performed: 0,
    checks,
    note: 'Comprobación de solo lectura. No se ha ejecutado ninguna corrección ni escritura persistente.',
  };
}

async function main() {
  try {
    const result = await runTlacuiloPreflight();
    await emitTlacuiloReport(buildTlacuiloReport({
      outcome: 'passed',
      phase: 'observe',
      checks: result.checks,
      writeState: 'not_attempted',
    }));
  } catch (error) {
    await emitTlacuiloReport(buildTlacuiloReport({
      outcome: 'aborted',
      error,
      checks: ['Preflight detenido antes de cualquier escritura.'],
    }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}

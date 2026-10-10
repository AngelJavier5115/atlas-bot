import { appendFile as appendFileAsync } from 'node:fs/promises';

export const TLACUILO_PROTOCOL = 'Tlacuilo';
export const TLACUILO_REPORT_VERSION = 1;

const CORRECTION_GUIDANCE = Object.freeze([
  {
    code: 'CONFIGURATION_MISSING',
    matches: [/Falta configuración de lectura/, /Faltan variables necesarias/],
    phase: 'observe',
    title: 'Falta configuración necesaria',
    risk: 'No hay contexto suficiente para comprobar de forma segura el destino o los datos.',
    correction: 'Configurar únicamente las variables requeridas en el entorno protegido. Verificar los nombres de secretos sin copiar sus valores a logs o chat.',
    authority: 'owner',
    autoCorrectable: false,
    writeState: 'not_attempted',
  },
  {
    code: 'TARGET_NOT_APPROVED',
    matches: [/URL Core debe ser exclusivamente/, /sólo puede consultar el proyecto Supabase autorizado/, /SUPABASE_URL no es una URL válida/, /ARKHE_CORE_URL y SUPABASE_URL deben ser URL válidas/],
    phase: 'protect',
    title: 'El destino no coincide con el permitido',
    risk: 'La petición podría alcanzar un entorno distinto del Preview autorizado.',
    correction: 'Comparar el host y la ruta con los destinos fijados en el código revisado. Cambiar la configuración requiere una corrección explícita; Tlacuilo no redirige silenciosamente la petición.',
    authority: 'human_review',
    autoCorrectable: false,
    writeState: 'not_attempted',
  },
  {
    code: 'APPROVED_STATE_CHANGED',
    matches: [/contenido del nodo #\d+ no coincide/, /No se pudieron leer ambos nodos aprobados/, /No se pudieron verificar los dos nodos existentes/],
    phase: 'protect',
    title: 'El estado observado difiere de la propuesta aprobada',
    risk: 'La operación podría registrar una relación basada en contenido cambiado o incompleto.',
    correction: 'Detenerse, comparar el contenido actual con el registro aprobado y pedir una nueva revisión de la propuesta. No editar los nodos para hacerlos coincidir.',
    authority: 'investigator_review',
    autoCorrectable: false,
    writeState: 'not_attempted',
  },
  {
    code: 'RELATION_ALREADY_EXISTS',
    matches: [/Ya existe una relación entre los nodos #5 y #6/, /Ya existe una relación entre #5 y #6/],
    phase: 'protect',
    title: 'La relación ya existe',
    risk: 'Un reintento podría duplicar el registro o alterar el historial.',
    correction: 'Inspeccionar la relación existente y su historial. No crear otra relación ni modificar la existente automáticamente.',
    authority: 'human_review',
    autoCorrectable: false,
    writeState: 'not_attempted',
  },
  {
    code: 'READ_VERIFICATION_UNAVAILABLE',
    matches: [/No se pudo comprobar la relación en ambas direcciones/, /No se puede leer el historial necesario/, /No se pudo leer el historial/],
    phase: 'protect',
    title: 'No se puede verificar el estado completo',
    risk: 'Sin lectura suficiente, el ejecutor no puede descartar duplicados ni demostrar el resultado.',
    correction: 'Revisar los permisos de lectura mínimos para nodos, relaciones y eventos. No sustituirlos automáticamente por una credencial administrativa más amplia.',
    authority: 'owner',
    autoCorrectable: false,
    writeState: 'not_attempted',
  },
  {
    code: 'AUTHENTICATION_MISMATCH',
    matches: [/Firma de servicio inválida/, /Servicio no reconocido/, /Falta la clave pública de servicio/, /Nonce ya utilizado/, /firma|clave pública/i],
    phase: 'protect',
    title: 'La identidad criptográfica no puede validarse',
    risk: 'La petición podría ser falsa, repetida o firmada con una clave que no corresponde al servicio autorizado.',
    correction: 'Verificar localmente la correspondencia entre clave pública, clave privada y service ID, sin mostrar las claves. Nunca desactivar la comprobación criptográfica para continuar.',
    authority: 'security_review',
    autoCorrectable: false,
    writeState: 'not_attempted',
  },
  {
    code: 'WRITE_RESULT_AMBIGUOUS',
    matches: [/No repitas/, /no se pudo verificar la relación/, /el historial no coincide/, /timeout|timed out|fetch failed|socket hang up/i],
    phase: 'account',
    title: 'El resultado de la escritura es incierto',
    risk: 'La operación podría haberse guardado aunque no se haya recibido o verificado una respuesta completa.',
    correction: 'No reintentar. Consultar manualmente la relación y sus eventos en Supabase; registrar el estado observado antes de decidir el siguiente paso.',
    authority: 'human_reconciliation',
    autoCorrectable: false,
    writeState: 'unknown',
  },
]);

const DEFAULT_GUIDANCE = Object.freeze({
  code: 'UNCLASSIFIED_FAILURE',
  phase: 'protect',
  title: 'Fallo no clasificado',
  risk: 'No se puede demostrar que las condiciones de seguridad se cumplan.',
  correction: 'Detenerse y revisar el error técnico sin compartir secretos. No efectuar una escritura hasta identificar y aprobar la corrección.',
  authority: 'human_review',
  autoCorrectable: false,
  writeState: 'not_attempted',
});

export function classifyTlacuiloFailure(error) {
  const message = String(error?.message ?? error ?? '');
  return CORRECTION_GUIDANCE.find(item => item.matches.some(pattern => pattern.test(message))) ?? DEFAULT_GUIDANCE;
}

export function buildTlacuiloReport({
  outcome,
  phase,
  checks = [],
  error = null,
  writeState = null,
  correctionApplied = false,
  runId = null,
} = {}) {
  const finding = error ? classifyTlacuiloFailure(error) : null;
  const finalWriteState = writeState ?? finding?.writeState ?? 'not_attempted';

  return {
    protocol: TLACUILO_PROTOCOL,
    report_version: TLACUILO_REPORT_VERSION,
    run_id: runId || process.env.GITHUB_RUN_ID || null,
    outcome: outcome ?? (error ? 'aborted' : 'passed'),
    phase: phase ?? finding?.phase ?? 'account',
    observed: {
      checks,
      ...(finding ? {
        finding: {
          code: finding.code,
          title: finding.title,
          risk: finding.risk,
        },
      } : {}),
    },
    protection: {
      writes_attempted: finalWriteState !== 'not_attempted',
      write_state: finalWriteState,
      automatic_correction_applied: correctionApplied,
    },
    correction: finding ? {
      mode: finding.autoCorrectable ? 'allowlisted-safe-correction' : 'proposal-only',
      automatic_allowed: finding.autoCorrectable,
      applied: correctionApplied,
      required_authority: finding.authority,
      recommended_action: finding.correction,
    } : {
      mode: 'none-required',
      automatic_allowed: false,
      applied: false,
      required_authority: 'none',
      recommended_action: 'No se detectó una anomalía que requiera corrección.',
    },
    accountability: {
      secrets_logged: false,
      raw_error_logged: false,
      automatic_retry: false,
      note: finalWriteState === 'unknown'
        ? 'Resultado incierto: requiere reconciliación manual antes de cualquier nuevo intento.'
        : finalWriteState === 'verified_created'
          ? 'La creación se verificó mediante lectura posterior; revisar la evidencia y retirar credenciales temporales.'
          : 'Informe sin valores de secretos; revisar la evidencia antes de autorizar cambios.',
    },
  };
}

export function renderTlacuiloReport(report) {
  const finding = report.observed.finding;
  const lines = [
    '# Informe Tlacuilo',
    '',
    `- **Resultado:** ${report.outcome}`,
    `- **Fase:** ${report.phase}`,
    `- **Escritura:** ${report.protection.write_state}`,
    `- **Corrección automática aplicada:** ${report.protection.automatic_correction_applied ? 'sí' : 'no'}`,
    '',
  ];

  if (finding) {
    lines.push(
      `## ${finding.code}: ${finding.title}`,
      '',
      finding.risk,
      '',
      '**Corrección recomendada:**',
      report.correction.recommended_action,
      '',
      `**Autoridad requerida:** ${report.correction.required_authority}`,
      '',
    );
  } else {
    lines.push('## Comprobaciones', '');
    for (const check of report.observed.checks) lines.push(`- ${check}`);
    lines.push('', report.correction.recommended_action, '');
  }

  lines.push(report.accountability.note);
  return lines.join('\n');
}

export async function emitTlacuiloReport(report, {
  logger = console,
  summaryPath = process.env.GITHUB_STEP_SUMMARY,
  appendFile = appendFileAsync,
} = {}) {
  const json = JSON.stringify(report);
  logger.log('[Tlacuilo] Informe de custodia:', json);
  if (summaryPath && appendFile) {
    await appendFile(summaryPath, renderTlacuiloReport(report) + '\n', 'utf8');
  }
  return report;
}

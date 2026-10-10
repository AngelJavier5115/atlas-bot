import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTlacuiloReport,
  classifyTlacuiloFailure,
  renderTlacuiloReport,
} from '../scripts/tlacuilo-custody.mjs';

test('Tlacuilo classifies missing configuration and proposes a bounded correction', () => {
  const report = buildTlacuiloReport({
    error: new Error('Falta configuración de lectura: SUPABASE_URL.'),
  });

  assert.equal(report.protocol, 'Tlacuilo');
  assert.equal(report.outcome, 'aborted');
  assert.equal(report.observed.finding.code, 'CONFIGURATION_MISSING');
  assert.equal(report.protection.write_state, 'not_attempted');
  assert.equal(report.correction.mode, 'proposal-only');
  assert.equal(report.correction.automatic_allowed, false);
  assert.match(report.correction.recommended_action, /entorno protegido/);
});

test('Tlacuilo protects the approved target and does not silently redirect requests', () => {
  const finding = classifyTlacuiloFailure(
    new Error('La URL Core debe ser exclusivamente el endpoint Preview autorizado.')
  );

  assert.equal(finding.code, 'TARGET_NOT_APPROVED');
  assert.equal(finding.authority, 'human_review');
  assert.equal(finding.autoCorrectable, false);
  assert.match(finding.correction, /no redirige silenciosamente/);
});

test('Tlacuilo requests review when an approved node changes instead of editing data to match', () => {
  const finding = classifyTlacuiloFailure(
    new Error('El contenido del nodo #6 no coincide con la versión aprobada.')
  );

  assert.equal(finding.code, 'APPROVED_STATE_CHANGED');
  assert.equal(finding.authority, 'investigator_review');
  assert.equal(finding.writeState, 'not_attempted');
  assert.match(finding.correction, /No editar los nodos/);
});

test('Tlacuilo never repeats an ambiguous write and asks for manual reconciliation', () => {
  const report = buildTlacuiloReport({
    error: new Error('La petición fue enviada pero no se recibió una respuesta concluyente. No reintentes.'),
  });

  assert.equal(report.observed.finding.code, 'WRITE_RESULT_AMBIGUOUS');
  assert.equal(report.protection.write_state, 'unknown');
  assert.equal(report.protection.writes_attempted, true);
  assert.equal(report.accountability.automatic_retry, false);
  assert.match(report.correction.recommended_action, /No reintentar/);
  assert.match(report.accountability.note, /reconciliación manual/);
});

test('Tlacuilo success report accounts for the verified write and cleanup', () => {
  const report = buildTlacuiloReport({
    outcome: 'verified',
    phase: 'account',
    checks: ['Relación verificada.', 'Evento de creación verificado.'],
    writeState: 'verified_created',
  });

  assert.equal(report.outcome, 'verified');
  assert.equal(report.protection.writes_attempted, true);
  assert.equal(report.protection.write_state, 'verified_created');
  assert.equal(report.correction.mode, 'none-required');
  assert.match(report.accountability.note, /retirar credenciales temporales/);
  assert.match(renderTlacuiloReport(report), /Relación verificada/);
});

test('Tlacuilo reports never include raw error text or credential values', () => {
  const secret = 'example-super-secret-do-not-log';
  const report = buildTlacuiloReport({
    error: new Error('Falta configuración de lectura: SUPABASE_KEY=' + secret),
  });

  const output = JSON.stringify(report) + renderTlacuiloReport(report);
  assert.equal(output.includes(secret), false);
  assert.equal(report.accountability.raw_error_logged, false);
  assert.equal(report.accountability.secrets_logged, false);
});

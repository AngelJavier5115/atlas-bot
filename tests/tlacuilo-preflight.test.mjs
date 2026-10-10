import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPECTED_NODE_TEXTS,
  runTlacuiloPreflight,
  validateTlacuiloPreflightConfig,
} from '../scripts/tlacuilo-preflight.mjs';

const validEnv = {
  SUPABASE_URL: 'https://xbdbdwfzcuqqudrbapom.supabase.co',
  SUPABASE_KEY: 'test-read-key',
};

function makeQueryBuilder(result) {
  let eqCalls = 0;
  const query = {
    select() { return query; },
    in() { return Promise.resolve(result); },
    limit() { return Promise.resolve(result); },
    eq() {
      eqCalls += 1;
      return eqCalls >= 2 ? Promise.resolve(result) : query;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
  };
  return query;
}

test('preflight refuses missing configuration before creating a client', async () => {
  let clientCreated = false;

  assert.throws(
    () => validateTlacuiloPreflightConfig({}),
    /Falta configuración de lectura/
  );

  await assert.rejects(
    runTlacuiloPreflight({
      env: {},
      createSupabaseClient() {
        clientCreated = true;
        throw new Error('No debe crear cliente con configuración inválida.');
      },
    }),
    /Falta configuración de lectura/
  );

  assert.equal(clientCreated, false);
});

test('preflight rejects any Supabase project other than the approved one', () => {
  assert.throws(
    () => validateTlacuiloPreflightConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_KEY: 'test-read-key',
    }),
    /sólo puede consultar el proyecto Supabase autorizado/
  );
});

test('preflight checks exact nodes and both relation directions without write methods', async () => {
  const nodes = [
    { id: 5, contenido: EXPECTED_NODE_TEXTS[5] },
    { id: 6, contenido: EXPECTED_NODE_TEXTS[6] },
  ];
  const tablesRead = [];
  let attemptedWrite = false;

  const fakeClient = {
    from(table) {
      tablesRead.push(table);
      let data;
      if (table === 'investigaciones') {
        data = nodes;
      } else if (table === 'arkhe_semantic_relations' || table === 'arkhe_semantic_relation_events') {
        data = [];
      } else {
        throw new Error('Tabla no autorizada en preflight: ' + table);
      }

      const query = makeQueryBuilder({ data, error: null });
      return {
        ...query,
        select: () => query,
        insert() {
          attemptedWrite = true;
          throw new Error('Preflight no puede escribir.');
        },
        update() {
          attemptedWrite = true;
          throw new Error('Preflight no puede escribir.');
        },
        delete() {
          attemptedWrite = true;
          throw new Error('Preflight no puede escribir.');
        },
      };
    },
  };

  const result = await runTlacuiloPreflight({
    env: validEnv,
    createSupabaseClient: (url, key) => {
      assert.equal(url, validEnv.SUPABASE_URL);
      assert.equal(key, validEnv.SUPABASE_KEY);
      return fakeClient;
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.writes_performed, 0);
  assert.equal(result.relation_absent_in_both_directions, true);
  assert.equal(attemptedWrite, false);
  assert.equal(tablesRead.filter(table => table === 'investigaciones').length, 1);
  assert.equal(tablesRead.filter(table => table === 'arkhe_semantic_relations').length, 2);
  assert.equal(tablesRead.filter(table => table === 'arkhe_semantic_relation_events').length, 1);
});

test('preflight stops if an approved node changes', async () => {
  const fakeClient = {
    from(table) {
      if (table !== 'investigaciones') {
        throw new Error('No debe consultar relaciones si los nodos no coinciden.');
      }
      return {
        select() {
          return {
            in: async () => ({
              data: [
                { id: 5, contenido: EXPECTED_NODE_TEXTS[5] },
                { id: 6, contenido: 'Texto cambiado' },
              ],
              error: null,
            }),
          };
        },
      };
    },
  };

  await assert.rejects(
    runTlacuiloPreflight({
      env: validEnv,
      createSupabaseClient: () => fakeClient,
    }),
    /contenido del nodo #6 no coincide/
  );
});

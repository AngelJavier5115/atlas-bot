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

test('Tlacuilo preflight refuses missing configuration before creating a client', async () => {
  let clientCreated = false;
  assert.throws(() => validateTlacuiloPreflightConfig({}), /Falta configuración de lectura/);

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

test('Tlacuilo preflight rejects any Supabase project other than the approved one', () => {
  assert.throws(
    () => validateTlacuiloPreflightConfig({
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_KEY: 'test-read-key',
    }),
    /sólo puede consultar el proyecto Supabase autorizado/
  );
});

test('Tlacuilo preflight validates nodes and absence of relation without writing', async () => {
  const nodes = [
    { id: 5, contenido: EXPECTED_NODE_TEXTS[5] },
    { id: 6, contenido: EXPECTED_NODE_TEXTS[6] },
  ];
  let clientCreated = false;
  let tablesRead = [];
  let attemptedWrite = false;

  const createSupabaseClient = () => {
    clientCreated = true;
    return {
      from(table) {
        tablesRead.push(table);
        return {
          select() {
            return {
              in: async (_column, ids) => {
                assert.deepEqual(ids, [5, 6]);
                return { data: nodes, error: null };
              },
              eq: (column, value) => {
                let queryCount = 0;
                const chain = {
                  eq(nextColumn, nextValue) {
                    queryCount += 1;
                    if (queryCount === 1) {
                      assert.equal(column, 'source_node_id');
                      assert.equal(value, 5);
                      assert.equal(nextColumn, 'target_node_id');
                      assert.equal(nextValue, 6);
                    }
                    if (queryCount === 2) {
                      assert.fail('No se esperaba una tercera condición.');
                    }
                    return chain;
                  },
                  then(resolve, reject) {
                    return Promise.resolve({ data: [], error: null }).then(resolve, reject);
                  },
                };

                // The real query builder is thenable after both eq() calls.
                return chain;
              },
            };
          },
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
  };

  // A purpose-built fake query builder captures every relation query as read-only.
  const fakeClient = {
    from(table) {
      tablesRead.push(table);
      if (table === 'investigaciones') {
        return {
          select() {
            return {
              in: async (_column, ids) => {
                assert.deepEqual(ids, [5, 6]);
                return { data: nodes, error: null };
              },
            };
          },
        };
      }

      if (table === 'arkhe_semantic_relations') {
        return {
          select() {
            let filters = [];
            const query = {
              eq(column, value) {
                filters.push([column, value]);
                if (filters.length === 2) {
                  assert.deepEqual(filters, [
                    ['source_node_id', filters[0][1]],
                    ['target_node_id', filters[1][1]],
                  ]);
                  return Promise.resolve({ data: [], error: null });
                }
                return query;
              },
              then(resolve, reject) {
                return Promise.resolve({ data: [], error: null }).then(resolve, reject);
              },
            };
            return query;
          },
          insert() {
            attemptedWrite = true;
            throw new Error('Preflight no puede escribir.');
          },
        };
      }

      throw new Error('Tabla no autorizada en preflight: ' + table);
    },
  };

  const result = await runTlacuiloPreflight({
    env: validEnv,
    createSupabaseClient: (...args) => {
      clientCreated = true;
      assert.equal(args[0], validEnv.SUPABASE_URL);
      return fakeClient;
    },
  });

  assert.equal(clientCreated, true);
  assert.equal(result.ok, true);
  assert.equal(result.writes_performed, 0);
  assert.equal(result.relation_absent_in_both_directions, true);
  assert.equal(attemptedWrite, false);
  assert.equal(tablesRead.filter(t => t === 'investigaciones').length, 1);
  assert.equal(tablesRead.filter(t => t === 'arkhe_semantic_relations').length, 2);
});

test('Tlacuilo preflight stops if approved node text changed', async () => {
  const client = {
    from(table) {
      if (table !== 'investigaciones') throw new Error('No se deben consultar relaciones si nodos no coinciden.');
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
      createSupabaseClient: () => client,
    }),
    /contenido del nodo #6 no coincide/
  );
});

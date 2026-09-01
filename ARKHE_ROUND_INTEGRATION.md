# Arkhé — Atlas round integration checkpoint

Current stable Atlas runtime remains unchanged.

Prepared components:
- `arkhe-round.js`: methodological round adapter.
- `arkhe-round-command.js`: Discord integration adapter.

Integration into `index.js` is intentionally deferred until the complete current entrypoint is preserved and reviewed. This checkpoint prevents an experimental round command from replacing or damaging the existing Atlas command routing.

Next safe integration:
1. import `crearComandoAtlasRonda` and `ejecutarAtlasRonda`;
2. add `atlas-ronda` to the command registration array;
3. add `atlas-ronda` to the allowed command set;
4. route the command to `ejecutarAtlasRonda`;
5. deploy and test one round;
6. if successful, freeze the change as the first methodological integration milestone.

No Supabase schema or RLS changes are required for this step.

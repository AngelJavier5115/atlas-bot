# Tlacuilo — one-shot semantic relation smoke runner

## Safety contract

Tlacuilo has its own signing identity. The dashboard server maps that identity to Atlas only for the hard-coded policy \`tlacuilo-smoke-relation-5-6-duplicates-v1\`; all other relation proposals are rejected server-side. Provenance stores both the executor identity and the delegated investigator identity.

This runner belongs only to the isolated \`security/tlacuilo-executor\` branch. It is **not imported by the production bot entry point**, is not a Discord command, and must not be deployed to the live Atlas service for this test.

It can attempt exactly one authorized proposal: #5 → #6, type \`duplicates\`, using the text approved by Ángel and documented in the Dashboard repository. It does not invent a provider, model, source URL, or run reference.

Before a POST, it:
1. requires the exact confirmation \`ARKHE_ENABLE_SEMANTIC_RELATION_SMOKE=CREATE_RELATION_5_6_ONCE\`;
2. requires \`ARKHE_SERVICE_ID=tlacuilo\`, a separate signed executor identity explicitly delegated to Atlas for this one policy;
3. requires the exact security/tlacuilo-delegation Preview endpoint and refuses production URLs;
4. requires the Vercel deployment-protection automation bypass in a server-only variable;
5. verifies the existing text of nodes #5 and #6;
6. reads the semantic relation table and refuses to proceed if a relation in either direction already exists.

It uses \`coreRequest\` to sign the exact JSON body using a dedicated Tlacuilo Ed25519 private key distinct from Atlas's key. That private key is never printed or placed in the repository. The optional Vercel bypass is sent only as \`x-vercel-protection-bypass\`; its value is never logged.

After HTTP 201, it performs read-only verification that there is one matching relation and exactly one \`relation_created\` event attributed to Atlas, while provenance identifies Tlacuilo as the executor and records the one-proposal delegation policy. If the POST times out or post-write verification fails, the script explicitly refuses automatic retry because the write may already have committed.

## Required runtime configuration

Set these only in an isolated, short-lived runner in a **private dedicated repository** or an authorized server-side shell—not in this public `atlas-bot` repository, browser variables, source code, or chat:

- \`ARKHE_CORE_URL=https://arkhe-dashboard-git-security-tlacuilo-delegation-arkhe7.vercel.app/api/semantic-relations\`
- \`ARKHE_SERVICE_ID=tlacuilo\`
- \`ARKHE_SERVICE_PRIVATE_KEY\`: the dedicated Tlacuilo private key, available only to the isolated signer; never reuse Atlas's signing key
- \`ARKHE_VERCEL_PROTECTION_BYPASS\`: short-lived Preview-only automation bypass; remove/revoke after the test
- \`SUPABASE_URL=https://xbdbdwfzcuqqudrbapom.supabase.co\`
- \`SUPABASE_KEY\`: server-side key able to read the nodes, semantic relation, and event rows
- \`ARKHE_ENABLE_SEMANTIC_RELATION_SMOKE=CREATE_RELATION_5_6_ONCE\`: set only immediately before the one intended run

Run \`node scripts/semantic-relation-smoke.mjs\` manually in the isolated runner. Do not add this command to the normal bot start command. Do not deploy this branch to the existing Atlas service. This commit only prepares a guarded runner and tests; it does not perform the POST or write Supabase data.

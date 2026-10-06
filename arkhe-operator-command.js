// ============================================================
// ARKHÉ — ADAPTADOR DE OPERACIÓN HUMANA
// ============================================================
// Este módulo vive en el cuerpo Discord solo como transporte.
// La autoridad y la lógica metodológica pertenecen a Arkhé Core.
// No representa la identidad de Atlas.
// ============================================================

import { coreRequest } from './arkhe-core-client.js';

export const ARKHE_ROUND_OPERATOR_COMMAND = 'arkhe-ronda';

const ANGEL_ID = '2a003935-f248-442c-96fc-dcee29c4d41a';
const RESEARCHERS = {
  atlas: '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f',
  aletheia: '122483a9-5012-46ce-a328-5bdb08b4de01',
  tekton: '656726d1-8209-4240-8169-a7434074609d'
};

const BODY_URLS = {
  [RESEARCHERS.atlas]: 'https://atlas-bot-8in0.onrender.com/arkhe/invocation',
  [RESEARCHERS.aletheia]: 'https://aletheia-bot-u6r3.onrender.com/arkhe/invocation',
  [RESEARCHERS.tekton]: 'https://tekton-bot.onrender.com/arkhe/invocation'
};

export function crearComandoArkheRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ARKHE_ROUND_OPERATOR_COMMAND)
    .setDescription('Arkhé: Ángel inicia una ronda con los tres investigadores.')
    .addStringOption(option => option
      .setName('pregunta')
      .setDescription('Pregunta que guiará la ronda')
      .setRequired(true))
    .addIntegerOption(option => option
      .setName('nodo')
      .setDescription('ID opcional de un nodo de memoria Arkhé')
      .setRequired(false));
}

export async function ejecutarArkheRonda({
  interaction,
  responderLargo
}) {
  const pregunta = interaction.options.getString('pregunta', true);
  const nodoId = interaction.options.getInteger('nodo');

  const inicio = await coreRequest({
    action: 'iniciar_ronda',
    actor_id: ANGEL_ID,
    investigacion_codigo: 'AR-001',
    tipo: 'consulta',
    pregunta,
    participantes: Object.values(RESEARCHERS),
    nodo_id: nodoId ?? null,
    contexto: {
      origen: 'discord',
      adaptador: 'arkhe-operator-v1',
      ejecutado_por_discord_user_id: interaction.user.id
    }
  });

  const convocatorias = await coreRequest({
    action: 'convocar_investigadores',
    actor_id: ANGEL_ID,
    ronda_id: inicio.ronda.id,
    investigadores: Object.values(RESEARCHERS),
    tipo_convocatoria: 'perspectiva',
    instruccion_humana: pregunta
  });

  const lista = convocatorias.convocatorias ?? [];
  if (lista.length !== 3) {
    throw new Error('Arkhé Core esperaba 3 convocatorias y creó ' + lista.length + '.');
  }

  await interaction.editReply(
    '🧭 **Arkhé Core — Ronda #' + inicio.ronda.numero + ' abierta**\n\n' +
    '**Pregunta:** ' + pregunta + '\n' +
    '**Nodo:** ' + (nodoId ?? 'sin nodo ancla') + '\n' +
    '**Investigadores convocados:** Atlas, Aletheia y Tekton\n\n' +
    '⏳ Sus cuerpos están procesando sus intervenciones independientes...'
  );

  const results = await Promise.allSettled(
    lista.map(async convocatoria => {
      const url = BODY_URLS[convocatoria.investigador_id];
      if (!url) {
        throw new Error('No existe cuerpo configurado para ' + convocatoria.investigador_id + '.');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-arkhe-core-token': process.env.ARKHE_CORE_TOKEN
        },
        body: JSON.stringify({
          convocatoria_id: convocatoria.id
        })
      });

      let body = null;
      try {
        body = await response.json();
      } catch {
        throw new Error('El cuerpo respondió HTTP ' + response.status + ' sin JSON válido.');
      }

      if (!response.ok || body?.ok === false) {
        throw new Error(body?.error || 'El cuerpo respondió HTTP ' + response.status + '.');
      }

      return body;
    })
  );

  const names = {
    [RESEARCHERS.atlas]: 'Atlas',
    [RESEARCHERS.aletheia]: 'Aletheia',
    [RESEARCHERS.tekton]: 'Tekton'
  };

  const messages = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const convocatoria = lista[i];
    const name = names[convocatoria.investigador_id] || convocatoria.investigador_id;

    if (result.status === 'fulfilled') {
      const contenido =
        result.value?.resultado?.contenido ??
        result.value?.intervencion?.contenido ??
        result.value?.contenido ??
        'Intervención sin contenido visible.';

      messages.push(
        '### ' + name + '\n' +
        '**Convocatoria:** ' + convocatoria.id + '\n' +
        '**Intervención:** ' + (result.value?.intervencion?.id ?? 'registrada') + '\n\n' +
        contenido
      );
    } else {
      messages.push(
        '### ' + name + '\n❌ Error al ejecutar su convocatoria: ' +
        (result.reason?.message || 'error desconocido')
      );
    }
  }

  return await responderLargo(
    interaction,
    messages.join('\n\n────────────\n\n')
  );
}

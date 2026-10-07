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
    .addStringOption(option => option
      .setName('investigador')
      .setDescription('Convocar sólo a un investigador; por defecto participan los tres.')
      .setRequired(false)
      .addChoices(
        { name: 'Atlas', value: 'atlas' },
        { name: 'Aletheia', value: 'aletheia' },
        { name: 'Tekton', value: 'tekton' }
      ))
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
  const investigador = interaction.options.getString('investigador');
  const nodoId = interaction.options.getInteger('nodo');
  const participantes = investigador
    ? [RESEARCHERS[investigador]]
    : Object.values(RESEARCHERS);

  const inicio = await coreRequest({
    action: 'iniciar_ronda',
    actor_id: ANGEL_ID,
    investigacion_codigo: 'AR-001',
    tipo: 'consulta',
    pregunta,
    participantes,
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
    investigadores: participantes,
    tipo_convocatoria: 'perspectiva',
    instruccion_humana: pregunta
  });

  const lista = convocatorias.convocatorias ?? [];
  const esperadas = participantes.length;
  if (lista.length !== esperadas) {
    throw new Error('Arkhé Core esperaba ' + esperadas + ' convocatoria(s) y creó ' + lista.length + '.');
  }

  await interaction.editReply(
    '🧭 **Arkhé Core — Ronda #' + inicio.ronda.numero + ' abierta**\n\n' +
    '**Pregunta:** ' + pregunta + '\n' +
    '**Nodo:** ' + (nodoId ?? 'sin nodo ancla') + '\n' +
    '**Investigadores convocados:** ' +
      (investigador ? investigador.charAt(0).toUpperCase() + investigador.slice(1) : 'Atlas, Aletheia y Tekton') +
      '\n\n' +
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
          convocatoria_id: convocatoria.id,
          discord_channel_id: interaction.channelId
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

  const errors = results
    .map((result, index) => ({ result, convocatoria: lista[index] }))
    .filter(item => item.result.status === 'rejected');

  if (errors.length) {
    const nombres = {
      [RESEARCHERS.atlas]: 'Atlas',
      [RESEARCHERS.aletheia]: 'Aletheia',
      [RESEARCHERS.tekton]: 'Tekton'
    };

    const detalle = errors
      .map(({ result, convocatoria }) =>
        nombres[convocatoria.investigador_id] + ': ' +
        (result.reason?.message || 'error desconocido')
      )
      .join('\n');

    await interaction.followUp(
      '⚠️ **Arkhé Core — algunas convocatorias no se completaron:**\n' + detalle
    );
  }

  return;
}


export const ARKHE_INVOCATION_OPERATOR_COMMAND = 'arkhe-convocar';

export function crearComandoArkheConvocar(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ARKHE_INVOCATION_OPERATOR_COMMAND)
    .setDescription('Arkhé: ejecuta una convocatoria existente de un investigador.')
    .addStringOption(option => option
      .setName('convocatoria_id')
      .setDescription('UUID de la convocatoria pendiente')
      .setRequired(true));
}

export async function ejecutarArkheConvocar({
  interaction
}) {
  const convocatoriaId = interaction.options.getString('convocatoria_id', true);

  const convocatoria = await coreRequest({
    action: 'obtener_convocatoria',
    convocatoria_id: convocatoriaId
  });

  const investigatorId = convocatoria?.convocatoria?.investigador_id;
  const estado = convocatoria?.convocatoria?.estado;

  if (!investigatorId) {
    throw new Error('Arkhé Core no devolvió el investigador de la convocatoria.');
  }

  if (!['pendiente', 'enviada'].includes(estado)) {
    throw new Error(
      'La convocatoria no está pendiente de ejecución. Estado actual: ' +
      (estado || 'desconocido') + '.'
    );
  }

  const url = BODY_URLS[investigatorId];
  if (!url) {
    throw new Error('No existe un cuerpo configurado para el investigador convocado.');
  }

  await interaction.editReply(
    '🧭 **Arkhé Core — ejecutando convocatoria existente**\\n\\n' +
    '**Convocatoria:** ' + convocatoriaId + '\\n' +
    '**Investigador:** ' + (convocatoria?.identidad?.nombre_identitario || investigatorId) + '\\n' +
    '⏳ El investigador está procesando su intervención...'
  );

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-arkhe-core-token': process.env.ARKHE_CORE_TOKEN
    },
    body: JSON.stringify({
      convocatoria_id: convocatoriaId,
      discord_channel_id: interaction.channelId
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

  await interaction.editReply(
    '✅ **Arkhé Core — convocatoria ejecutada**\\n\\n' +
    '**Convocatoria:** ' + convocatoriaId + '\\n' +
    '**Investigador:** ' + (convocatoria?.identidad?.nombre_identitario || investigatorId) + '\\n' +
    'La intervención fue enviada al canal por su propio cuerpo.'
  );
}

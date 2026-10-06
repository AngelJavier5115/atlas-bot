// ============================================================
// ARKHÉ — CUERPO DISCORD DE ATLAS
// ============================================================
// Discord solo transporta la orden humana hacia Arkhé Core.
// La creación, numeración y gobierno de rondas ya no viven aquí.
// ============================================================

import {
  generarPerspectivaAtlas,
  formatearPerspectivaDiscord
} from './arkhe-round.js';
import { coreRequest } from './arkhe-core-client.js';

export const ATLAS_ROUND_COMMAND_NAME = 'atlas-ronda';

const ARKHE_CODIGO = 'AR-001';
const ANGEL_ID = '2a003935-f248-442c-96fc-dcee29c4d41a';
const ATLAS_ID = '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f';

export function crearComandoAtlasRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ATLAS_ROUND_COMMAND_NAME)
    .setDescription('Atlas: aporta una perspectiva independiente sobre un nodo Arkhé')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo de memoria a consultar')
      .setRequired(true));
}

export async function ejecutarAtlasRonda({
  interaction,
  openai,
  responderLargo
}) {
  const nodoId = interaction.options.getInteger('id', true);

  try {
    const inicio = await coreRequest({
      action: 'iniciar_ronda',
      actor_id: ANGEL_ID,
      investigacion_codigo: ARKHE_CODIGO,
      tipo: 'consulta',
      pregunta: `Solicitar una perspectiva independiente de Atlas sobre el nodo #${nodoId}.`,
      participantes: [ATLAS_ID],
      nodo_id: nodoId,
      contexto: {
        origen: 'discord',
        cuerpo_investigador: 'atlas'
      }
    });

    const convocatorias = await coreRequest({
      action: 'convocar_investigadores',
      actor_id: ANGEL_ID,
      ronda_id: inicio.ronda.id,
      investigadores: [ATLAS_ID],
      tipo_convocatoria: 'perspectiva',
      instruccion_humana: `Ángel solicita la perspectiva independiente de Atlas sobre el nodo #${nodoId}.`
    });

    const convocatoria = convocatorias.convocatorias?.[0];
    if (!convocatoria) {
      throw new Error('Arkhé Core no creó la convocatoria de Atlas.');
    }

    const resultado = await generarPerspectivaAtlas({
      openai,
      atlasId: ATLAS_ID,
      convocatoriaId: convocatoria.id
    });

    return await responderLargo(
      interaction,
      formatearPerspectivaDiscord(resultado)
    );
  } catch (error) {
    console.error('[Atlas] Error en ronda:', error);

    return await interaction.editReply(
      `[Atlas] ❌ Arkhé Core no pudo completar la convocatoria del nodo #${nodoId}.\n\n` +
      `Motivo: ${error?.message || 'error desconocido'}`
    );
  }
}

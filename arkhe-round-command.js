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

export const ATLAS_ROUND_COMMAND_NAME = 'atlas-convocatoria';

const ATLAS_ID = '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f';

export function crearComandoAtlasRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ATLAS_ROUND_COMMAND_NAME)
    .setDescription('Atlas: procesa una convocatoria existente autorizada por Arkhé Core')
    .addStringOption(option => option
      .setName('convocatoria_id')
      .setDescription('UUID de una convocatoria pendiente asignada a Atlas')
      .setRequired(true));
}

export async function ejecutarAtlasRonda({
  interaction,
  openai,
  responderLargo
}) {
  const convocatoriaId = interaction.options.getString('convocatoria_id', true);

  try {
    const resultado = await generarPerspectivaAtlas({
      openai,
      atlasId: '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f',
      convocatoriaId
    });

    return await responderLargo(
      interaction,
      formatearPerspectivaDiscord(resultado)
    );
  } catch (error) {
    console.error('[Atlas] Error en convocatoria:', error);
    return await interaction.editReply(
      '[Atlas] ❌ Arkhé Core no pudo completar la convocatoria ' + convocatoriaId + '.\\n\\n' +
      'Motivo: ' + (error?.message || 'error desconocido')
    );
  }
}

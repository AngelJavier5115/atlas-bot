// ============================================================
// ARKHÉ — COMANDO DE RONDA PARA ATLAS
// ============================================================
// Adaptador de integración: mantiene el manejo de Discord fuera
// del contrato metodológico de arkhe-round.js.
//
// El index.js actual todavía no se modifica automáticamente.
// ============================================================

import {
  generarPerspectivaAtlas,
  formatearPerspectivaDiscord
} from './arkhe-round.js';

export const ATLAS_ROUND_COMMAND_NAME = 'atlas-ronda';

export function crearComandoAtlasRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ATLAS_ROUND_COMMAND_NAME)
    .setDescription('Atlas: aporta una perspectiva independiente a una ronda Arkhé')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID de la ronda de investigación')
      .setRequired(true));
}

export async function ejecutarAtlasRonda({
  interaction,
  supabase,
  openai,
  atlasId,
  responderLargo
}) {
  const rondaId = interaction.options.getInteger('id', true);

  try {
    const resultado = await generarPerspectivaAtlas({
      supabase,
      openai,
      atlasId,
      rondaId
    });

    const mensaje = formatearPerspectivaDiscord(resultado);
    return await responderLargo(interaction, mensaje);
  } catch (error) {
    console.error('[Atlas] Error en ronda:', error);

    return await interaction.editReply(
      `[Atlas] ❌ No pude registrar la perspectiva de la ronda #${rondaId}.\n\n` +
      `Motivo: ${error?.message || 'error desconocido'}`
    );
  }
}

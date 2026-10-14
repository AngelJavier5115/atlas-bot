// ============================================================
// ARKHÉ — CUERPO DISCORD DE ATLAS
// ============================================================
// La investigación sólo comienza mediante un despacho firmado de
// Arkhé Core después de autorización humana WebAuthn. Un comando de
// Discord con una UUID no es un despacho ni una autorización.
// ============================================================

export const ATLAS_ROUND_COMMAND_NAME = 'atlas-convocatoria';

export function crearComandoAtlasRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ATLAS_ROUND_COMMAND_NAME)
    .setDescription('Ejecución directa bloqueada: las convocatorias deben llegar mediante despacho firmado de Arkhé Core.')
    .addStringOption(option => option
      .setName('convocatoria_id')
      .setDescription('UUID informativo de la convocatoria (no la ejecuta)')
      .setRequired(true));
}

export async function ejecutarAtlasRonda({ interaction }) {
  return await interaction.editReply(
    '⛔ **Atlas — ejecución directa deshabilitada.**\\n\\n' +
    'Una convocatoria sólo puede procesarse después de recibir un despacho firmado, de un solo uso, emitido por Arkhé Core con autorización humana reciente. ' +
    'Este comando no ejecutó el motor ni contactó al Core.'
  );
}

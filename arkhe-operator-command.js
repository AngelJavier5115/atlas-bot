// ============================================================
// ARKHÉ — ADAPTADOR DE OPERACIÓN HUMANA (BLOQUEADO EN A.4)
// ============================================================
// Las acciones de gobierno requieren una sesión humana WebAuthn
// validada por Arkhé Core. Un comando de Discord ejecutado dentro
// del proceso Atlas no puede declarar actor_id=Ángel ni reutilizar
// la identidad Ed25519 del investigador como autorización humana.
// Los comandos se conservan temporalmente para responder con una
// explicación clara, pero no hacen peticiones al Core.
// ============================================================

export const ARKHE_ROUND_OPERATOR_COMMAND = 'arkhe-ronda';

export function crearComandoArkheRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ARKHE_ROUND_OPERATOR_COMMAND)
    .setDescription('Arkhé: creación de rondas deshabilitada hasta completar la autorización humana A.4.')
    .addStringOption(option => option
      .setName('pregunta')
      .setDescription('Pregunta que guiará la ronda')
      .setRequired(true))
    .addStringOption(option => option
      .setName('investigador')
      .setDescription('Investigador opcional')
      .setRequired(false)
      .addChoices(
        { name: 'Atlas', value: 'atlas' },
        { name: 'Aletheia', value: 'aletheia' },
        { name: 'Tekton', value: 'tekton' }
      ))
    .addIntegerOption(option => option
      .setName('nodo')
      .setDescription('ID opcional del nodo de memoria Arkhé')
      .setRequired(false));
}

export async function ejecutarArkheRonda({ interaction }) {
  return await interaction.editReply(
    '⛔ **Arkhé Core — acción de gobierno bloqueada.**\\n\\n' +
    'Crear una ronda requiere la sesión humana WebAuthn del Core. ' +
    'Este comando de Discord no puede sustituir esa autorización ni declarar a Ángel como actor.'
  );
}

export const ARKHE_INVOCATION_OPERATOR_COMMAND = 'arkhe-convocar';

export function crearComandoArkheConvocar(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ARKHE_INVOCATION_OPERATOR_COMMAND)
    .setDescription('Ejecución de convocatorias pendiente de integración con el gate humano A.4.')
    .addStringOption(option => option
      .setName('convocatoria_id')
      .setDescription('UUID de una convocatoria autorizada')
      .setRequired(true));
}

export async function ejecutarArkheConvocar({ interaction }) {
  return await interaction.editReply(
    '⛔ **Arkhé Core — ejecución de convocatoria no disponible por este adaptador.**\\n\\n' +
    'Primero debe existir una convocatoria autorizada por el Core y un mecanismo de despacho ' +
    'que no dependa del token compartido. No se ha enviado ninguna petición.'
  );
}

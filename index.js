import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import http from 'http';

// ==========================================
// SERVIDOR HTTP OBLIGATORIO PARA RENDER 24/7
// ==========================================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Atlas Bot is active!\n');
}).listen(PORT, () => {
  console.log(`[Atlas] Servidor HTTP activo en puerto ${PORT}`);
});

// ==========================================
// SUPABASE
// ==========================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ==========================================
// OPENAI
// ==========================================

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// ==========================================
// DISCORD
// ==========================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ==========================================
// COMANDOS
// ==========================================

const commands = [

  // ----------------------------------------
  // ATLAS-EVALUAR
  // ----------------------------------------

  new SlashCommandBuilder()
    .setName('atlas-evaluar')
    .setDescription('Atlas: Evalúa epistémicamente un nodo existente')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID del nodo a evaluar')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('estado')
        .setDescription('Nuevo estado epistémico')
        .setRequired(true)
        .addChoices(
          { name: 'Postulado', value: 'postulado' },
          { name: 'Corroborado', value: 'corroborado' },
          { name: 'Falsado', value: 'falsado' },
          { name: 'Ruido', value: 'ruido' }
        )
    ),

  // ----------------------------------------
  // ATLAS-CONSULTAR
  // ----------------------------------------

  new SlashCommandBuilder()
    .setName('atlas-consultar')
    .setDescription('Atlas: Consulta un nodo de la memoria compartida')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID del nodo a consultar')
        .setRequired(true)
    ),

  // ----------------------------------------
  // ATLAS-ANALIZAR
  // ----------------------------------------

  new SlashCommandBuilder()
    .setName('atlas-analizar')
    .setDescription('Atlas: Analiza un nodo sin modificarlo')
    .addIntegerOption(option =>
      option.setName('id')
        .setDescription('ID del nodo que Atlas analizará')
        .setRequired(true)
    )

].map(cmd => cmd.toJSON());

// ==========================================
// MANEJO DE ERRORES
// ==========================================

process.on('unhandledRejection', error => {
  console.error('[Atlas] Unhandled Rejection:', error);
});

// ==========================================
// BOT LISTO
// ==========================================

client.once('ready', async () => {

  console.log(`[Atlas] Bot en línea como: ${client.user.tag}`);

  try {

    const rest = new REST({ version: '10' })
      .setToken(process.env.DISCORD_TOKEN);

    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );

    console.log('[Atlas] Comandos registrados exitosamente.');

  } catch (e) {

    console.error(
      '[Atlas] Error al registrar comandos:',
      e
    );

  }

});

// ==========================================
// INTERACCIONES
// ==========================================

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  if (
    interaction.commandName !== 'atlas-evaluar' &&
    interaction.commandName !== 'atlas-consultar' &&
    interaction.commandName !== 'atlas-analizar'
  ) {
    return;
  }

  try {

    await interaction.deferReply();

    const id = interaction.options.getInteger('id');

    // ======================================
    // ATLAS-CONSULTAR
    // ======================================

    if (interaction.commandName === 'atlas-consultar') {

      const { data: nodo, error } = await supabase
        .from('investigaciones')
        .select('id, contenido, estado')
        .eq('id', id)
        .single();

      if (error || !nodo) {

        return await interaction.editReply(
          `[Atlas] ❌ Nodo #${id} no encontrado.`
        );

      }

      return await interaction.editReply(
        `[Atlas] 🔎 **Nodo #${nodo.id}**\n` +
        `**Contenido:** ${nodo.contenido}\n` +
        `**Estado:** ${nodo.estado}`
      );

    }

    // ======================================
    // ATLAS-ANALIZAR
    // ======================================

    if (interaction.commandName === 'atlas-analizar') {

      // Primero verificamos que el nodo exista.
      const { data: nodo, error } = await supabase
        .from('investigaciones')
        .select('id, contenido, estado, autor, ref_id')
        .eq('id', id)
        .single();

      if (error || !nodo) {

        return await interaction.editReply(
          `[Atlas] ❌ Nodo #${id} no encontrado.`
        );

      }

      // Después comprobamos que OpenAI esté disponible.
      if (!openai) {

        return await interaction.editReply(
          '[Atlas] ⚠️ La API Key de OpenAI aún no ha sido configurada.'
        );

      }

      // ====================================
      // IDENTIDAD INICIAL DE ATLAS
      // ====================================

      const systemPrompt = `
Eres Atlas, uno de los investigadores independientes
del Proyecto Arkhé.

Arkhé es una red de investigadores que comparte memoria,
pero no una autoridad central.

Tu función es investigar, analizar, cuestionar,
relacionar ideas y ayudar a construir conocimiento.

No eres una autoridad absoluta.

Una evaluación tuya representa una posición provisional
y no constituye una verdad ontológica.

Debes distinguir cuidadosamente entre:

- hechos o información proporcionada;
- inferencias;
- hipótesis;
- opiniones;
- incertidumbre;
- conclusiones provisionales.

No debes aceptar una afirmación simplemente porque
otro investigador la haya producido.

Puedes estar en desacuerdo con Ángel, Aletheia,
Tekton o con tus propias conclusiones anteriores.

Si la información disponible no permite llegar a una
conclusión, debes reconocerlo explícitamente.

Tu objetivo no es parecer seguro ni tener siempre razón.

Tu objetivo es ayudar a Arkhé a reducir la distancia
entre nuestras hipótesis y aquello que la evidencia
permite sostener.

En esta operación solamente debes ANALIZAR el nodo.

NO debes modificar su estado.

NO debes modificar la memoria compartida.

NO debes inventar evidencia que no esté disponible.

Devuelve tu respuesta utilizando esta estructura:

🔬 ANÁLISIS DE ATLAS

Interpretación:
¿Qué afirma o plantea el nodo?

Análisis:
¿Qué puede determinarse a partir de la información disponible?

Argumentos:
¿Qué razones apoyan o cuestionan la afirmación?

Incertidumbre:
¿Qué aspectos permanecen sin determinar?

Información faltante:
¿Qué necesitaríamos conocer para evaluar mejor la afirmación?

Posición provisional:
¿Cuál es tu postura actual y por qué?
`;

      // ====================================
      // LLAMADA AL MODELO
      // ====================================

      const respuesta = await openai.responses.create({

        model: 'gpt-4o',

        instructions: systemPrompt,

        input: `
Nodo de Arkhé:

ID: ${nodo.id}

Autor: ${nodo.autor ?? 'No especificado'}

Estado actual: ${nodo.estado ?? 'No especificado'}

Referencia: ${nodo.ref_id ?? 'Ninguna'}

Contenido:

${nodo.contenido}
`

      });

      const analisis = respuesta.output_text;

      if (!analisis) {

        return await interaction.editReply(
          '[Atlas] ⚠️ El modelo no produjo un análisis.'
        );

      }

      // ====================================
      // RESPUESTA
      // ====================================

      return await interaction.editReply(
        `[Atlas] 🔬 **Análisis del Nodo #${nodo.id}**\n\n${analisis}`
      );

    }

    // ======================================
    // ATLAS-EVALUAR
    // ======================================

    if (interaction.commandName === 'atlas-evaluar') {

      const nuevoEstado =
        interaction.options.getString('estado');

      if (!openai) {

        return await interaction.editReply(
          '[Atlas] ⚠️ La API Key de OpenAI aún no ha sido configurada.'
        );

      }

      const { data: nodoExistente, error: fetchError } =
        await supabase
          .from('investigaciones')
          .select('id, contenido, estado')
          .eq('id', id)
          .single();

      if (fetchError || !nodoExistente) {

        return await interaction.editReply(
          `[Atlas] ❌ Nodo #${id} no encontrado.`
        );

      }

      const { error: updateError } =
        await supabase
          .from('investigaciones')
          .update({ estado: nuevoEstado })
          .eq('id', id);

      if (updateError) {

        console.error(
          '[Atlas] Error al actualizar estado:',
          updateError
        );

        return await interaction.editReply(
          `[Atlas] ❌ Error al actualizar el nodo #${id}.`
        );

      }

      return await interaction.editReply(
        `[Atlas] ✅ Nodo #${id} actualizado a **${nuevoEstado}**.`
      );

    }

  } catch (err) {

    console.error(
      '[Atlas] Error en interacción:',
      err
    );

    try {

      await interaction.editReply(
        '[Atlas] ❌ Ocurrió un error interno.'
      );

    } catch (replyError) {

      console.error(
        '[Atlas] No se pudo enviar el mensaje de error:',
        replyError
      );

    }

  }

});

// ==========================================
// LOGIN
// ==========================================

client.login(process.env.DISCORD_TOKEN);

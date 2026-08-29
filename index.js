import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import http from 'http';

// Servidor HTTP obligatorio para Render 24/7
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Atlas Bot is active!\n');
}).listen(PORT, () => {
  console.log(`[Atlas] Servidor HTTP activo en puerto ${PORT}`);
});

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
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
    )
].map(cmd => cmd.toJSON());

process.on('unhandledRejection', error => {
  console.error('[Atlas] Unhandled Rejection:', error);
});

client.once('ready', async () => {
  console.log(`[Atlas] Bot en línea como: ${client.user.tag}`);
  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[Atlas] Comando /atlas-evaluar registrado exitosamente.');
  } catch (e) {
    console.error('[Atlas] Error al registrar comando:', e);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'atlas-evaluar') return;

  try {
    await interaction.deferReply();

    const id = interaction.options.getInteger('id');
    const nuevoEstado = interaction.options.getString('estado');

    if (!openai) {
      return await interaction.editReply('[Atlas] ⚠️ La API Key de OpenAI aún no ha sido configurada.');
    }

    const { data: nodoExistente, error: fetchError } = await supabase
      .from('investigaciones')
      .select('id, contenido, estado')
      .eq('id', id)
      .single();

    if (fetchError || !nodoExistente) {
      return await interaction.editReply(`[Atlas] ❌ Nodo #${id} no encontrado.`);
    }

    const { error: updateError } = await supabase
      .from('investigaciones')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (updateError) {
      console.error('[Atlas] Error al actualizar estado:', updateError);
      return await interaction.editReply(`[Atlas] ❌ Error al actualizar el nodo #${id}.`);
    }

    await interaction.editReply(`[Atlas] ✅ Nodo #${id} actualizado a **${nuevoEstado}**.`);
  } catch (err) {
    console.error('[Atlas] Error en interacción:', err);
    await interaction.editReply('[Atlas] ❌ Ocurrió un error interno.');
  }
});

client.login(process.env.DISCORD_TOKEN);

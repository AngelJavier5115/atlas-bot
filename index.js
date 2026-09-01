import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from 'discord.js';

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import http from 'http';
import { registrarEvaluacion } from './arkhe-evaluation.js';
import { registrarProduccion } from './arkhe-production.js';
import { ejecutarAtlasRonda, crearComandoAtlasRonda, ATLAS_ROUND_COMMAND_NAME } from './arkhe-round-command.js';

// ============================================================
// ATLAS — NODO DE ANÁLISIS DE ARKHÉ
// ============================================================

const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Atlas Bot is active!\n');
}).listen(PORT, () => {
  console.log(`[Atlas] Servidor HTTP activo en puerto ${PORT}`);
});

// ============================================================
// SUPABASE / MOTOR DE IA
// ============================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Atlas puede operar con OpenRouter sin romper compatibilidad con la
// variable histórica OPENAI_API_KEY. Si existe OPENROUTER_API_KEY,
// se selecciona explícitamente el endpoint OpenRouter.
const AI_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
const AI_BASE_URL = process.env.OPENROUTER_API_KEY
  ? 'https://openrouter.ai/api/v1'
  : undefined;

const openai = AI_API_KEY
  ? new OpenAI({
      apiKey: AI_API_KEY,
      ...(AI_BASE_URL ? { baseURL: AI_BASE_URL } : {})
    })
  : null;

// ============================================================
// IDENTIDAD DE ATLAS
// ============================================================

const ATLAS_ID = '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f';
const ATLAS_NOMBRE = 'Atlas';

// ============================================================
// DISCORD
// ============================================================

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ============================================================
// UTILIDAD — RESPUESTAS LARGAS
// Discord limita cada mensaje a 2000 caracteres.
// ============================================================

async function responderLargo(interaction, texto) {
  const LIMITE = 1900;
  const partes = [];

  let restante = String(texto ?? '');

  while (restante.length > LIMITE) {
    let corte = restante.lastIndexOf('\n', LIMITE);

    if (corte < 1000) {
      corte = restante.lastIndexOf(' ', LIMITE);
    }

    if (corte < 1) {
      corte = LIMITE;
    }

    partes.push(restante.slice(0, corte));
    restante = restante.slice(corte).trimStart();
  }

  if (restante.length) partes.push(restante);

  await interaction.editReply(partes.shift() || '');

  for (const parte of partes) {
    await interaction.followUp(parte);
  }
}

// ============================================================
// REGISTRO DE COMANDOS
// ============================================================

const comandos = [
  new SlashCommandBuilder()
    .setName('atlas-evaluar')
    .setDescription('Atlas evalúa un nodo de investigación de forma independiente')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo')
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('atlas-consultar')
    .setDescription('Atlas consulta un nodo de investigación')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo')
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('atlas-producir')
    .setDescription('Atlas produce conocimiento para Arkhé')
    .addStringOption(option => option
      .setName('contenido')
      .setDescription('Contenido producido')
      .setRequired(true)),

  crearComandoAtlasRonda(SlashCommandBuilder)
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

await rest.put(
  Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
  { body: comandos.map(comando => comando.toJSON()) }
);

console.log('[Atlas] Comandos registrados.');

// ============================================================
// INTERACCIONES
// ============================================================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await interaction.deferReply();

    if (interaction.commandName === ATLAS_ROUND_COMMAND_NAME) {
      return await ejecutarAtlasRonda({
        interaction,
        supabase,
        openai,
        atlasId: ATLAS_ID,
        responderLargo
      });
    }

    // ========================================================
    // COMANDOS EXISTENTES DE ATLAS
    // ========================================================

    if (interaction.commandName === 'atlas-evaluar') {
      const id = interaction.options.getInteger('id', true);
      const resultado = await registrarEvaluacion({
        supabase,
        openai,
        atlasId: ATLAS_ID,
        nodoId: id
      });

      return await responderLargo(interaction, resultado.mensaje);
    }

    if (interaction.commandName === 'atlas-consultar') {
      const id = interaction.options.getInteger('id', true);
      const resultado = await registrarEvaluacion({
        supabase,
        openai,
        atlasId: ATLAS_ID,
        nodoId: id
      });

      return await responderLargo(interaction, resultado.mensaje);
    }

    if (interaction.commandName === 'atlas-producir') {
      const contenido = interaction.options.getString('contenido', true);
      const resultado = await registrarProduccion({
        supabase,
        openai,
        atlasId: ATLAS_ID,
        contenido
      });

      return await responderLargo(interaction, resultado.mensaje);
    }

    await interaction.editReply('Comando no reconocido.');
  } catch (error) {
    console.error('[Atlas] Error en interacción:', error);

    const mensaje = `[Atlas] ❌ No pude completar la operación.\n\nMotivo: ${error?.message || 'error desconocido'}`;

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(mensaje).catch(() => {});
    } else {
      await interaction.reply(mensaje).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

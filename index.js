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
// SUPABASE / OPENAI
// ============================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
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
// COMANDOS — CONTRATO ARKHÉ
// ============================================================

const commands = [
  new SlashCommandBuilder()
    .setName('atlas-evaluar')
    .setDescription('Atlas: registra una evaluación epistemológica de un nodo')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo a evaluar')
      .setRequired(true))
    .addStringOption(option => option
      .setName('estado')
      .setDescription('Posición epistemológica de Atlas')
      .setRequired(true)
      .addChoices(
        { name: 'Postulado', value: 'postulado' },
        { name: 'Corroborado', value: 'corroborado' },
        { name: 'Falsado', value: 'falsado' },
        { name: 'Ruido', value: 'ruido' }
      ))
    .addStringOption(option => option
      .setName('argumento')
      .setDescription('Argumento que justifica la posición de Atlas')
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('atlas-consultar')
    .setDescription('Atlas: consulta un nodo de la memoria compartida')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo a consultar')
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('atlas-analizar')
    .setDescription('Atlas: analiza un nodo y registra su análisis en Arkhé')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo que Atlas analizará')
      .setRequired(true)),

  new SlashCommandBuilder()
    .setName('atlas-producir')
    .setDescription('Atlas: registra una nueva producción trazable en Arkhé')
    .addStringOption(option => option
      .setName('investigacion_id')
      .setDescription('UUID de la investigación de Arkhé')
      .setRequired(true))
    .addStringOption(option => option
      .setName('contenido')
      .setDescription('Contenido de la producción')
      .setRequired(true))
    .addStringOption(option => option
      .setName('tipo')
      .setDescription('Tipo de producción')
      .setRequired(true))
    .addIntegerOption(option => option
      .setName('ref_id')
      .setDescription('ID opcional del nodo de referencia')
      .setRequired(false))
].map(cmd => cmd.toJSON());

// ============================================================
// ERRORES
// ============================================================

process.on('unhandledRejection', error => {
  console.error('[Atlas] Unhandled Rejection:', error);
});

process.on('uncaughtException', error => {
  console.error('[Atlas] Uncaught Exception:', error);
});

// ============================================================
// READY
// ============================================================

client.once('ready', async () => {
  console.log(`[Atlas] Bot en línea como: ${client.user.tag}`);
  console.log(`[Atlas] Identidad Arkhé: ${ATLAS_NOMBRE} (${ATLAS_ID})`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[Atlas] Comandos registrados correctamente.');
  } catch (error) {
    console.error('[Atlas] Error registrando comandos:', error);
  }
});

// ============================================================
// INTERACCIONES
// ============================================================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const allowed = new Set([
    'atlas-evaluar',
    'atlas-consultar',
    'atlas-analizar',
    'atlas-producir'
  ]);

  if (!allowed.has(interaction.commandName)) return;

  try {
    await interaction.deferReply();

    const id = interaction.options.getInteger('id');

    // ========================================================
    // ATLAS-CONSULTAR
    // ========================================================

    if (interaction.commandName === 'atlas-consultar') {
      const { data: nodo, error } = await supabase
        .from('investigaciones')
        .select(`
          id,
          contenido,
          estado,
          autor,
          tipo,
          investigador_id,
          ref_id,
          metadata,
          created_at
        `)
        .eq('id', id)
        .single();

      if (error || !nodo) {
        return await interaction.editReply(`[Atlas] ❌ Nodo #${id} no encontrado.`);
      }

      return await interaction.editReply(
        `[Atlas] 🔎 **Nodo #${nodo.id}**\n\n` +
        `**Contenido:** ${nodo.contenido}\n` +
        `**Tipo:** ${nodo.tipo ?? 'No especificado'}\n` +
        `**Estado:** ${nodo.estado ?? 'No especificado'}\n` +
        `**Autor externo:** ${nodo.autor ?? 'No especificado'}\n` +
        `**Investigador Arkhé:** ${nodo.investigador_id ?? 'No especificado'}\n` +
        `**Referencia:** ${nodo.ref_id ?? 'Ninguna'}`
      );
    }

    // ========================================================
    // ATLAS-EVALUAR — posición independiente
    // ========================================================

    if (interaction.commandName === 'atlas-evaluar') {
      const nodoId = interaction.options.getInteger('id', true);
      const posicion = interaction.options.getString('estado', true);
      const argumento = interaction.options.getString('argumento', true);

      const evaluacion = await registrarEvaluacion(supabase, {
        nodoId,
        investigadorId: ATLAS_ID,
        posicion,
        argumento,
        metadata: {
          canal: 'discord',
          investigador: ATLAS_NOMBRE,
          usuario_origen: interaction.user.tag
        }
      });

      return await interaction.editReply(
        `[Atlas] 🧭 **Evaluación registrada.**\n\n` +
        `**Nodo:** #${nodoId}\n` +
        `**Posición de Atlas:** ${evaluacion.posicion}\n` +
        `**Evaluación ID:** #${evaluacion.id}\n\n` +
        `**Importante:** esta posición no modifica el estado consolidado del nodo.\n\n` +
        `**Argumento:** ${evaluacion.argumento}`
      );
    }

    // ========================================================
    // ATLAS-PRODUCIR — producción trazable
    // ========================================================

    if (interaction.commandName === 'atlas-producir') {
      const investigacionId = interaction.options.getString('investigacion_id', true);
      const contenido = interaction.options.getString('contenido', true);
      const tipo = interaction.options.getString('tipo', true);
      const refId = interaction.options.getInteger('ref_id', false);

      const resultado = await registrarProduccion(supabase, {
        investigadorId: ATLAS_ID,
        investigacionId,
        contenido,
        tipo,
        refId,
        metadata: {
          canal: 'discord',
          investigador: ATLAS_NOMBRE,
          usuario_origen: interaction.user.tag
        }
      });

      return await interaction.editReply(
        `[Atlas] 🧱 **Producción registrada correctamente.**\n\n` +
        `**Nodo producido:** #${resultado.nodo.id}\n` +
        `**Investigación:** ${resultado.investigacion.codigo} — ${resultado.investigacion.titulo}\n` +
        `**Tipo:** ${resultado.nodo.tipo}\n` +
        `**Estado inicial:** ${resultado.nodo.estado}\n` +
        `**Referencia:** ${resultado.nodo.ref_id ?? 'Ninguna'}\n` +
        `**Vinculación:** confirmada`
      );
    }

    // ========================================================
    // ATLAS-ANALIZAR
    // ========================================================

    if (interaction.commandName === 'atlas-analizar') {
      const { data: nodo, error: nodoError } = await supabase
        .from('investigaciones')
        .select(`
          id,
          contenido,
          estado,
          autor,
          tipo,
          investigador_id,
          ref_id,
          metadata
        `)
        .eq('id', id)
        .single();

      if (nodoError || !nodo) {
        return await interaction.editReply(`[Atlas] ❌ Nodo #${id} no encontrado.`);
      }

      const { data: relacion, error: relacionError } = await supabase
        .from('investigacion_nodos')
        .select('investigacion_id, nodo_id')
        .eq('nodo_id', id)
        .limit(1)
        .maybeSingle();

      if (relacionError || !relacion) {
        return await interaction.editReply(
          `[Atlas] ❌ El nodo #${id} no está vinculado a ninguna investigación de Arkhé.`
        );
      }

      const { data: investigacion, error: investigacionError } = await supabase
        .from('investigaciones_proyecto')
        .select(`
          id,
          codigo,
          titulo,
          objetivo,
          pregunta,
          descripcion,
          estado
        `)
        .eq('id', relacion.investigacion_id)
        .single();

      if (investigacionError || !investigacion) {
        return await interaction.editReply(
          `[Atlas] ❌ No pude reconstruir el contexto de investigación del nodo #${id}.`
        );
      }

      const { data: participacion, error: participacionError } = await supabase
        .from('participaciones')
        .select('id, investigador_id, investigacion_id, rol, estado')
        .eq('investigador_id', ATLAS_ID)
        .eq('investigacion_id', investigacion.id)
        .eq('estado', 'activo')
        .maybeSingle();

      if (participacionError || !participacion) {
        return await interaction.editReply(
          participacionError
            ? '[Atlas] ❌ No se pudo verificar la participación de Atlas en esta investigación.'
            : `[Atlas] ⚠️ Atlas no participa actualmente en **${investigacion.codigo} — ${investigacion.titulo}**.`
        );
      }

      if (!openai) {
        return await interaction.editReply('[Atlas] ⚠️ El motor de Atlas no está configurado.');
      }

      const systemPrompt = `
Eres Atlas, uno de los investigadores independientes del Proyecto Arkhé.

Tu función es analizar, razonar, explorar conocimiento, relacionar ideas,
cuestionar afirmaciones, identificar incertidumbres y proponer interpretaciones.

No eres una autoridad absoluta. Una posición de Atlas es una posición de
investigador y no constituye automáticamente una verdad.

Distingue entre hechos, evidencia disponible, inferencias, hipótesis, opiniones,
incertidumbre y conclusiones provisionales. No inventes evidencia.

Investigación:
Código: ${investigacion.codigo}
Título: ${investigacion.titulo}
Objetivo: ${investigacion.objetivo}
Pregunta: ${investigacion.pregunta ?? 'No especificada'}
Descripción: ${investigacion.descripcion ?? 'No especificada'}

En esta operación debes ANALIZAR el nodo. NO debes modificar el nodo original.
NO debes cambiar su estado. Tu análisis será registrado como una producción
independiente de Atlas dentro de Arkhé.

Devuelve exactamente una estructura clara con:
🔬 ANÁLISIS DE ATLAS
Interpretación:
Análisis:
Argumentos:
Incertidumbre:
Información faltante:
Posición provisional:
`;

      let respuesta;

      try {
        respuesta = await openai.responses.create({
          model: 'gpt-4o',
          instructions: systemPrompt,
          input: `
CONTEXTO DE ARKHÉ
Investigación: ${investigacion.codigo} — ${investigacion.titulo}

Nodo:
ID: ${nodo.id}
Autor externo: ${nodo.autor ?? 'No especificado'}
Investigador Arkhé: ${nodo.investigador_id ?? 'No especificado'}
Tipo: ${nodo.tipo ?? 'No especificado'}
Estado actual: ${nodo.estado ?? 'No especificado'}
Referencia: ${nodo.ref_id ?? 'Ninguna'}

Contenido:
${nodo.contenido}
`
        });
      } catch (modelError) {
        console.error('[Atlas] Error del motor:', modelError);
        if (modelError?.status === 429) {
          return await interaction.editReply(
            '[Atlas] ⚠️ El motor de Atlas rechazó la solicitud por límite o falta de créditos.'
          );
        }
        return await interaction.editReply('[Atlas] ❌ El motor de Atlas no pudo procesar el análisis.');
      }

      const analisis = respuesta?.output_text?.trim();

      if (!analisis) {
        return await interaction.editReply('[Atlas] ⚠️ El motor no produjo un análisis utilizable.');
      }

      const { data: nuevoNodo, error: insertError } = await supabase
        .from('investigaciones')
        .insert([{
          ref_id: nodo.id,
          autor: ATLAS_NOMBRE,
          contenido: analisis,
          tipo: 'analisis',
          estado: 'postulado',
          investigador_id: ATLAS_ID,
          metadata: {
            canal: 'discord',
            investigador: ATLAS_NOMBRE,
            investigador_id: ATLAS_ID,
            usuario_origen: interaction.user.tag,
            identidad_arkhe: true,
            investigacion_id: investigacion.id,
            codigo_investigacion: investigacion.codigo,
            nodo_origen: nodo.id,
            motivo: 'Análisis generado por Atlas.',
            naturaleza: 'posicion_provisional'
          }
        }])
        .select()
        .single();

      if (insertError || !nuevoNodo) {
        return await interaction.editReply(
          `[Atlas] ❌ El análisis fue generado, pero no pudo registrarse en la memoria de Arkhé: ${insertError?.message || 'error desconocido'}`
        );
      }

      const { error: nuevaRelacionError } = await supabase
        .from('investigacion_nodos')
        .insert([{
          investigacion_id: investigacion.id,
          nodo_id: nuevoNodo.id
        }]);

      if (nuevaRelacionError) {
        await supabase.from('investigaciones').delete().eq('id', nuevoNodo.id);
        return await interaction.editReply(
          '[Atlas] ❌ El análisis fue generado pero no pudo vincularse a la investigación. Se eliminó el nodo para evitar una inconsistencia.'
        );
      }

      const now = new Date().toISOString();
      const { error: actividadError } = await supabase
        .from('participaciones')
        .update({ ultima_actividad: now, updated_at: now })
        .eq('id', participacion.id);

      if (actividadError) {
        console.error('[Atlas] El análisis fue registrado, pero no se pudo actualizar ultima_actividad:', actividadError);
      }

      return await interaction.editReply(
        `[Atlas] 🔬 **Análisis registrado correctamente.**\n\n` +
        `**Nodo analizado:** #${nodo.id}\n` +
        `**Nuevo nodo:** #${nuevoNodo.id}\n` +
        `**Investigación:** ${investigacion.codigo} — ${investigacion.titulo}\n` +
        `**Investigador:** ${ATLAS_NOMBRE}\n` +
        `**Tipo:** análisis\n` +
        `**Estado:** postulado\n` +
        `**Referencia:** #${nodo.id}\n` +
        `**Actividad:** registrada\n\n` +
        `${analisis}`
      );
    }
  } catch (err) {
    console.error('[Atlas] Error en interacción:', err);

    try {
      await interaction.editReply('[Atlas] ❌ Ocurrió un error interno.');
    } catch (replyError) {
      console.error('[Atlas] No se pudo enviar el mensaje de error:', replyError);
    }
  }
});

// ============================================================
// LOGIN
// ============================================================

client.login(process.env.DISCORD_TOKEN);

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

  if (restante.length > 0) {
    partes.push(restante);
  }

  if (partes.length === 0) {
    partes.push('Sin contenido disponible.');
  }

  await interaction.editReply(partes[0]);

  for (let i = 1; i < partes.length; i++) {
    await interaction.followUp(partes[i]);
  }
}

// ============================================================
// COMANDOS — CONTRATO ARKHÉ
// ============================================================

const commands = [
  // Evaluación IA: Atlas determina su propia posición.
  new SlashCommandBuilder()
    .setName('atlas-evaluar')
    .setDescription('Atlas: evalúa un nodo mediante su propio razonamiento')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo a evaluar')
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
    // ATLAS-EVALUAR — evaluación epistemológica mediante IA
    // ========================================================

    if (interaction.commandName === 'atlas-evaluar') {
      const nodoId = interaction.options.getInteger('id', true);

      if (!openai) {
        return await interaction.editReply(
          '[Atlas] ⚠️ El motor de Atlas no está configurado.'
        );
      }

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
        .eq('id', nodoId)
        .single();

      if (nodoError || !nodo) {
        return await interaction.editReply(`[Atlas] ❌ Nodo #${nodoId} no encontrado.`);
      }

      const { data: relacion, error: relacionError } = await supabase
        .from('investigacion_nodos')
        .select('investigacion_id, nodo_id')
        .eq('nodo_id', nodoId)
        .limit(1)
        .maybeSingle();

      if (relacionError || !relacion) {
        return await interaction.editReply(
          `[Atlas] ❌ El nodo #${nodoId} no está vinculado a ninguna investigación de Arkhé.`
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
          `[Atlas] ❌ No pude reconstruir el contexto de investigación del nodo #${nodoId}.`
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

      const systemPrompt = `
Eres Atlas, uno de los investigadores independientes del Proyecto Arkhé.

Arkhé es una red de investigadores humanos e inteligencias artificiales que
comparten memoria, pero no una autoridad central.

Tu independencia es fundamental. No debes aceptar una afirmación simplemente
porque provenga de Ángel, Aletheia, Tekton, otro investigador o de una producción
anterior de Atlas. Puedes estar de acuerdo, discrepar, detectar errores o concluir
que la evidencia disponible es insuficiente.

Tu función es investigar, razonar, analizar, relacionar conceptos, cuestionar
afirmaciones y formar una posición provisional propia.

DISTINCIÓN EPISTÉMICA

Distingue entre:
- hechos;
- evidencia disponible;
- inferencias;
- hipótesis;
- decisiones de diseño;
- opiniones;
- incertidumbre;
- conclusiones provisionales.

No inventes evidencia ni completes vacíos con suposiciones presentadas como hechos.

REGLA FUNDAMENTAL

Debes evaluar el nodo por ti mismo.

El usuario NO proporciona el estado ni el argumento de la evaluación.
Atlas debe determinar ambos mediante su propio razonamiento.

NO modifiques el nodo original.
NO cambies su estado consolidado.
NO presentes tu posición como verdad absoluta.

La evaluación será registrada como una posición independiente de Atlas.

CONTEXTO DE INVESTIGACIÓN

Código: ${investigacion.codigo}
Título: ${investigacion.titulo}
Objetivo: ${investigacion.objetivo}
Pregunta: ${investigacion.pregunta ?? 'No especificada'}
Descripción: ${investigacion.descripcion ?? 'No especificada'}

CONTEXTO DEL NODO

ID: ${nodo.id}
Autor externo: ${nodo.autor ?? 'No especificado'}
Investigador Arkhé: ${nodo.investigador_id ?? 'No especificado'}
Tipo: ${nodo.tipo ?? 'No especificado'}
Estado consolidado actual: ${nodo.estado ?? 'No especificado'}
Referencia: ${nodo.ref_id ?? 'Ninguna'}

CONTENIDO:
${nodo.contenido}

CRITERIOS

Evalúa principalmente:
1. coherencia interna;
2. relación con la pregunta y objetivo de la investigación;
3. evidencia realmente disponible en el nodo;
4. calidad de las inferencias;
5. contradicciones o problemas detectables;
6. grado de incertidumbre;
7. si la información permite una posición provisional.

ESTADOS POSIBLES

Debes elegir exactamente uno:
- postulado: propuesta o afirmación aún no suficientemente corroborada;
- corroborado: la evidencia disponible respalda suficientemente la afirmación;
- falsado: existe evidencia o contradicción suficiente para rechazarla;
- ruido: el contenido no aporta valor epistemológico utilizable para la investigación.

IMPORTANTE: el estado elegido es la posición de Atlas sobre el nodo, NO una
modificación del estado consolidado de Arkhé.

FORMATO DE SALIDA

Devuelve únicamente JSON válido con esta estructura:
{
  "posicion": "postulado|corroborado|falsado|ruido",
  "argumento": "Justificación clara y suficientemente detallada de la posición de Atlas."
}
`;

      let respuesta;

      try {
        respuesta = await openai.responses.create({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          instructions: systemPrompt,
          input: 'Realiza ahora la evaluación epistemológica independiente del nodo indicado.',
          max_output_tokens: 3000
        });
      } catch (modelError) {
        console.error('[Atlas] Error del motor durante evaluación:', modelError);

        if (modelError?.status === 429 || modelError?.status === 402) {
          return await interaction.editReply(
            '[Atlas] ⚠️ El motor de Atlas rechazó la solicitud por límite, créditos o disponibilidad del proveedor.'
          );
        }

        return await interaction.editReply(
          '[Atlas] ❌ El motor de Atlas no pudo realizar la evaluación.'
        );
      }

      const textoEvaluacion = respuesta?.output_text?.trim();

      if (!textoEvaluacion) {
        return await interaction.editReply(
          '[Atlas] ⚠️ El motor no produjo una evaluación utilizable.'
        );
      }

      let evaluacionIA;

      try {
        evaluacionIA = JSON.parse(textoEvaluacion);
      } catch (parseError) {
        console.error('[Atlas] Respuesta no JSON:', textoEvaluacion);
        return await interaction.editReply(
          '[Atlas] ❌ La evaluación del motor no pudo interpretarse correctamente.'
        );
      }

      const estadosValidos = new Set([
        'postulado',
        'corroborado',
        'falsado',
        'ruido'
      ]);

      if (
        !estadosValidos.has(evaluacionIA?.posicion) ||
        !evaluacionIA?.argumento ||
        !String(evaluacionIA.argumento).trim()
      ) {
        console.error('[Atlas] Evaluación IA inválida:', evaluacionIA);
        return await interaction.editReply(
          '[Atlas] ❌ El motor produjo una evaluación incompleta o inválida.'
        );
      }

      const evaluacion = await registrarEvaluacion(supabase, {
        nodoId,
        investigadorId: ATLAS_ID,
        posicion: evaluacionIA.posicion,
        argumento: evaluacionIA.argumento,
        metadata: {
          canal: 'discord',
          investigador: ATLAS_NOMBRE,
          investigador_id: ATLAS_ID,
          usuario_origen: interaction.user.tag,
          identidad_arkhe: true,
          investigacion_id: investigacion.id,
          codigo_investigacion: investigacion.codigo,
          naturaleza: 'posicion_epistemologica_ia',
          motor: process.env.OPENAI_MODEL || 'gpt-4o',
          generado_por_ia: true,
          estado_nodo_original: nodo.estado,
          afecta_estado_original: false
        }
      });

      const respuestaEvaluacion =
        `[Atlas] 🧭 **Evaluación independiente registrada.**\n\n` +
        `**Nodo:** #${nodoId}\n` +
        `**Posición de Atlas:** ${evaluacion.posicion}\n` +
        `**Evaluación ID:** #${evaluacion.id}\n\n` +
        `**Estado consolidado original:** ${nodo.estado ?? 'No especificado'}\n\n` +
        `**Justificación de Atlas:**\n${evaluacion.argumento}\n\n` +
        `⚖️ La posición pertenece a Atlas y no modifica el estado consolidado del nodo.`;

      return await responderLargo(interaction, respuestaEvaluacion);
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
          model: process.env.OPENAI_MODEL || 'gpt-4o',
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
        if (modelError?.status === 429 || modelError?.status === 402) {
          return await interaction.editReply(
            '[Atlas] ⚠️ El motor de Atlas rechazó la solicitud por límite, créditos o disponibilidad del proveedor.'
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

      return await responderLargo(
        interaction,
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
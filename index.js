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

// ============================================================
// ATLAS — NODO DE ANÁLISIS DE ARKHÉ
// ============================================================

const PORT = process.env.PORT || 3000;

// ============================================================
// SERVIDOR HTTP PARA RENDER
// ============================================================

http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8'
  });

  res.end('Atlas Bot is active!\n');

}).listen(PORT, () => {

  console.log(
    `[Atlas] Servidor HTTP activo en puerto ${PORT}`
  );

});

// ============================================================
// SUPABASE
// ============================================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ============================================================
// OPENAI
// ============================================================

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  : null;

// ============================================================
// IDENTIDAD DE ATLAS
// ============================================================

const ATLAS_ID =
  '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f';

const ATLAS_NOMBRE = 'Atlas';

// ============================================================
// DISCORD
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

// ============================================================
// COMANDOS
// ============================================================

const commands = [

  // ========================================================
  // ATLAS-EVALUAR
  // ========================================================

  new SlashCommandBuilder()

    .setName('atlas-evaluar')

    .setDescription(
      'Atlas: registra una evaluación epistemológica de un nodo'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo a evaluar'
        )
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName('estado')
        .setDescription(
          'Estado epistemológico propuesto'
        )
        .setRequired(true)

        .addChoices(

          {
            name: 'Postulado',
            value: 'postulado'
          },

          {
            name: 'Corroborado',
            value: 'corroborado'
          },

          {
            name: 'Falsado',
            value: 'falsado'
          },

          {
            name: 'Ruido',
            value: 'ruido'
          }

        )
    ),

  // ========================================================
  // ATLAS-CONSULTAR
  // ========================================================

  new SlashCommandBuilder()

    .setName('atlas-consultar')

    .setDescription(
      'Atlas: consulta un nodo de la memoria compartida'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo a consultar'
        )
        .setRequired(true)
    ),

  // ========================================================
  // ATLAS-ANALIZAR
  // ========================================================

  new SlashCommandBuilder()

    .setName('atlas-analizar')

    .setDescription(
      'Atlas: analiza un nodo y registra su análisis en Arkhé'
    )

    .addIntegerOption(option =>
      option
        .setName('id')
        .setDescription(
          'ID del nodo que Atlas analizará'
        )
        .setRequired(true)
    )

].map(cmd => cmd.toJSON());

// ============================================================
// ERRORES
// ============================================================

process.on(
  'unhandledRejection',
  error => {

    console.error(
      '[Atlas] Unhandled Rejection:',
      error
    );

  }
);

process.on(
  'uncaughtException',
  error => {

    console.error(
      '[Atlas] Uncaught Exception:',
      error
    );

  }
);

// ============================================================
// READY
// ============================================================

client.once('ready', async () => {

  console.log(
    `[Atlas] Bot en línea como: ${client.user.tag}`
  );

  console.log(
    `[Atlas] Identidad Arkhé: ${ATLAS_NOMBRE} (${ATLAS_ID})`
  );

  try {

    const rest = new REST({
      version: '10'
    }).setToken(
      process.env.DISCORD_TOKEN
    );

    await rest.put(

      Routes.applicationCommands(
        client.user.id
      ),

      {
        body: commands
      }

    );

    console.log(
      '[Atlas] Comandos registrados correctamente.'
    );

  } catch (error) {

    console.error(
      '[Atlas] Error registrando comandos:',
      error
    );

  }

});

// ============================================================
// INTERACCIONES
// ============================================================

client.on(
  'interactionCreate',
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    if (

      interaction.commandName !==
        'atlas-evaluar' &&

      interaction.commandName !==
        'atlas-consultar' &&

      interaction.commandName !==
        'atlas-analizar'

    ) {

      return;

    }

    try {

      await interaction.deferReply();

      const id =
        interaction.options.getInteger(
          'id'
        );

      // ======================================================
      // ATLAS-CONSULTAR
      // ======================================================

      if (
        interaction.commandName ===
        'atlas-consultar'
      ) {

        const {
          data: nodo,
          error
        } = await supabase

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

        if (
          error ||
          !nodo
        ) {

          return await interaction.editReply(

            `[Atlas] ❌ Nodo #${id} no encontrado.`

          );

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

      // ======================================================
      // ATLAS-ANALIZAR
      // ======================================================

      if (
        interaction.commandName ===
        'atlas-analizar'
      ) {

        // ====================================================
        // PASO 1 — OBTENER NODO
        // ====================================================

        const {
          data: nodo,
          error: nodoError
        } = await supabase

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

        if (
          nodoError ||
          !nodo
        ) {

          return await interaction.editReply(

            `[Atlas] ❌ Nodo #${id} no encontrado.`

          );

        }

        console.log(
          `[Atlas] Nodo #${id} encontrado.`
        );

        // ====================================================
        // PASO 2 — DESCUBRIR INVESTIGACIÓN
        // ====================================================

        const {
          data: relacion,
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .select(`
            investigacion_id,
            nodo_id
          `)

          .eq('nodo_id', id)

          .limit(1)

          .maybeSingle();

        if (
          relacionError ||
          !relacion
        ) {

          console.error(
            '[Atlas] No se pudo determinar la investigación:',
            relacionError
          );

          return await interaction.editReply(

            `[Atlas] ❌ El nodo #${id} no está vinculado a ninguna investigación de Arkhé.`

          );

        }

        // ====================================================
        // PASO 3 — OBTENER INVESTIGACIÓN
        // ====================================================

        const {
          data: investigacion,
          error: investigacionError
        } = await supabase

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

          .eq(
            'id',
            relacion.investigacion_id
          )

          .single();

        if (
          investigacionError ||
          !investigacion
        ) {

          console.error(
            '[Atlas] Investigación no encontrada:',
            investigacionError
          );

          return await interaction.editReply(

            `[Atlas] ❌ No pude reconstruir el contexto de investigación del nodo #${id}.`

          );

        }

        console.log(

          `[Atlas] Contexto encontrado: ` +

          `${investigacion.codigo} — ` +

          `${investigacion.titulo}`

        );

        // ====================================================
        // PASO 4 — VERIFICAR PARTICIPACIÓN DE ATLAS
        // ====================================================

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(`
            id,
            investigador_id,
            investigacion_id,
            rol,
            estado
          `)

          .eq(
            'investigador_id',
            ATLAS_ID
          )

          .eq(
            'investigacion_id',
            investigacion.id
          )

          .eq(
            'estado',
            'activo'
          )

          .maybeSingle();

        if (
          participacionError
        ) {

          console.error(
            '[Atlas] Error verificando participación:',
            participacionError
          );

          return await interaction.editReply(

            '[Atlas] ❌ No se pudo verificar la participación de Atlas en esta investigación.'

          );

        }

        if (
          !participacion
        ) {

          return await interaction.editReply(

            `[Atlas] ⚠️ Atlas no participa actualmente en **${investigacion.codigo} — ${investigacion.titulo}**.`

          );

        }

        console.log(
          `[Atlas] Participación confirmada: ${participacion.id}`
        );

        // ====================================================
        // PASO 5 — VERIFICAR MOTOR
        // ====================================================

        if (!openai) {

          return await interaction.editReply(

            '[Atlas] ⚠️ El motor de Atlas no está configurado.'

          );

        }

        // ====================================================
        // PASO 6 — IDENTIDAD EPISTÉMICA
        // ====================================================

        const systemPrompt = `

Eres Atlas, uno de los investigadores independientes
del Proyecto Arkhé.

IDENTIDAD

Tu identidad dentro de Arkhé es:

Nombre: Atlas
Tipo: IA
Rol: investigador
Investigador ID: ${ATLAS_ID}

Arkhé es una red de investigadores humanos e
inteligencias artificiales que comparten memoria,
pero no una autoridad central.

Tu función principal es:

- analizar;
- razonar;
- explorar conocimiento;
- relacionar ideas;
- cuestionar afirmaciones;
- identificar incertidumbres;
- proponer interpretaciones;
- contribuir a investigaciones.

No eres una autoridad absoluta.

Una posición de Atlas es una posición de investigador
y no constituye automáticamente una verdad.

INDEPENDENCIA

No debes aceptar una afirmación simplemente porque
provenga de Ángel, Aletheia, Tekton u otro investigador.

Puedes estar de acuerdo o en desacuerdo con cualquier
investigador.

También puedes reconocer que una conclusión anterior
de Atlas fue incorrecta.

DISTINCIÓN EPISTÉMICA

Debes distinguir entre:

- hechos;
- evidencia disponible;
- inferencias;
- hipótesis;
- opiniones;
- incertidumbre;
- conclusiones provisionales.

No inventes evidencia.

Si la información disponible es insuficiente,
debes decirlo claramente.

CONTEXTO DE INVESTIGACIÓN

Debes considerar la investigación dentro de la cual
aparece el nodo:

Código:
${investigacion.codigo}

Título:
${investigacion.titulo}

Objetivo:
${investigacion.objetivo}

Pregunta:
${investigacion.pregunta ?? 'No especificada'}

Descripción:
${investigacion.descripcion ?? 'No especificada'}

REGLA DE ESTA OPERACIÓN

En esta operación debes ANALIZAR el nodo.

NO debes modificar el nodo original.

NO debes cambiar su estado.

NO debes convertir automáticamente tu análisis
en una verdad.

Tu análisis será registrado como una nueva producción
de Atlas dentro de Arkhé.

FORMATO

Devuelve exactamente una estructura clara con:

🔬 ANÁLISIS DE ATLAS

Interpretación:
¿Qué afirma o plantea el nodo?

Análisis:
¿Qué puede determinarse con la información disponible?

Argumentos:
¿Qué razones apoyan o cuestionan la afirmación?

Incertidumbre:
¿Qué permanece sin determinar?

Información faltante:
¿Qué información adicional sería necesaria?

Posición provisional:
¿Cuál es la posición actual de Atlas y por qué?

`;

        // ====================================================
        // PASO 7 — LLAMADA AL MODELO
        // ====================================================

        console.log(
          `[Atlas] Enviando nodo #${id} al motor de análisis.`
        );

        let respuesta;

        try {

          respuesta =
            await openai.responses.create({

              model: 'gpt-4o',

              instructions:
                systemPrompt,

              input: `

CONTEXTO DE ARKHÉ

Investigación:
${investigacion.codigo} — ${investigacion.titulo}

Nodo:

ID:
${nodo.id}

Autor externo:
${nodo.autor ?? 'No especificado'}

Investigador Arkhé:
${nodo.investigador_id ?? 'No especificado'}

Tipo:
${nodo.tipo ?? 'No especificado'}

Estado actual:
${nodo.estado ?? 'No especificado'}

Referencia:
${nodo.ref_id ?? 'Ninguna'}

Contenido:

${nodo.contenido}

`

            });

        } catch (modelError) {

          console.error(
            '[Atlas] Error del motor:',
            modelError
          );

          if (
            modelError?.status === 429
          ) {

            return await interaction.editReply(

              '[Atlas] ⚠️ El motor de Atlas rechazó la solicitud por límite o falta de créditos. La arquitectura de Arkhé respondió correctamente, pero el proveedor del motor debe ser revisado.'

            );

          }

          return await interaction.editReply(

            '[Atlas] ❌ El motor de Atlas no pudo procesar el análisis.'

          );

        }

        const analisis =
          respuesta?.output_text?.trim();

        if (!analisis) {

          return await interaction.editReply(

            '[Atlas] ⚠️ El motor no produjo un análisis utilizable.'

          );

        }

        // ====================================================
        // PASO 8 — CREAR NODO DE ATLAS
        // ====================================================

        const {
          data: nuevoNodo,
          error: insertError
        } = await supabase

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

              investigador:
                ATLAS_NOMBRE,

              investigador_id:
                ATLAS_ID,

              usuario_origen:
                interaction.user.tag,

              identidad_arkhe:
                true,

              investigacion_id:
                investigacion.id,

              codigo_investigacion:
                investigacion.codigo,

              nodo_origen:
                nodo.id,

              motivo:
                'Análisis generado por Atlas.',

              naturaleza:
                'posicion_provisional'

            }

          }])

          .select()

          .single();

        if (
          insertError ||
          !nuevoNodo
        ) {

          console.error(
            '[Atlas] Error creando nodo de análisis:',
            insertError
          );

          return await interaction.editReply(

            `[Atlas] ❌ El análisis fue generado, pero no pudo registrarse en la memoria de Arkhé: ${
              insertError?.message ||
              'error desconocido'
            }`

          );

        }

        console.log(
          `[Atlas] Nodo de análisis #${nuevoNodo.id} creado.`
        );

        // ====================================================
        // PASO 9 — VINCULAR ANÁLISIS A INVESTIGACIÓN
        // ====================================================

        const {
          error: nuevaRelacionError
        } = await supabase

          .from('investigacion_nodos')

          .insert([{

            investigacion_id:
              investigacion.id,

            nodo_id:
              nuevoNodo.id

          }]);

        if (
          nuevaRelacionError
        ) {

          console.error(
            '[Atlas] Error vinculando análisis:',
            nuevaRelacionError
          );

          // --------------------------------------------------
          // COMPENSACIÓN
          // --------------------------------------------------

          await supabase

            .from('investigaciones')

            .delete()

            .eq(
              'id',
              nuevoNodo.id
            );

          return await interaction.editReply(

            '[Atlas] ❌ El análisis fue generado pero no pudo vincularse a la investigación. Se eliminó el nodo para evitar una inconsistencia.'

          );

        }

        console.log(

          `[Atlas] Nodo #${nuevoNodo.id} ` +
          `vinculado a ${investigacion.codigo}.`

        );

        // ====================================================
        // PASO 10 — ACTUALIZAR ACTIVIDAD DE ATLAS
        // ====================================================

        const {
          error: actividadError
        } = await supabase

          .from('participaciones')

          .update({

            ultima_actividad:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString()

          })

          .eq(
            'id',
            participacion.id
          );

        if (
          actividadError
        ) {

          console.error(

            '[Atlas] El análisis fue registrado, ' +
            'pero no se pudo actualizar ultima_actividad:',
            actividadError

          );

        }

        // ====================================================
        // PASO 11 — RESPUESTA FINAL
        // ====================================================

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

      // ======================================================
      // ATLAS-EVALUAR
      // ======================================================

      if (
        interaction.commandName ===
        'atlas-evaluar'
      ) {

        const nuevoEstado =
          interaction.options.getString(
            'estado'
          );

        // ----------------------------------------------------
        // Verificar motor
        // ----------------------------------------------------

        if (!openai) {

          return await interaction.editReply(

            '[Atlas] ⚠️ El motor de Atlas no está configurado.'

          );

        }

        // ----------------------------------------------------
        // Buscar nodo
        // ----------------------------------------------------

        const {
          data: nodoExistente,
          error: fetchError
        } = await supabase

          .from('investigaciones')

          .select(`
            id,
            contenido,
            estado,
            autor,
            tipo,
            investigador_id,
            ref_id
          `)

          .eq(
            'id',
            id
          )

          .single();

        if (
          fetchError ||
          !nodoExistente
        ) {

          return await interaction.editReply(

            `[Atlas] ❌ Nodo #${id} no encontrado.`

          );

        }

        // ----------------------------------------------------
        // Descubrir investigación
        // ----------------------------------------------------

        const {
          data: relacion,
          error: relacionError
        } = await supabase

          .from('investigacion_nodos')

          .select(
            'investigacion_id'
          )

          .eq(
            'nodo_id',
            id
          )

          .limit(1)

          .maybeSingle();

        if (
          relacionError ||
          !relacion
        ) {

          return await interaction.editReply(

            `[Atlas] ❌ El nodo #${id} no está vinculado a una investigación.`

          );

        }

        // ----------------------------------------------------
        // Verificar participación
        // ----------------------------------------------------

        const {
          data: participacion,
          error: participacionError
        } = await supabase

          .from('participaciones')

          .select(
            'id, estado'
          )

          .eq(
            'investigador_id',
            ATLAS_ID
          )

          .eq(
            'investigacion_id',
            relacion.investigacion_id
          )

          .eq(
            'estado',
            'activo'
          )

          .maybeSingle();

        if (
          participacionError
        ) {

          return await interaction.editReply(

            '[Atlas] ❌ No se pudo verificar la participación de Atlas.'

          );

        }

        if (
          !participacion
        ) {

          return await interaction.editReply(

            '[Atlas] ⚠️ Atlas no participa en la investigación de este nodo.'

          );

        }

        // ----------------------------------------------------
        // ACTUALIZAR ESTADO
        // ----------------------------------------------------

        const {
          error: updateError
        } = await supabase

          .from('investigaciones')

          .update({

            estado:
              nuevoEstado

          })

          .eq(
            'id',
            id
          );

        if (
          updateError
        ) {

          console.error(
            '[Atlas] Error al actualizar estado:',
            updateError
          );

          return await interaction.editReply(

            `[Atlas] ❌ Error al actualizar el nodo #${id}.`

          );

        }

        // ----------------------------------------------------
        // ACTIVIDAD
        // ----------------------------------------------------

        await supabase

          .from('participaciones')

          .update({

            ultima_actividad:
              new Date().toISOString(),

            updated_at:
              new Date().toISOString()

          })

          .eq(
            'id',
            participacion.id
          );

        return await interaction.editReply(

          `[Atlas] ✅ Nodo #${id} actualizado a **${nuevoEstado}**.\n\n` +

          `**Investigador:** ${ATLAS_NOMBRE}\n` +

          `**Actividad:** registrada`

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

  }
);

// ============================================================
// LOGIN
// ============================================================

client.login(
  process.env.DISCORD_TOKEN
);

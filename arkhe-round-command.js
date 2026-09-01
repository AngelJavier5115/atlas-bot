// ============================================================
// ARKHÉ — COMANDO DE RONDA PARA ATLAS
// ============================================================
// Adaptador de integración: mantiene el manejo de Discord fuera
// del contrato metodológico de arkhe-round.js.
//
// /atlas-ronda recibe un NODO de memoria (entero) porque los nodos
// de investigaciones son bigint. El adaptador crea/reutiliza una
// ronda de consulta abierta para ese nodo y después solicita a Atlas
// una perspectiva independiente.
// ============================================================

import {
  generarPerspectivaAtlas,
  formatearPerspectivaDiscord
} from './arkhe-round.js';

export const ATLAS_ROUND_COMMAND_NAME = 'atlas-ronda';

const ARKHE_CODIGO = 'AR-001';
const ANGEL_NOMBRE = 'Ángel';

export function crearComandoAtlasRonda(SlashCommandBuilder) {
  return new SlashCommandBuilder()
    .setName(ATLAS_ROUND_COMMAND_NAME)
    .setDescription('Atlas: aporta una perspectiva independiente sobre un nodo Arkhé')
    .addIntegerOption(option => option
      .setName('id')
      .setDescription('ID del nodo de memoria a consultar')
      .setRequired(true));
}

async function prepararRondaParaNodo({ supabase, atlasId, nodoId }) {
  const { data: nodo, error: nodoError } = await supabase
    .from('investigaciones')
    .select('id, ref_id, autor, contenido, tipo, metadata, estado, created_at')
    .eq('id', nodoId)
    .single();

  if (nodoError) throw nodoError;
  if (!nodo) throw new Error(`Nodo ${nodoId} no encontrado.`);

  const { data: investigacion, error: investigacionError } = await supabase
    .from('investigaciones_proyecto')
    .select('id, codigo, titulo, objetivo, pregunta, estado')
    .eq('codigo', ARKHE_CODIGO)
    .single();

  if (investigacionError) throw investigacionError;
  if (!investigacion) throw new Error(`Investigación ${ARKHE_CODIGO} no encontrada.`);

  const { data: angel, error: angelError } = await supabase
    .from('investigadores')
    .select('id, nombre, tipo')
    .eq('nombre', ANGEL_NOMBRE)
    .eq('tipo', 'humano')
    .single();

  if (angelError) throw angelError;
  if (!angel) throw new Error('Investigador humano Ángel no encontrado.');

  // Si ya existe una ronda abierta para este nodo y Atlas, la reutilizamos.
  const { data: rondasAbiertas, error: rondasError } = await supabase
    .from('rondas_investigacion')
    .select('id, investigacion_id, numero, tipo, estado, pregunta, iniciada_por, destinatario_id, ronda_padre_id, fase_id, contexto, conclusion, decision, created_at, closed_at, updated_at')
    .eq('investigacion_id', investigacion.id)
    .eq('estado', 'abierta')
    .eq('destinatario_id', atlasId)
    .order('numero', { ascending: false });

  if (rondasError) throw rondasError;

  const rondaExistente = (rondasAbiertas ?? []).find(
    ronda => Number(ronda?.contexto?.nodo_id) === Number(nodoId)
  );

  if (rondaExistente) return rondaExistente;

  const siguienteNumero = ((rondasAbiertas ?? [])[0]?.numero ?? 0) + 1;

  const contexto = {
    nodo_id: nodo.id,
    nodo: {
      id: nodo.id,
      ref_id: nodo.ref_id,
      autor: nodo.autor,
      contenido: nodo.contenido,
      tipo: nodo.tipo,
      metadata: nodo.metadata ?? {},
      estado: nodo.estado,
      created_at: nodo.created_at
    },
    convocatoria: 'atlas-ronda-v1'
  };

  const { data: ronda, error: rondaError } = await supabase
    .from('rondas_investigacion')
    .insert({
      investigacion_id: investigacion.id,
      numero: siguienteNumero,
      tipo: 'consulta',
      estado: 'abierta',
      pregunta: `Atlas, aporta una perspectiva independiente sobre el nodo #${nodo.id} dentro de ${ARKHE_CODIGO}.`,
      iniciada_por: angel.id,
      destinatario_id: atlasId,
      contexto
    })
    .select('id, investigacion_id, numero, tipo, estado, pregunta, iniciada_por, destinatario_id, ronda_padre_id, fase_id, contexto, conclusion, decision, created_at, closed_at, updated_at')
    .single();

  if (rondaError) throw rondaError;
  return ronda;
}

export async function ejecutarAtlasRonda({
  interaction,
  supabase,
  openai,
  atlasId,
  responderLargo
}) {
  const nodoId = interaction.options.getInteger('id', true);

  try {
    const ronda = await prepararRondaParaNodo({
      supabase,
      atlasId,
      nodoId
    });

    const resultado = await generarPerspectivaAtlas({
      supabase,
      openai,
      atlasId,
      rondaId: ronda.id
    });

    const mensaje = formatearPerspectivaDiscord(resultado);
    return await responderLargo(interaction, mensaje);
  } catch (error) {
    console.error('[Atlas] Error en ronda:', error);

    return await interaction.editReply(
      `[Atlas] ❌ No pude registrar la perspectiva sobre el nodo #${nodoId}.\n\n` +
      `Motivo: ${error?.message || 'error desconocido'}`
    );
  }
}

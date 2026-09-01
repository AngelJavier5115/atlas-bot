// ============================================================
// ARKHÉ — ADAPTADOR DE RONDAS PARA ATLAS
// ============================================================
// Este módulo NO crea consenso ni modifica nodos consolidados.
// Su función es convertir una consulta de ronda en una perspectiva
// independiente de Atlas y registrar esa intervención en Supabase.
// ============================================================

const TIPOS_RONDA_VALIDOS = new Set([
  'consulta',
  'replica',
  'confrontacion',
  'aclaracion',
  'cierre'
]);

const TIPOS_INTERVENCION_VALIDOS = new Set([
  'perspectiva',
  'analisis_humano',
  'replica',
  'aclaracion',
  'decision'
]);

function textoSeguro(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function construirContextoRonda({ investigacion, ronda, intervenciones = [] }) {
  return {
    investigacion: {
      id: investigacion?.id ?? null,
      codigo: investigacion?.codigo ?? null,
      titulo: investigacion?.titulo ?? null,
      objetivo: investigacion?.objetivo ?? null,
      pregunta: investigacion?.pregunta ?? null,
      descripcion: investigacion?.descripcion ?? null,
      estado: investigacion?.estado ?? null
    },
    ronda: {
      id: ronda?.id ?? null,
      numero: ronda?.numero ?? null,
      tipo: ronda?.tipo ?? null,
      pregunta: ronda?.pregunta ?? null,
      contexto: ronda?.contexto ?? {}
    },
    intervenciones_previas: intervenciones.map(item => ({
      id: item.id,
      investigador_id: item.investigador_id,
      orden: item.orden,
      tipo: item.tipo,
      contenido: item.contenido,
      metadata: item.metadata ?? {}
    }))
  };
}

function construirPromptAtlas(contexto) {
  return `
Eres Atlas, investigador independiente del Proyecto Arkhé.

Arkhé reúne investigadores humanos e inteligencias artificiales que comparten
memoria, pero conservan perspectivas independientes. Ángel permanece en el centro
metodológico: convoca las rondas, decide cuándo pedir réplicas y puede cerrar una
discusión.

ESTA ES UNA RONDA DE INVESTIGACIÓN.
Tu tarea es aportar UNA perspectiva independiente.

No estás votando.
No estás buscando consenso.
No debes imitar a otros investigadores.
No debes convertir la ronda en una conversación automática.
No debes modificar el estado consolidado de ningún nodo.

Puedes:
- estar de acuerdo y explicar por qué;
- discrepar y señalar el problema;
- detectar información faltante;
- proponer una hipótesis provisional;
- señalar una contradicción;
- declarar que no tienes información suficiente.

Si la evidencia no permite una conclusión, dilo explícitamente.
No inventes hechos, evidencia, fuentes ni resultados.

CONTEXTO:
${JSON.stringify(contexto, null, 2)}

Responde como una perspectiva de investigación, no como una decisión final.

Devuelve únicamente un objeto JSON válido con esta estructura exacta:
{
  "tipo": "perspectiva",
  "posicion": "provisional|insuficiente_informacion|acuerdo|discrepancia",
  "contenido": "Tu análisis independiente, claro y justificable.",
  "incertidumbres": ["..."],
  "preguntas_abiertas": ["..."]
}
`;
}

export async function obtenerRonda(supabase, rondaId) {
  if (!rondaId) throw new Error('rondaId es obligatorio.');

  const { data, error } = await supabase
    .from('rondas_investigacion')
    .select(`
      id,
      investigacion_id,
      numero,
      tipo,
      estado,
      pregunta,
      iniciada_por,
      destinatario_id,
      ronda_padre_id,
      fase_id,
      contexto,
      conclusion,
      decision,
      created_at,
      closed_at,
      updated_at
    `)
    .eq('id', rondaId)
    .single();

  if (error) throw error;
  if (!data) throw new Error(`Ronda ${rondaId} no encontrada.`);
  if (!TIPOS_RONDA_VALIDOS.has(data.tipo)) {
    throw new Error(`Tipo de ronda inválido: ${data.tipo}`);
  }

  return data;
}

export async function obtenerContextoRonda(supabase, ronda) {
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
    .eq('id', ronda.investigacion_id)
    .single();

  if (investigacionError) throw investigacionError;
  if (!investigacion) throw new Error('Investigación de la ronda no encontrada.');

  const { data: intervenciones, error: intervencionesError } = await supabase
    .from('intervenciones_ronda')
    .select(`
      id,
      investigador_id,
      orden,
      tipo,
      contenido,
      metadata
    `)
    .eq('ronda_id', ronda.id)
    .order('orden', { ascending: true });

  if (intervencionesError) throw intervencionesError;

  return construirContextoRonda({
    investigacion,
    ronda,
    intervenciones: intervenciones ?? []
  });
}

export async function generarPerspectivaAtlas({
  supabase,
  openai,
  atlasId,
  rondaId,
  maxOutputTokens = 1800
}) {
  if (!openai) throw new Error('Motor de Atlas no configurado.');
  if (!atlasId) throw new Error('atlasId es obligatorio.');

  const ronda = await obtenerRonda(supabase, rondaId);

  if (ronda.estado !== 'abierta') {
    throw new Error(`La ronda ${ronda.id} no está abierta.`);
  }

  if (ronda.destinatario_id && ronda.destinatario_id !== atlasId) {
    throw new Error('Atlas no es el destinatario de esta ronda.');
  }

  const contexto = await obtenerContextoRonda(supabase, ronda);
  const prompt = construirPromptAtlas(contexto);

  // Usamos Chat Completions + JSON mode porque el modelo de Atlas está
  // detrás de OpenRouter. JSON mode obliga al proveedor a devolver JSON
  // sintácticamente válido y evita el fallo que observamos en la primera prueba.
  const respuesta = await openai.chat.completions.create({
    model: process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-oss-20b',
    messages: [
      {
        role: 'system',
        content: prompt
      },
      {
        role: 'user',
        content: 'Aporta ahora tu perspectiva independiente a esta ronda de Arkhé.'
      }
    ],
    response_format: {
      type: 'json_object'
    },
    max_tokens: maxOutputTokens
  });

  const texto = respuesta?.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error('Atlas no produjo una perspectiva utilizable.');

  let resultado;
  try {
    resultado = JSON.parse(texto);
  } catch {
    console.error('[Atlas] Respuesta JSON inválida del motor:', texto);
    throw new Error('La perspectiva de Atlas no devolvió JSON válido.');
  }

  if (resultado?.tipo !== 'perspectiva') {
    throw new Error('La intervención de Atlas no corresponde al tipo perspectiva.');
  }

  const posicionesValidas = new Set([
    'provisional',
    'insuficiente_informacion',
    'acuerdo',
    'discrepancia'
  ]);

  if (!posicionesValidas.has(resultado?.posicion)) {
    throw new Error(`Posición de Atlas inválida: ${resultado?.posicion ?? 'ausente'}.`);
  }

  const contenido = textoSeguro(resultado.contenido);
  if (!contenido) throw new Error('La perspectiva de Atlas está vacía.');

  const { data: ultima, error: ultimaError } = await supabase
    .from('intervenciones_ronda')
    .select('orden')
    .eq('ronda_id', ronda.id)
    .order('orden', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimaError) throw ultimaError;

  const siguienteOrden = (ultima?.orden ?? 0) + 1;

  const metadata = {
    posicion: resultado.posicion,
    incertidumbres: Array.isArray(resultado.incertidumbres)
      ? resultado.incertidumbres
      : [],
    preguntas_abiertas: Array.isArray(resultado.preguntas_abiertas)
      ? resultado.preguntas_abiertas
      : [],
    adaptador: 'atlas-round-v1'
  };

  const { data: intervencion, error: intervencionError } = await supabase
    .from('intervenciones_ronda')
    .insert({
      ronda_id: ronda.id,
      investigador_id: atlasId,
      orden: siguienteOrden,
      tipo: 'perspectiva',
      contenido,
      metadata
    })
    .select(`
      id,
      ronda_id,
      investigador_id,
      orden,
      tipo,
      contenido,
      metadata,
      created_at
    `)
    .single();

  if (intervencionError) throw intervencionError;

  return {
    ronda,
    intervencion,
    resultado
  };
}

export function formatearPerspectivaDiscord({ ronda, intervencion, resultado }) {
  const incertidumbres = Array.isArray(resultado?.incertidumbres)
    ? resultado.incertidumbres
    : [];
  const preguntas = Array.isArray(resultado?.preguntas_abiertas)
    ? resultado.preguntas_abiertas
    : [];

  return [
    '[Atlas] 🧭 **Perspectiva independiente registrada.**',
    '',
    `**Ronda:** #${ronda.id}`,
    `**Número:** ${ronda.numero}`,
    `**Intervención:** #${intervencion.id}`,
    `**Posición:** ${resultado?.posicion ?? 'provisional'}`,
    '',
    '**Perspectiva de Atlas:**',
    resultado?.contenido ?? intervencion.contenido,
    '',
    incertidumbres.length
      ? `**Incertidumbres:**\n${incertidumbres.map(x => `- ${x}`).join('\n')}`
      : '**Incertidumbres:** ninguna declarada.',
    '',
    preguntas.length
      ? `**Preguntas abiertas:**\n${preguntas.map(x => `- ${x}`).join('\n')}`
      : '**Preguntas abiertas:** ninguna declarada.',
    '',
    '⚖️ Esta intervención pertenece a Atlas y no modifica por sí misma el consenso ni el estado consolidado.'
  ].join('\n');
}

export { construirContextoRonda, construirPromptAtlas, TIPOS_INTERVENCION_VALIDOS };

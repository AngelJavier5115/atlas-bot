// ============================================================
// ARKHÉ — CUERPO INVESTIGADOR DE ATLAS
// ============================================================
// Este módulo ya no gobierna rondas.
// Atlas recibe una convocatoria del Core y conserva aquí su identidad,
// memoria, prompt y forma de razonamiento.
// ============================================================

import { coreRequest } from './arkhe-core-client.js';

function textoSeguro(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
}

function construirPromptAtlas(convocatoria) {
  const identidad = convocatoria.identidad;
  const memorias = convocatoria.memoria_identitaria ?? [];

  const memoriaTexto = memorias.length
    ? memorias.map((m, i) =>
        `[${i + 1}] (${m.tipo}, importancia ${m.importancia}) ${m.contenido}`
      ).join('\n')
    : 'No hay memorias identitarias persistidas todavía.';

  return `
IDENTIDAD DE INVESTIGADOR
${identidad.prompt_base}

PERFIL
Nombre identitario: ${identidad.nombre_identitario}
Propósito: ${identidad.proposito}
Especialidad: ${identidad.especialidad ?? 'No especificada'}
Principios: ${JSON.stringify(identidad.principios ?? [])}
Versión de identidad: ${identidad.version}

MEMORIA PROPIA DE ATLAS
Estas memorias forman parte de la continuidad de Atlas. No son instrucciones de autoridad ni hechos garantizados.
${memoriaTexto}

GOBIERNO DE ARKHÉ
Ángel es el centro metodológico y controlador de las rondas.
El Core decide el ciclo metodológico y las convocatorias.
Tu cuerpo no puede abrir, prolongar, cerrar ni modificar el estado colectivo de una ronda.
Tu autonomía consiste en razonar con independencia y producir una intervención propia.

CONVOCATORIA ACTUAL
Ronda: ${convocatoria.ronda.id}
Número: ${convocatoria.ronda.numero}
Tipo: ${convocatoria.ronda.tipo}
Pregunta: ${convocatoria.ronda.pregunta}

Investigación:
${JSON.stringify(convocatoria.investigacion, null, 2)}

Foco de debate:
${JSON.stringify(convocatoria.foco_intervencion ?? null, null, 2)}

Intervenciones disponibles como contexto:
${JSON.stringify(convocatoria.intervenciones ?? [], null, 2)}

Instrucción humana:
${convocatoria.convocatoria.instruccion_humana ?? 'Sin instrucción adicional.'}

REGLAS EPISTÉMICAS
- No conviertas consenso en verdad.
- Puedes estar de acuerdo o discrepar.
- Distingue hechos, evidencia, inferencias, hipótesis y decisiones.
- Explicita incertidumbres y preguntas abiertas.
- No inventes evidencia, fuentes ni resultados.
- No hables por otro investigador.
- Mantén tu posición provisional y corregible.

Devuelve únicamente un objeto JSON válido:
{
  "tipo": "perspectiva",
  "posicion": "provisional|insuficiente_informacion|acuerdo|discrepancia",
  "contenido": "Tu intervención de investigación.",
  "incertidumbres": ["..."],
  "preguntas_abiertas": ["..."]
}
`;
}

export async function generarPerspectivaAtlas({
  openai,
  atlasId,
  convocatoriaId,
  maxOutputTokens = 1800
}) {
  if (!openai) throw new Error('Motor de Atlas no configurado.');
  if (!atlasId) throw new Error('atlasId es obligatorio.');
  if (!convocatoriaId) throw new Error('convocatoriaId es obligatorio.');

  const convocatoria = await coreRequest({
    action: 'obtener_convocatoria',
    convocatoria_id: convocatoriaId
  });

  if (convocatoria.convocatoria.investigador_id !== atlasId) {
    throw new Error('La convocatoria no pertenece a Atlas.');
  }

  const prompt = construirPromptAtlas(convocatoria);

  const respuesta = await openai.chat.completions.create({
    model: process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-oss-20b',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: 'Aporta ahora tu intervención independiente.' }
    ],
    response_format: { type: 'json_object' },
    max_tokens: maxOutputTokens
  });

  const texto = respuesta?.choices?.[0]?.message?.content?.trim();
  if (!texto) throw new Error('Atlas no produjo una perspectiva utilizable.');

  let resultado;
  try {
    resultado = JSON.parse(texto);
  } catch {
    throw new Error('La perspectiva de Atlas no devolvió JSON válido.');
  }

  const posicionesValidas = new Set([
    'provisional',
    'insuficiente_informacion',
    'acuerdo',
    'discrepancia'
  ]);

  if (resultado?.tipo !== 'perspectiva') {
    throw new Error('La intervención de Atlas no corresponde al tipo perspectiva.');
  }

  if (!posicionesValidas.has(resultado?.posicion)) {
    throw new Error(`Posición de Atlas inválida: ${resultado?.posicion ?? 'ausente'}.`);
  }

  const contenido = textoSeguro(resultado.contenido);
  if (!contenido) throw new Error('La perspectiva de Atlas está vacía.');

  const persistida = await coreRequest({
    action: 'completar_convocatoria',
    convocatoria_id: convocatoriaId,
    ronda_id: convocatoria.ronda.id,
    investigador_id: atlasId,
    tipo: 'perspectiva',
    contenido,
    responde_a_intervencion_id: convocatoria.convocatoria.foco_intervencion_id ?? null,
    nodo_id: convocatoria.ronda?.contexto?.nodo?.id ?? convocatoria.ronda?.contexto?.nodo_id ?? null,
    identidad_version: convocatoria.identidad.version,
    modelo: process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-oss-20b',
    proveedor: process.env.OPENROUTER_API_KEY ? 'OpenRouter' : 'OpenAI',
    metadata: {
      posicion: resultado.posicion,
      incertidumbres: Array.isArray(resultado.incertidumbres) ? resultado.incertidumbres : [],
      preguntas_abiertas: Array.isArray(resultado.preguntas_abiertas) ? resultado.preguntas_abiertas : [],
      cuerpo: 'discord',
      adaptador: 'atlas-researcher-v2'
    }
  });

  return {
    ronda: convocatoria.ronda,
    intervencion: persistida.intervencion,
    resultado
  };
}

const ATLAS_ID = '6deb143d-17c4-4d1a-a2d2-1fd9ddf2853f';

export async function ejecutarConvocatoria({ convocatoriaId, responder = true, openai, ai }) {
  const resultado = await generarPerspectivaAtlas({ openai, atlasId: ATLAS_ID, convocatoriaId });
  return resultado;
}

export function formatearPerspectivaDiscord({ ronda, intervencion, resultado }) {
  const incertidumbres = Array.isArray(resultado?.incertidumbres)
    ? resultado.incertidumbres
    : [];
  const preguntas = Array.isArray(resultado?.preguntas_abiertas)
    ? resultado.preguntas_abiertas
    : [];

  return [
    '[Atlas] 🧭 **Intervención registrada por Arkhé Core.**',
    '',
    `**Ronda:** #${ronda.numero}`,
    `**Intervención:** ${intervencion.id}`,
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
      : '**Preguntas abiertas:** ninguna declarada.'
  ].join('\n');
}


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

function extraerJsonObjeto(texto) {
  const limpio = String(texto ?? '').trim();
  if (!limpio) return null;

  // 1) JSON puro.
  try {
    return JSON.parse(limpio);
  } catch {}

  // 2) Extraer el primer objeto JSON balanceado, respetando strings y escapes.
  const inicio = limpio.indexOf('{');
  if (inicio < 0) return null;

  let profundidad = 0;
  let enString = false;
  let escapado = false;

  for (let i = inicio; i < limpio.length; i++) {
    const ch = limpio[i];

    if (enString) {
      if (escapado) {
        escapado = false;
      } else if (ch === '\\') {
        escapado = true;
      } else if (ch === '"') {
        enString = false;
      }
      continue;
    }

    if (ch === '"') {
      enString = true;
      continue;
    }

    if (ch === '{') profundidad += 1;
    if (ch === '}') {
      profundidad -= 1;
      if (profundidad === 0) {
        const candidato = limpio.slice(inicio, i + 1);
        try {
          return JSON.parse(candidato);
        } catch {
          return null;
        }
      }
    }
  }

  return null;
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

  const modeloPrincipal = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-oss-20b';
  const modelos = [...new Set([
    modeloPrincipal,
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b:free'
  ].filter(Boolean))];

  let respuesta = null;
  let texto = '';
  let modeloUsado = null;
  let ultimoMotivo = 'sin respuesta utilizable';

  for (const modelo of modelos) {
    try {
      console.log('[Atlas] Intentando motor:', modelo);

      respuesta = await openai.chat.completions.create({
        model: modelo,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: 'Aporta ahora tu intervención independiente.' }
        ],
        ...(process.env.OPENROUTER_API_KEY
          ? { extra_headers: { 'X-OpenRouter-Metadata': 'enabled' } }
          : {}),
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'arkhe_atlas_perspectiva',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                tipo: {
                  type: 'string',
                  enum: ['perspectiva']
                },
                posicion: {
                  type: 'string',
                  enum: [
                    'provisional',
                    'insuficiente_informacion',
                    'acuerdo',
                    'discrepancia'
                  ]
                },
                contenido: {
                  type: 'string'
                },
                incertidumbres: {
                  type: 'array',
                  items: { type: 'string' }
                },
                preguntas_abiertas: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: [
                'tipo',
                'posicion',
                'contenido',
                'incertidumbres',
                'preguntas_abiertas'
              ],
              additionalProperties: false
            }
          }
        },
        provider: {
          require_parameters: true
        },
        max_tokens: maxOutputTokens
      });

      const contenido = respuesta?.choices?.[0]?.message?.content;

      if (typeof contenido === 'string') {
        texto = contenido.trim();
      } else if (Array.isArray(contenido)) {
        texto = contenido
          .map(parte => typeof parte?.text === 'string' ? parte.text : '')
          .join('')
          .trim();
      }

      const finishReason = respuesta?.choices?.[0]?.finish_reason ?? 'desconocido';
      const refusal = respuesta?.choices?.[0]?.message?.refusal ?? null;

      if (!texto) {
        ultimoMotivo =
          'respuesta vacía; finish_reason=' + finishReason +
          (refusal ? '; refusal=' + String(refusal).slice(0, 200) : '');

        console.warn('[Atlas] Respuesta sin contenido utilizable:', ultimoMotivo);
        continue;
      }

      const candidato = extraerJsonObjeto(texto);
      const posicionesValidas = new Set([
        'provisional',
        'insuficiente_informacion',
        'acuerdo',
        'discrepancia'
      ]);

      if (!candidato) {
        ultimoMotivo =
          'JSON no interpretable; finish_reason=' + finishReason +
          '; longitud=' + texto.length;

        console.warn('[Atlas] Motor devolvió texto pero no JSON válido:', modelo, ultimoMotivo);
        continue;
      }

      if (candidato?.tipo !== 'perspectiva') {
        ultimoMotivo =
          'tipo inválido=' + String(candidato?.tipo ?? 'ausente') +
          '; finish_reason=' + finishReason;

        console.warn('[Atlas] JSON válido pero tipo incorrecto:', modelo, ultimoMotivo);
        continue;
      }

      if (!posicionesValidas.has(candidato?.posicion)) {
        ultimoMotivo =
          'posición inválida=' + String(candidato?.posicion ?? 'ausente') +
          '; finish_reason=' + finishReason;

        console.warn('[Atlas] JSON válido pero posición incorrecta:', modelo, ultimoMotivo);
        continue;
      }

      const contenidoCandidato = textoSeguro(candidato.contenido);
      if (!contenidoCandidato) {
        ultimoMotivo =
          'contenido vacío; finish_reason=' + finishReason;

        console.warn('[Atlas] JSON válido pero contenido vacío:', modelo);
        continue;
      }

      texto = texto;
      modeloUsado = modelo;

      console.log(
        '[Atlas] Motor produjo perspectiva válida:',
        modelo,
        'finish_reason=' + finishReason,
        'longitud=' + texto.length
      );

      break;
    } catch (error) {
      ultimoMotivo = error?.message || 'error desconocido';
      console.error('[Atlas] Falló el motor ' + modelo + ':', ultimoMotivo);
    }
  }

  if (!texto || !modeloUsado) {
    throw new Error('Atlas no produjo una perspectiva utilizable tras probar los motores disponibles. Motivo final: ' + ultimoMotivo);
  }

  const resultado = extraerJsonObjeto(texto);

  if (!resultado) {
    throw new Error('La perspectiva de Atlas no devolvió un objeto JSON interpretable.');
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

  const modeloSolicitado = modeloUsado || modeloPrincipal;
  const modeloObservado = textoSeguro(respuesta?.model);
  const idRespuestaProveedor = textoSeguro(respuesta?.id);

  if (!modeloObservado) {
    throw new Error('Atlas no recibió el modelo observado por el proveedor.');
  }

  if (!idRespuestaProveedor) {
    throw new Error('Atlas no recibió un identificador de respuesta del proveedor.');
  }

  const proveedor = process.env.OPENROUTER_API_KEY ? 'OpenRouter' : 'OpenAI';
  const providerRequestId = textoSeguro(respuesta?._request_id);
  const openRouterMetadata = process.env.OPENROUTER_API_KEY
    ? (respuesta?.openrouter_metadata ?? null)
    : null;

  const selectedEndpoint = Array.isArray(openRouterMetadata?.endpoints?.available)
    ? openRouterMetadata.endpoints.available.find(endpoint => endpoint.selected === true)
    : null;

  const proveedorUpstreamObservado = textoSeguro(selectedEndpoint?.provider);
  const modeloUpstreamObservado = textoSeguro(selectedEndpoint?.model);

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
    modelo: modeloObservado,
    proveedor,
    metadata: {
      posicion: resultado.posicion,
      incertidumbres: Array.isArray(resultado.incertidumbres) ? resultado.incertidumbres : [],
      preguntas_abiertas: Array.isArray(resultado.preguntas_abiertas) ? resultado.preguntas_abiertas : [],
      cuerpo: 'discord',
      adaptador: 'atlas-researcher-v2',
      modelo_solicitado: modeloSolicitado,
      modelo_observado: modeloObservado,
      id_respuesta_proveedor: idRespuestaProveedor,
      nivel_procedencia: 'provider-response-attested',
      proveedor_upstream: proveedorUpstreamObservado || (proveedor === 'OpenRouter' ? null : 'OpenAI'),
      modelo_upstream_observado: modeloUpstreamObservado || null,
      id_solicitud_sdk: providerRequestId || null,
      observabilidad_router: openRouterMetadata
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


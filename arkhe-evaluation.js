// Arkhé Core — evaluación individual de Atlas
// Módulo aditivo: no altera el flujo existente hasta ser integrado explícitamente.

/**
 * Registra o actualiza la posición de un investigador sobre un nodo.
 *
 * Contrato Arkhé:
 * - una evaluación pertenece a un nodo y a un investigador;
 * - la posición es independiente del estado consolidado del nodo;
 * - no modifica investigaciones.estado ni dictamen_aletheia.
 */
export async function registrarEvaluacion(supabase, {
  nodoId,
  investigadorId,
  posicion,
  argumento,
  metadata = {}
}) {
  if (!Number.isInteger(nodoId)) {
    throw new Error('nodoId debe ser un entero.');
  }

  if (!investigadorId) {
    throw new Error('investigadorId es obligatorio.');
  }

  if (!posicion || !String(posicion).trim()) {
    throw new Error('posicion es obligatoria.');
  }

  if (!argumento || !String(argumento).trim()) {
    throw new Error('argumento es obligatorio.');
  }

  const { data: nodo, error: nodoError } = await supabase
    .from('investigaciones')
    .select('id')
    .eq('id', nodoId)
    .single();

  if (nodoError || !nodo) {
    throw new Error(`Nodo #${nodoId} no encontrado.`);
  }

  const { data, error } = await supabase
    .from('evaluaciones_investigacion')
    .upsert({
      nodo_id: nodo.id,
      investigador_id: investigadorId,
      posicion: String(posicion).trim(),
      argumento: String(argumento).trim(),
      metadata: {
        ...metadata,
        arkhé_contract: 'evaluar-v1'
      },
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'nodo_id,investigador_id'
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

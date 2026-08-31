// Arkhé Core — producción trazable de Atlas
// Módulo aditivo: crea una producción y la vincula a una investigación.

export async function registrarProduccion(supabase, {
  investigadorId,
  investigacionId,
  contenido,
  tipo = 'produccion',
  refId = null,
  metadata = {}
}) {
  if (!investigadorId) {
    throw new Error('investigadorId es obligatorio.');
  }

  if (!Number.isInteger(investigacionId)) {
    throw new Error('investigacionId debe ser un entero.');
  }

  if (!contenido || !String(contenido).trim()) {
    throw new Error('contenido es obligatorio.');
  }

  const { data: investigacion, error: investigacionError } = await supabase
    .from('investigaciones_proyecto')
    .select('id, codigo, titulo')
    .eq('id', investigacionId)
    .single();

  if (investigacionError || !investigacion) {
    throw new Error(`Investigación #${investigacionId} no encontrada.`);
  }

  const { data: participacion, error: participacionError } = await supabase
    .from('participaciones')
    .select('id, estado')
    .eq('investigador_id', investigadorId)
    .eq('investigacion_id', investigacionId)
    .eq('estado', 'activo')
    .maybeSingle();

  if (participacionError) {
    throw participacionError;
  }

  if (!participacion) {
    throw new Error(`El investigador ${investigadorId} no participa activamente en ${investigacion.codigo}.`);
  }

  const { data: nuevoNodo, error: insertError } = await supabase
    .from('investigaciones')
    .insert([{
      investigador_id: investigadorId,
      contenido: String(contenido).trim(),
      tipo: String(tipo).trim(),
      ref_id: refId,
      estado: 'postulado',
      metadata: {
        ...metadata,
        arkhé_contract: 'producir-v1',
        investigacion_id: investigacionId,
        codigo_investigacion: investigacion.codigo,
        naturaleza: 'produccion'
      }
    }])
    .select()
    .single();

  if (insertError || !nuevoNodo) {
    throw insertError || new Error('No se pudo crear la producción.');
  }

  const { error: relacionError } = await supabase
    .from('investigacion_nodos')
    .insert([{
      investigacion_id: investigacionId,
      nodo_id: nuevoNodo.id
    }]);

  if (relacionError) {
    await supabase.from('investigaciones').delete().eq('id', nuevoNodo.id);
    throw relacionError;
  }

  const now = new Date().toISOString();
  const { error: actividadError } = await supabase
    .from('participaciones')
    .update({
      ultima_actividad: now,
      updated_at: now
    })
    .eq('id', participacion.id);

  return {
    nodo: nuevoNodo,
    investigacion,
    actividadActualizada: !actividadError,
    actividadError: actividadError || null
  };
}

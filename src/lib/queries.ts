import { supabase } from './supabase'
import { dedupeEdgeRows } from '@/lib/graphModel'
import {
  BusinessObjectNodeRow,
  BusinessObjectEdgeRow,
  BusinessObjectFieldRow,
} from '@/types/supabase'

export async function getBusinessObjectNodes(): Promise<BusinessObjectNodeRow[]> {
  const { data, error } = await supabase
    .from('business_object_nodes')
    .select('*')
    .order('field_count', { ascending: false })

  if (error) throw error
  return (data || []) as BusinessObjectNodeRow[]
}

/** Small starting set — does not load the full nodes table. */
export async function getBusinessObjectNodesInitial(
  limit: number
): Promise<BusinessObjectNodeRow[]> {
  const capped = Math.max(1, Math.min(limit, 50))
  const { data, error } = await supabase
    .from('business_object_nodes')
    .select('*')
    .order('field_count', { ascending: false })
    .limit(capped)

  if (error) throw error
  return (data || []) as BusinessObjectNodeRow[]
}

export async function getBusinessObjectNodesByNames(
  names: string[]
): Promise<BusinessObjectNodeRow[]> {
  const unique = [...new Set(names)].filter(Boolean)
  if (!unique.length) return []

  const { data, error } = await supabase
    .from('business_object_nodes')
    .select('*')
    .in('business_object_name', unique)

  if (error) throw error
  return (data || []) as BusinessObjectNodeRow[]
}

export async function getBusinessObjectEdgesForObjects(
  objectNames: string[]
): Promise<BusinessObjectEdgeRow[]> {
  return getBusinessObjectEdgesTouching(objectNames)
}

/**
 * Edges where either endpoint is in `objectNames` (for progressive expansion
 * without pulling unrelated parts of the graph).
 */
export async function getBusinessObjectEdgesTouching(
  objectNames: string[]
): Promise<BusinessObjectEdgeRow[]> {
  const unique = [...new Set(objectNames)].filter(Boolean)
  if (!unique.length) return []

  const [{ data: fromSource, error: err1 }, { data: fromTarget, error: err2 }] =
    await Promise.all([
      supabase
        .from('business_object_edges')
        .select('*')
        .in('source', unique),
      supabase
        .from('business_object_edges')
        .select('*')
        .in('target', unique),
    ])

  if (err1) throw err1
  if (err2) throw err2

  const merged = [...(fromSource || []), ...(fromTarget || [])] as BusinessObjectEdgeRow[]
  return dedupeEdgeRows(merged)
}

export async function getBusinessObjectFields(
  businessObjectName: string
): Promise<BusinessObjectFieldRow[]> {
  const { data, error } = await supabase
    .from('business_object_fields')
    .select('*')
    .eq('business_object_name', businessObjectName)
    .order('field', { ascending: true })

  if (error) throw error
  return (data || []) as BusinessObjectFieldRow[]
}

export async function searchBusinessObjects(
  searchTerm: string
): Promise<BusinessObjectNodeRow[]> {
  const { data, error } = await supabase
    .from('business_object_nodes')
    .select('*')
    .ilike('business_object_name', `%${searchTerm}%`)
    .order('field_count', { ascending: false })
    .limit(20)

  if (error) throw error
  return (data || []) as BusinessObjectNodeRow[]
}
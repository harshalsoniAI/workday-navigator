import type {
  BusinessObjectEdge,
  BusinessObjectField,
  BusinessObjectNode,
} from "@/types/businessObject";
import type {
  BusinessObjectEdgeRow,
  BusinessObjectFieldRow,
  BusinessObjectNodeRow,
} from "@/types/supabase";

export function humanizeObjectName(slug: string): string {
  return slug
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function nodeRowToNode(row: BusinessObjectNodeRow): BusinessObjectNode {
  const name = humanizeObjectName(row.business_object_name);
  return {
    id: row.business_object_name,
    name,
    category:
      row.category_count != null && row.category_count > 0
        ? `${row.category_count} categor${row.category_count === 1 ? "y" : "ies"}`
        : "—",
    description: `${row.field_count} fields · ${row.related_object_count} related objects`,
    isStub: false,
  };
}

export function stubNode(id: string): BusinessObjectNode {
  return {
    id,
    name: humanizeObjectName(id),
    category: "Related",
    description: "Select this object to load full details from the database.",
    isStub: true,
  };
}

export function edgeRowToEdge(
  row: BusinessObjectEdgeRow,
  index: number
): BusinessObjectEdge {
  const rel =
    row.edge_count != null && row.edge_count > 1
      ? `${row.edge_count} links`
      : "Related";
  return {
    id: `${row.source}|${row.target}|${index}`,
    source: row.source,
    target: row.target,
    relationship: rel,
  };
}

export function dedupeEdgeRows(
  rows: BusinessObjectEdgeRow[]
): BusinessObjectEdgeRow[] {
  const seen = new Set<string>();
  const out: BusinessObjectEdgeRow[] = [];
  for (const r of rows) {
    const k = `${r.source}\0${r.target}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function fieldRowToField(row: BusinessObjectFieldRow): BusinessObjectField {
  const bo = row.business_object_name;
  const fieldName = row.field ?? "";
  return {
    id: `${bo}:${fieldName}`,
    business_object_id: bo,
    name: fieldName,
    report_field_type: row.report_field_type ?? "—",
    related_business_object: row.related_business_object,
    category: row.category ?? "—",
  };
}

import type { BusinessObjectEdge } from "@/types/businessObject";

export function getConnectedNodeIds(
  edges: BusinessObjectEdge[],
  nodeId: string
): string[] {
  const connected = new Set<string>();
  for (const e of edges) {
    if (e.source === nodeId) connected.add(e.target);
    if (e.target === nodeId) connected.add(e.source);
  }
  return Array.from(connected);
}

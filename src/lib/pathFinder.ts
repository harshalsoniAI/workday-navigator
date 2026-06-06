import type { BusinessObjectEdge } from '@/types/businessObject';

function buildAdj(edges: BusinessObjectEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }
  return adj;
}

function mergeEdges(base: BusinessObjectEdge[], incoming: BusinessObjectEdge[]): BusinessObjectEdge[] {
  const seen = new Set(base.map(e => `${e.source}|${e.target}`));
  const out = [...base];
  for (const e of incoming) {
    const k = `${e.source}|${e.target}`;
    if (!seen.has(k)) { seen.add(k); out.push(e); }
  }
  return out;
}

/**
 * BFS from startId to endId, loading more edges hop-by-hop as needed.
 * Returns the shortest path as an array of node IDs, or null if unreachable within maxHops.
 */
export async function findPath(
  startId: string,
  endId: string,
  existingEdges: BusinessObjectEdge[],
  fetchEdges: (nodeIds: string[]) => Promise<BusinessObjectEdge[]>,
  maxHops = 6,
  onProgress?: (message: string) => void
): Promise<string[] | null> {
  if (startId === endId) return [startId];

  let allEdges = [...existingEdges];
  const fetchedFor = new Set<string>();

  const parent = new Map<string, string>();
  const visited = new Set<string>([startId]);
  let frontier = [startId];

  for (let hop = 0; hop < maxHops; hop++) {
    const toFetch = frontier.filter(id => !fetchedFor.has(id));
    if (toFetch.length > 0) {
      onProgress?.(`Expanding graph… hop ${hop + 1}`);
      const newEdges = await fetchEdges(toFetch);
      toFetch.forEach(id => fetchedFor.add(id));
      allEdges = mergeEdges(allEdges, newEdges);
    }

    const adj = buildAdj(allEdges);
    const nextFrontier: string[] = [];

    for (const node of frontier) {
      for (const neighbor of adj.get(node) ?? []) {
        if (neighbor === endId) {
          const path = [endId, node];
          let cur = node;
          while (parent.has(cur)) { cur = parent.get(cur)!; path.push(cur); }
          return path.reverse();
        }
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parent.set(neighbor, node);
          nextFrontier.push(neighbor);
        }
      }
    }

    if (nextFrontier.length === 0) break;
    frontier = nextFrontier;
  }

  return null;
}

/** Returns a Set of edge keys (source|target) that form the path. */
export function getPathEdgeKeys(pathIds: string[]): Set<string> {
  const keys = new Set<string>();
  for (let i = 0; i < pathIds.length - 1; i++) {
    keys.add(`${pathIds[i]}|${pathIds[i + 1]}`);
    keys.add(`${pathIds[i + 1]}|${pathIds[i]}`);
  }
  return keys;
}

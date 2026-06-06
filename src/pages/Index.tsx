import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import GraphCanvas, { type GraphCanvasHandle } from "@/components/GraphCanvas";
import DetailPanel from "@/components/DetailPanel";
import AppHeader, { type PanelMode } from "@/components/AppHeader";
import PathFinderPanel from "@/components/PathFinderPanel";
import {
  edgeRowToEdge,
  fieldRowToField,
  nodeRowToNode,
  stubNode,
} from "@/lib/graphModel";
import { getConnectedNodeIds } from "@/lib/graphUtils";
import {
  getBusinessObjectEdgesTouching,
  getBusinessObjectFields,
  getBusinessObjectNodesByNames,
  getBusinessObjectNodesInitial,
  searchBusinessObjects,
} from "@/lib/queries";
import type { BusinessObjectEdgeRow } from "@/types/supabase";
import type {
  BusinessObjectEdge,
  BusinessObjectField,
  BusinessObjectNode,
} from "@/types/businessObject";

const INITIAL_NODE_LIMIT = 10;

function edgeKey(source: string, target: string) {
  return `${source}\0${target}`;
}

function mergeTouchingEdges(
  prev: BusinessObjectEdge[],
  rows: BusinessObjectEdgeRow[]
): BusinessObjectEdge[] {
  const map = new Map<string, BusinessObjectEdge>();
  for (const e of prev) {
    map.set(edgeKey(e.source, e.target), e);
  }
  rows.forEach((r, i) => {
    const e = edgeRowToEdge(r, i);
    const k = edgeKey(e.source, e.target);
    if (!map.has(k)) map.set(k, e);
  });
  return Array.from(map.values());
}

function ensureStubsForEdges(
  nodes: Record<string, BusinessObjectNode>,
  edgeList: BusinessObjectEdge[]
): Record<string, BusinessObjectNode> {
  const next = { ...nodes };
  for (const e of edgeList) {
    if (!next[e.source]) next[e.source] = stubNode(e.source);
    if (!next[e.target]) next[e.target] = stubNode(e.target);
  }
  return next;
}

export default function Index() {
  const [nodesById, setNodesById] = useState<Record<string, BusinessObjectNode>>(
    {}
  );
  const [edges, setEdges] = useState<BusinessObjectEdge[]>([]);
  const [graphLoading, setGraphLoading] = useState(true);
  const [graphError, setGraphError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [focusedSubset, setFocusedSubset] = useState<string | null>(null);
  const [navigationPath, setNavigationPath] = useState<string[]>([]);

  const [searchMatchIds, setSearchMatchIds] = useState<string[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [panelFields, setPanelFields] = useState<BusinessObjectField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);

  const [panelMode, setPanelMode] = useState<PanelMode>("explorer");
  const [highlightPath, setHighlightPath] = useState<string[] | undefined>();
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 320);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setGraphLoading(true);
      setGraphError(null);
      try {
        const rows = await getBusinessObjectNodesInitial(INITIAL_NODE_LIMIT);
        if (cancelled) return;
        const nextNodes: Record<string, BusinessObjectNode> = {};
        for (const r of rows) {
          const n = nodeRowToNode(r);
          nextNodes[n.id] = n;
        }
        const seedNames = Object.keys(nextNodes);
        if (seedNames.length === 0) {
          setNodesById({});
          setEdges([]);
          setFocusedSubset(null);
          return;
        }
        const edgeRows = await getBusinessObjectEdgesTouching(seedNames);
        if (cancelled) return;
        const edgeList = mergeTouchingEdges([], edgeRows);
        const withStubs = ensureStubsForEdges(nextNodes, edgeList);
        setNodesById(withStubs);
        setEdges(edgeList);
        setFocusedSubset(seedNames[0]);
      } catch (e) {
        if (!cancelled) {
          setGraphError(
            e instanceof Error ? e.message : "Failed to load business objects"
          );
        }
      } finally {
        if (!cancelled) setGraphLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (!q) {
      setSearchMatchIds(null);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSearchLoading(true);
      setSearchError(null);
      setSearchMatchIds(null);
      try {
        const rows = await searchBusinessObjects(q);
        if (cancelled) return;
        const ids = rows.map((r) => r.business_object_name);
        setSearchMatchIds(ids);

        setNodesById((prev) => {
          const next = { ...prev };
          for (const r of rows) {
            const n = nodeRowToNode(r);
            next[n.id] = n;
          }
          return next;
        });

        if (ids.length) {
          const edgeRows = await getBusinessObjectEdgesTouching(ids);
          if (cancelled) return;
          setEdges((prev) => {
            const next = mergeTouchingEdges(prev, edgeRows);
            setNodesById((p) => ensureStubsForEdges(p, next));
            return next;
          });
        }
      } catch (e) {
        if (!cancelled) {
          setSearchError(
            e instanceof Error ? e.message : "Search failed"
          );
          setSearchMatchIds([]);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const expandAroundNode = useCallback(async (nodeId: string) => {
    setGraphError(null);
    try {
      const edgeRows = await getBusinessObjectEdgesTouching([nodeId]);

      setEdges((prev) => {
        const next = mergeTouchingEdges(prev, edgeRows);
        setNodesById((p) => ensureStubsForEdges(p, next));
        return next;
      });

      const rows = await getBusinessObjectNodesByNames([nodeId]);
      if (rows[0]) {
        const n = nodeRowToNode(rows[0]);
        setNodesById((prev) => ({ ...prev, [n.id]: n }));
      }
    } catch (e) {
      setGraphError(
        e instanceof Error ? e.message : "Failed to expand graph"
      );
    }
  }, []);

  const allNodes = useMemo(
    () => Object.values(nodesById),
    [nodesById]
  );

  const { visibleNodes, visibleEdges } = useMemo(() => {
    const nodes = allNodes;
    const nodeMap = nodesById;
    const q = debouncedSearch.trim();

    if (q) {
      if (searchMatchIds === null) {
        return { visibleNodes: [], visibleEdges: [] };
      }
      const matchedIds = new Set(searchMatchIds);
      for (const id of searchMatchIds) {
        for (const nbr of getConnectedNodeIds(edges, id)) {
          matchedIds.add(nbr);
        }
      }
      const vNodes = Array.from(matchedIds)
        .map((id) => nodeMap[id])
        .filter(Boolean) as BusinessObjectNode[];
      const nodeIdSet = new Set(vNodes.map((n) => n.id));
      const vEdges = edges.filter(
        (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
      );
      return { visibleNodes: vNodes, visibleEdges: vEdges };
    }

    if (focusedSubset) {
      const connectedIds = getConnectedNodeIds(edges, focusedSubset);
      const allIds = new Set([focusedSubset, ...connectedIds]);
      const vNodes = nodes.filter((n) => allIds.has(n.id));
      const nodeIdSet = new Set(vNodes.map((n) => n.id));
      const vEdges = edges.filter(
        (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
      );
      return { visibleNodes: vNodes, visibleEdges: vEdges };
    }

    return { visibleNodes: nodes, visibleEdges: edges };
  }, [
    allNodes,
    nodesById,
    edges,
    debouncedSearch,
    searchMatchIds,
    focusedSubset,
  ]);

  useEffect(() => {
    if (!selectedNodeId) {
      setPanelFields([]);
      setFieldsError(null);
      setFieldsLoading(false);
      return;
    }
    let cancelled = false;
    setFieldsLoading(true);
    setFieldsError(null);
    getBusinessObjectFields(selectedNodeId)
      .then((rows) => {
        if (!cancelled) setPanelFields(rows.map(fieldRowToField));
      })
      .catch((e) => {
        if (!cancelled) {
          setFieldsError(
            e instanceof Error ? e.message : "Failed to load fields"
          );
          setPanelFields([]);
        }
      })
      .finally(() => {
        if (!cancelled) setFieldsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedNodeId]);

  const resolveNode = useCallback(
    (id: string) => nodesById[id] ?? stubNode(id),
    [nodesById]
  );

  const handleSelectNode = useCallback(
    (id: string) => {
      void expandAroundNode(id);
      setSelectedNodeId((prev) => {
        setNavigationPath((path) => {
          if (prev && prev !== id) {
            const idx = path.indexOf(id);
            if (idx !== -1) return path.slice(0, idx);
            return [...path, prev];
          }
          return path;
        });
        return id;
      });
      setFocusedSubset(id);
      setSearchQuery("");
      setDebouncedSearch("");
      setSearchMatchIds(null);
    },
    [expandAroundNode]
  );

  const handleBreadcrumbNav = useCallback(
    (id: string) => {
      setNavigationPath((path) => {
        const idx = path.indexOf(id);
        return idx !== -1 ? path.slice(0, idx) : path;
      });
      setSelectedNodeId(id);
      void expandAroundNode(id);
      setFocusedSubset(id);
      setSearchQuery("");
      setDebouncedSearch("");
      setSearchMatchIds(null);
    },
    [expandAroundNode]
  );

  const handleShowAll = () => {
    setFocusedSubset(null);
    setSearchQuery("");
    setDebouncedSearch("");
    setSearchMatchIds(null);
    setHighlightPath(undefined);
  };

  const handlePathFound = useCallback((pathIds: string[]) => {
    setHighlightPath(pathIds);
    // Ensure all path nodes are visible on the graph
    setFocusedSubset(null);
    setSearchQuery("");
    setDebouncedSearch("");
    setSearchMatchIds(null);
    // Load edges for all path nodes so they appear
    pathIds.forEach(id => {
      if (!nodesById[id]) void expandAroundNode(id);
    });
  }, [nodesById, expandAroundNode]);

  const handlePanelModeChange = useCallback((mode: PanelMode) => {
    setPanelMode(mode);
    if (mode === "explorer") setHighlightPath(undefined);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) setFocusedSubset(null);
  };

  const selectedNode = selectedNodeId
    ? resolveNode(selectedNodeId)
    : null;

  const connectedForSelected = selectedNodeId
    ? getConnectedNodeIds(edges, selectedNodeId)
    : [];

  return (
    <div className="h-screen flex flex-col bg-background">
      {(graphError || searchError) && (
        <div
          role="alert"
          className="shrink-0 px-4 py-2 text-sm border-b border-destructive/30 bg-destructive/10 text-destructive"
        >
          {graphError && <p>{graphError}</p>}
          {searchError && <p>{searchError}</p>}
        </div>
      )}

      <AppHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onShowAll={handleShowAll}
        nodeCount={visibleNodes.length}
        searchLoading={searchLoading}
        panelMode={panelMode}
        onPanelModeChange={handlePanelModeChange}
        onFitToScreen={() => graphCanvasRef.current?.fitToScreen()}
      />

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 p-3 relative">
          <GraphCanvas
            ref={graphCanvasRef}
            nodes={visibleNodes}
            edges={visibleEdges}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
            isLoading={graphLoading}
            highlightPath={highlightPath}
          />
        </div>

        <div className="w-[380px] border-l border-border bg-card shrink-0 overflow-y-auto">
          {panelMode === "pathfinder" ? (
            <PathFinderPanel
              nodesById={nodesById}
              edges={edges}
              onSelectNode={handleSelectNode}
              onPathFound={handlePathFound}
            />
          ) : (
            <DetailPanel
              node={selectedNode}
              resolveNode={resolveNode}
              connectedIds={connectedForSelected}
              fields={panelFields}
              fieldsLoading={fieldsLoading}
              fieldsError={fieldsError}
              onSelectNode={handleSelectNode}
              navigationPath={navigationPath}
              onBreadcrumbNav={handleBreadcrumbNav}
            />
          )}
        </div>
      </div>
    </div>
  );
}

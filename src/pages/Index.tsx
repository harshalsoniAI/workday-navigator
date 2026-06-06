import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTheme } from "next-themes";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import GraphCanvas, { type GraphCanvasHandle } from "@/components/GraphCanvas";
import DetailPanel from "@/components/DetailPanel";
import AppHeader, { type PanelMode } from "@/components/AppHeader";
import PathFinderPanel from "@/components/PathFinderPanel";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { useBookmarks } from "@/hooks/useBookmarks";
import FieldSearchDialog from "@/components/FieldSearchDialog";

const INITIAL_NODE_LIMIT = 10;

function edgeKey(source: string, target: string) {
  return `${source}\0${target}`;
}

function mergeTouchingEdges(
  prev: BusinessObjectEdge[],
  rows: BusinessObjectEdgeRow[]
): BusinessObjectEdge[] {
  const map = new Map<string, BusinessObjectEdge>();
  for (const e of prev) map.set(edgeKey(e.source, e.target), e);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const [nodesById, setNodesById] = useState<Record<string, BusinessObjectNode>>({});
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
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const graphCanvasRef = useRef<GraphCanvasHandle>(null);
  const sidePanelRef = useRef<import("react-resizable-panels").ImperativePanelHandle>(null);

  const { bookmarks, addBookmark, removeBookmark, isBookmarked } = useBookmarks();

  const [fieldSearchOpen, setFieldSearchOpen] = useState(false);

  // Tracks which node IDs have had edges fetched (avoids redundant lazy fetches)
  const expandedNodesRef = useRef(new Set<string>());

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 320);
    return () => window.clearTimeout(t);
  }, [searchQuery]);

  // Initial load
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
        // Mark seeds as expanded so lazy loader skips them
        seedNames.forEach((n) => expandedNodesRef.current.add(n));

        // Read ?node= from URL on initial load
        const nodeParam = searchParams.get("node");
        if (nodeParam) {
          setFocusedSubset(nodeParam);
          setSelectedNodeId(nodeParam);
        } else {
          setFocusedSubset(seedNames[0]);
        }
      } catch (e) {
        if (!cancelled) {
          setGraphError(e instanceof Error ? e.message : "Failed to load business objects");
        }
      } finally {
        if (!cancelled) setGraphLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search
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
      // Instant local pre-filter while waiting for Supabase
      const localIds = Object.values(nodesById)
        .filter((n) => n.name.toLowerCase().includes(q.toLowerCase()) || n.id.toLowerCase().includes(q.toLowerCase()))
        .map((n) => n.id);
      if (localIds.length > 0) setSearchMatchIds(localIds);

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
          setSearchError(e instanceof Error ? e.message : "Search failed");
          setSearchMatchIds([]);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const expandAroundNode = useCallback(async (nodeId: string) => {
    expandedNodesRef.current.add(nodeId);
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
      setGraphError(e instanceof Error ? e.message : "Failed to expand graph");
    }
  }, []);

  // Called by GraphCanvas every ~90 frames with currently visible node IDs.
  // Batch-fetches edges for stub nodes that haven't been expanded yet.
  const handleNodesEnterViewport = useCallback(
    (ids: string[]) => {
      const toExpand = ids.filter((id) => {
        const node = nodesById[id];
        return node?.isStub && !expandedNodesRef.current.has(id);
      });
      if (toExpand.length === 0) return;
      // Mark immediately so concurrent calls don't double-fetch
      toExpand.forEach((id) => expandedNodesRef.current.add(id));
      // Batch: fetch edges for up to 6 stubs at once
      const batch = toExpand.slice(0, 6);
      getBusinessObjectEdgesTouching(batch)
        .then((edgeRows) => {
          setEdges((prev) => {
            const next = mergeTouchingEdges(prev, edgeRows);
            setNodesById((p) => ensureStubsForEdges(p, next));
            return next;
          });
        })
        .catch(console.error);
    },
    [nodesById]
  );

  const allNodes = useMemo(() => Object.values(nodesById), [nodesById]);

  const { visibleNodes, visibleEdges } = useMemo(() => {
    const nodes = allNodes;
    const nodeMap = nodesById;
    const q = debouncedSearch.trim();

    if (q) {
      if (searchMatchIds === null) {
        // While searching: show local filter as instant feedback
        const localMatches = new Set(
          nodes
            .filter((n) =>
              n.name.toLowerCase().includes(q.toLowerCase()) ||
              n.id.toLowerCase().includes(q.toLowerCase())
            )
            .map((n) => n.id)
        );
        for (const id of Array.from(localMatches)) {
          for (const nbr of getConnectedNodeIds(edges, id)) localMatches.add(nbr);
        }
        const vNodes = Array.from(localMatches).map((id) => nodeMap[id]).filter(Boolean) as BusinessObjectNode[];
        const idSet = new Set(vNodes.map((n) => n.id));
        return {
          visibleNodes: vNodes,
          visibleEdges: edges.filter((e) => idSet.has(e.source) && idSet.has(e.target)),
        };
      }
      const matchedIds = new Set(searchMatchIds);
      for (const id of searchMatchIds) {
        for (const nbr of getConnectedNodeIds(edges, id)) matchedIds.add(nbr);
      }
      const vNodes = Array.from(matchedIds).map((id) => nodeMap[id]).filter(Boolean) as BusinessObjectNode[];
      const nodeIdSet = new Set(vNodes.map((n) => n.id));
      return {
        visibleNodes: vNodes,
        visibleEdges: edges.filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)),
      };
    }

    if (focusedSubset) {
      const connectedIds = getConnectedNodeIds(edges, focusedSubset);
      const allIds = new Set([focusedSubset, ...connectedIds]);
      const vNodes = nodes.filter((n) => allIds.has(n.id));
      const nodeIdSet = new Set(vNodes.map((n) => n.id));
      return {
        visibleNodes: vNodes,
        visibleEdges: edges.filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)),
      };
    }

    return { visibleNodes: nodes, visibleEdges: edges };
  }, [allNodes, nodesById, edges, debouncedSearch, searchMatchIds, focusedSubset]);

  // Load fields when node selected
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
      .then((rows) => { if (!cancelled) setPanelFields(rows.map(fieldRowToField)); })
      .catch((e) => {
        if (!cancelled) {
          setFieldsError(e instanceof Error ? e.message : "Failed to load fields");
          setPanelFields([]);
        }
      })
      .finally(() => { if (!cancelled) setFieldsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedNodeId]);

  // Sync selected node to URL
  useEffect(() => {
    if (selectedNodeId) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("node", selectedNodeId);
        return next;
      }, { replace: true });
    }
  }, [selectedNodeId, setSearchParams]);

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

  const handlePathFound = useCallback(
    (pathIds: string[]) => {
      setHighlightPath(pathIds);
      setFocusedSubset(null);
      setSearchQuery("");
      setDebouncedSearch("");
      setSearchMatchIds(null);
      pathIds.forEach((id) => {
        if (!nodesById[id]) void expandAroundNode(id);
      });
    },
    [nodesById, expandAroundNode]
  );

  const handlePanelModeChange = useCallback((mode: PanelMode) => {
    setPanelMode(mode);
    if (mode === "explorer") setHighlightPath(undefined);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) setFocusedSubset(null);
  };

  const handleExportCSV = useCallback(() => {
    const header = "Name,ID,Category,Description";
    const rows = visibleNodes.map((n) =>
      `"${n.name.replace(/"/g, '""')}","${n.id.replace(/"/g, '""')}","${n.category.replace(/"/g, '""')}","${n.description.replace(/"/g, '""')}"`
    );
    const edgeHeader = "\n\nSource,Target,Relationship";
    const edgeRows = visibleEdges.map((e) =>
      `"${e.source.replace(/"/g, '""')}","${e.target.replace(/"/g, '""')}","${e.relationship.replace(/"/g, '""')}"`
    );
    const csv = [header, ...rows, edgeHeader, ...edgeRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workday-navigator.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [visibleNodes, visibleEdges]);

  const handleToggleBookmark = useCallback(() => {
    if (!selectedNodeId) return;
    const node = resolveNode(selectedNodeId);
    if (isBookmarked(selectedNodeId)) {
      removeBookmark(selectedNodeId);
    } else {
      addBookmark({ id: selectedNodeId, name: node.name });
    }
  }, [selectedNodeId, resolveNode, isBookmarked, addBookmark, removeBookmark]);

  const selectedNode = selectedNodeId ? resolveNode(selectedNodeId) : null;
  const connectedForSelected = selectedNodeId ? getConnectedNodeIds(edges, selectedNodeId) : [];

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
        isDark={isDark}
        onToggleTheme={() => setTheme(isDark ? "light" : "dark")}
        onExportPNG={() => graphCanvasRef.current?.exportPNG()}
        onExportCSV={handleExportCSV}
        bookmarks={bookmarks}
        isCurrentNodeBookmarked={selectedNodeId ? isBookmarked(selectedNodeId) : false}
        onToggleBookmark={handleToggleBookmark}
        onSelectBookmark={handleSelectNode}
        onRemoveBookmark={removeBookmark}
        onOpenFieldSearch={() => setFieldSearchOpen(true)}
      />

      <PanelGroup direction="horizontal" className="flex-1 min-h-0">
        <Panel defaultSize={70} minSize={30}>
          <div className="h-full p-3 relative">
            <GraphCanvas
              ref={graphCanvasRef}
              nodes={visibleNodes}
              edges={visibleEdges}
              selectedNodeId={selectedNodeId}
              onSelectNode={handleSelectNode}
              isLoading={graphLoading}
              highlightPath={highlightPath}
              isDark={isDark}
              onNodesEnterViewport={handleNodesEnterViewport}
            />
          </div>
        </Panel>

        <PanelResizeHandle className="relative flex items-center justify-center w-1.5 bg-border hover:bg-primary/40 transition-colors group">
          <button
            onClick={() => {
              if (panelCollapsed) {
                sidePanelRef.current?.expand();
              } else {
                sidePanelRef.current?.collapse();
              }
            }}
            className="absolute z-10 flex items-center justify-center w-5 h-10 rounded-full bg-card border border-border shadow-sm text-muted-foreground hover:text-primary hover:border-primary transition-all opacity-0 group-hover:opacity-100"
          >
            {panelCollapsed
              ? <ChevronLeft className="w-3 h-3" />
              : <ChevronRight className="w-3 h-3" />
            }
          </button>
        </PanelResizeHandle>

        <Panel
          ref={sidePanelRef}
          defaultSize={30}
          minSize={15}
          maxSize={60}
          collapsible
          collapsedSize={0}
          onCollapse={() => setPanelCollapsed(true)}
          onExpand={() => setPanelCollapsed(false)}
          className="border-l border-border bg-card overflow-y-auto"
        >
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
        </Panel>
      </PanelGroup>

      <FieldSearchDialog
        open={fieldSearchOpen}
        onClose={() => setFieldSearchOpen(false)}
        onSelectObject={handleSelectNode}
      />
    </div>
  );
}

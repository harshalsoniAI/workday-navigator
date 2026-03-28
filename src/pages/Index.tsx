import { useState, useMemo } from "react";
import GraphCanvas from "@/components/GraphCanvas";
import DetailPanel from "@/components/DetailPanel";
import AppHeader from "@/components/AppHeader";
import {
  nodes,
  edges,
  getConnectedNodeIds,
  getNodeById,
} from "@/data/mockData";

export default function Index() {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedSubset, setFocusedSubset] = useState<string | null>("worker");

  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matched = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
      );
      const matchedIds = new Set(matched.map((n) => n.id));
      matched.forEach((n) =>
        getConnectedNodeIds(n.id).forEach((id) => matchedIds.add(id))
      );
      const vNodes = nodes.filter((n) => matchedIds.has(n.id));
      const nodeIdSet = new Set(vNodes.map((n) => n.id));
      const vEdges = edges.filter(
        (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
      );
      return { visibleNodes: vNodes, visibleEdges: vEdges };
    }

    if (focusedSubset) {
      const connectedIds = getConnectedNodeIds(focusedSubset);
      const allIds = new Set([focusedSubset, ...connectedIds]);
      const vNodes = nodes.filter((n) => allIds.has(n.id));
      const nodeIdSet = new Set(vNodes.map((n) => n.id));
      const vEdges = edges.filter(
        (e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target)
      );
      return { visibleNodes: vNodes, visibleEdges: vEdges };
    }

    return { visibleNodes: nodes, visibleEdges: edges };
  }, [searchQuery, focusedSubset]);

  const handleSelectNode = (id: string) => {
    setSelectedNodeId(id);
    setFocusedSubset(id);
    setSearchQuery("");
  };

  const handleShowAll = () => {
    setFocusedSubset(null);
    setSearchQuery("");
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) setFocusedSubset(null);
  };

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) ?? null : null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <AppHeader
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onShowAll={handleShowAll}
        nodeCount={visibleNodes.length}
      />

      <div className="flex-1 flex min-h-0">
        {/* Graph Canvas */}
        <div className="flex-1 p-3">
          <GraphCanvas
            nodes={visibleNodes}
            edges={visibleEdges}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
          />
        </div>

        {/* Detail Panel */}
        <div className="w-[380px] border-l border-border bg-card shrink-0 overflow-hidden">
          <DetailPanel node={selectedNode} onSelectNode={handleSelectNode} />
        </div>
      </div>
    </div>
  );
}

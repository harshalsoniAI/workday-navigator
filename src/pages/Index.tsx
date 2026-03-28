import { useState, useMemo } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import GraphCanvas from "@/components/GraphCanvas";
import DetailPanel from "@/components/DetailPanel";
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

  // Determine which nodes/edges to display
  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matched = nodes.filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q)
      );
      const matchedIds = new Set(matched.map((n) => n.id));
      // Also include directly connected
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

  const selectedNode = selectedNodeId ? getNodeById(selectedNodeId) ?? null : null;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border bg-card flex items-center px-5 gap-4 shrink-0">
        <h1 className="text-sm font-semibold text-foreground whitespace-nowrap tracking-tight">
          Workday Business Object Explorer
        </h1>
        <div className="flex-1 max-w-md relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search Business Objects..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.trim()) setFocusedSubset(null);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={handleShowAll} className="text-xs text-muted-foreground">
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
          Show All
        </Button>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Graph */}
        <div className="flex-1 p-3">
          <GraphCanvas
            nodes={visibleNodes}
            edges={visibleEdges}
            selectedNodeId={selectedNodeId}
            onSelectNode={handleSelectNode}
          />
        </div>

        {/* Detail panel */}
        <div className="w-[380px] border-l border-border bg-card shrink-0 overflow-hidden">
          <DetailPanel node={selectedNode} onSelectNode={handleSelectNode} />
        </div>
      </div>
    </div>
  );
}

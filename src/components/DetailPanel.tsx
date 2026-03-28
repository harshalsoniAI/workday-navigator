import { useState } from "react";
import { Search, Database, Link2, Tag, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BusinessObjectNode,
  BusinessObjectField,
  getConnectedNodeIds,
  getFieldsForObject,
  getNodeById,
} from "@/data/mockData";

interface DetailPanelProps {
  node: BusinessObjectNode | null;
  onSelectNode: (id: string) => void;
}

export default function DetailPanel({ node, onSelectNode }: DetailPanelProps) {
  const [fieldSearch, setFieldSearch] = useState("");

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center">
        <div>
          <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a Business Object on the graph to explore its details.</p>
        </div>
      </div>
    );
  }

  const fields = getFieldsForObject(node.id);
  const connectedIds = getConnectedNodeIds(node.id);
  const categories = [...new Set(fields.map((f) => f.category))];
  const filteredFields = fields.filter((f) =>
    f.name.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">{node.name}</h2>
        <p className="text-sm text-muted-foreground mt-1">{node.description}</p>
        <Badge variant="secondary" className="mt-2">{node.category}</Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-5 border-b border-border">
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{fields.length}</p>
          <p className="text-xs text-muted-foreground">Fields</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{connectedIds.length}</p>
          <p className="text-xs text-muted-foreground">Connected</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-foreground">{categories.length}</p>
          <p className="text-xs text-muted-foreground">Categories</p>
        </div>
      </div>

      {/* Connected Objects */}
      <div className="p-5 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5" /> Connected Objects
        </h3>
        <div className="flex flex-wrap gap-2">
          {connectedIds.map((id) => {
            const connected = getNodeById(id);
            if (!connected) return null;
            return (
              <button
                key={id}
                onClick={() => onSelectNode(id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {connected.name}
                <ArrowRight className="w-3 h-3" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Field search */}
      <div className="p-5 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search fields..."
            value={fieldSearch}
            onChange={(e) => setFieldSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Fields list */}
      <ScrollArea className="flex-1 px-5 pb-5">
        <div className="space-y-2">
          {filteredFields.map((field) => (
            <FieldRow key={field.id} field={field} onSelectNode={onSelectNode} />
          ))}
          {filteredFields.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No fields match your search.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function FieldRow({ field, onSelectNode }: { field: BusinessObjectField; onSelectNode: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground">{field.name}</span>
        <Badge variant="outline" className="text-[10px] shrink-0">{field.report_field_type}</Badge>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Tag className="w-3 h-3" /> {field.category}
        </span>
        {field.related_business_object && (
          <button
            onClick={() => onSelectNode(field.related_business_object!)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <ArrowRight className="w-3 h-3" />
            {getNodeById(field.related_business_object)?.name}
          </button>
        )}
      </div>
    </div>
  );
}

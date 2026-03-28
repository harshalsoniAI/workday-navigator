import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Database, Link2, Tag, ArrowRight, Layers, Hash, Network } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  isLoading?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

function StatCard({ value, label, icon: Icon }: { value: number; label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg bg-secondary/60 p-3">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
    </div>
  );
}

function FieldCard({
  field,
  onSelectNode,
}: {
  field: BusinessObjectField;
  onSelectNode: (id: string) => void;
}) {
  const relatedNode = field.related_business_object
    ? getNodeById(field.related_business_object)
    : null;

  return (
    <motion.div
      variants={itemVariants}
      className="rounded-lg border border-border bg-card p-3 text-sm hover:border-primary/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-foreground leading-tight">{field.name}</span>
        <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
          {field.report_field_type}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Tag className="w-3 h-3" /> {field.category}
        </span>
        {relatedNode && (
          <button
            onClick={() => onSelectNode(field.related_business_object!)}
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
          >
            <ArrowRight className="w-3 h-3" />
            {relatedNode.name}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center p-8 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
          <Database className="w-6 h-6 text-accent-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No Object Selected</p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[200px]">
          Click a node on the graph to explore its fields and relationships.
        </p>
      </motion.div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-5 space-y-4">
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <div className="grid grid-cols-3 gap-3 pt-2">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-1/3 mt-4" />
      <div className="space-y-2">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
    </div>
  );
}

export default function DetailPanel({ node, onSelectNode, isLoading }: DetailPanelProps) {
  const [fieldSearch, setFieldSearch] = useState("");

  if (isLoading) return <LoadingState />;
  if (!node) return <EmptyState />;

  const fields = getFieldsForObject(node.id);
  const connectedIds = getConnectedNodeIds(node.id);
  const categories = [...new Set(fields.map((f) => f.category))];
  const filteredFields = fields.filter((f) =>
    f.name.toLowerCase().includes(fieldSearch.toLowerCase())
  );

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={node.id}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.2 }}
        className="h-full flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground leading-tight">{node.name}</h2>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{node.description}</p>
              <span className="inline-block mt-2 rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground uppercase tracking-wider">
                {node.category}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 p-5 border-b border-border">
          <StatCard value={fields.length} label="Fields" icon={Hash} />
          <StatCard value={connectedIds.length} label="Connected" icon={Network} />
          <StatCard value={categories.length} label="Categories" icon={Layers} />
        </div>

        {/* Connected Objects */}
        <div className="p-5 border-b border-border">
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Link2 className="w-3 h-3" /> Connected Objects
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {connectedIds.map((id) => {
              const connected = getNodeById(id);
              if (!connected) return null;
              return (
                <button
                  key={id}
                  onClick={() => onSelectNode(id)}
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:border-primary hover:text-primary transition-all"
                >
                  {connected.name}
                  <ArrowRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
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
              className="pl-9 h-9 text-sm bg-secondary/50 border-transparent focus:border-primary/20"
            />
          </div>
        </div>

        {/* Fields list */}
        <ScrollArea className="flex-1 px-5 pb-5">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-2"
          >
            {filteredFields.map((field) => (
              <FieldCard key={field.id} field={field} onSelectNode={onSelectNode} />
            ))}
            {filteredFields.length === 0 && (
              <div className="text-center py-8">
                <p className="text-xs text-muted-foreground">No fields match your search.</p>
              </div>
            )}
          </motion.div>
        </ScrollArea>
      </motion.div>
    </AnimatePresence>
  );
}

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Search, Loader2, RouteOff, Route,
  ClipboardCopy, Check, ChevronDown, ChevronUp, X, BookOpen
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { findPath } from '@/lib/pathFinder';
import { searchBusinessObjects, getBusinessObjectFields, getBusinessObjectEdgesTouching } from '@/lib/queries';
import { humanizeObjectName, edgeRowToEdge, fieldRowToField } from '@/lib/graphModel';
import type { BusinessObjectNode, BusinessObjectEdge, BusinessObjectField } from '@/types/businessObject';

interface PathFinderPanelProps {
  nodesById: Record<string, BusinessObjectNode>;
  edges: BusinessObjectEdge[];
  onSelectNode: (id: string) => void;
  onPathFound: (pathIds: string[]) => void;
}

// ─── Autocomplete input ───────────────────────────────────────────────────────

function NodeCombobox({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: BusinessObjectNode | null;
  onChange: (node: BusinessObjectNode) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BusinessObjectNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      const q = query.trim();
      if (!q) { setResults([]); return; }
      setLoading(true);
      try {
        const rows = await searchBusinessObjects(q);
        setResults(rows.map(r => ({
          id: r.business_object_name,
          name: humanizeObjectName(r.business_object_name),
          category: String(r.category_count ?? 0),
          description: `${r.field_count} fields`,
        })));
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayValue = value ? value.name : '';

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={open ? query : displayValue}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setQuery(''); setOpen(true); }}
          className="pl-9 h-9 text-sm"
        />
        {value && !open && (
          <button
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { onChange({ id: '', name: '', category: '', description: '' }); setQuery(''); }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (query.trim() || results.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg overflow-hidden"
          >
            {loading ? (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" /> Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">No results</div>
            ) : (
              <ul className="max-h-48 overflow-y-auto">
                {results.map(n => (
                  <li key={n.id}>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                      onMouseDown={e => { e.preventDefault(); onChange(n); setOpen(false); setQuery(''); }}
                    >
                      <span className="font-medium">{n.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{n.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Report Builder step ──────────────────────────────────────────────────────

function ReportStep({
  index,
  nodeId,
  node,
  edges,
  onSelectNode,
  selectedFields,
  onToggleField,
}: {
  index: number;
  nodeId: string;
  node: BusinessObjectNode;
  edges: BusinessObjectEdge[];
  onSelectNode: (id: string) => void;
  selectedFields: Set<string>;
  onToggleField: (fieldId: string, fieldName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<BusinessObjectField[]>([]);
  const [loading, setLoading] = useState(false);
  const [fieldSearch, setFieldSearch] = useState('');

  const loadFields = useCallback(async () => {
    if (fields.length > 0) { setExpanded(e => !e); return; }
    setExpanded(true);
    setLoading(true);
    try {
      const rows = await getBusinessObjectFields(nodeId);
      setFields(rows.map(fieldRowToField));
    } finally {
      setLoading(false);
    }
  }, [nodeId, fields.length]);

  const filtered = fields.filter(f => f.name.toLowerCase().includes(fieldSearch.toLowerCase()));
  const selectedCount = fields.filter(f => selectedFields.has(f.id)).length;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 p-3">
        <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
          {index + 1}
        </span>
        <button
          onClick={() => onSelectNode(nodeId)}
          className="flex-1 text-left text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
        >
          {node.name}
        </button>
        {selectedCount > 0 && (
          <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
            {selectedCount} field{selectedCount !== 1 ? 's' : ''}
          </span>
        )}
        <button onClick={loadFields} className="text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-3 space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input
                  placeholder="Filter fields…"
                  value={fieldSearch}
                  onChange={e => setFieldSearch(e.target.value)}
                  className="pl-7 h-7 text-xs"
                />
              </div>
              {loading ? (
                <div className="space-y-1.5">
                  <Skeleton className="h-7 rounded" />
                  <Skeleton className="h-7 rounded" />
                  <Skeleton className="h-7 rounded" />
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filtered.map(f => (
                    <label key={f.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedFields.has(f.id)}
                        onChange={() => onToggleField(f.id, f.name)}
                        className="accent-primary w-3 h-3"
                      />
                      <span className="text-xs text-foreground flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{f.report_field_type}</span>
                    </label>
                  ))}
                  {filtered.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No fields match</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function PathFinderPanel({
  nodesById,
  edges,
  onSelectNode,
  onPathFound,
}: PathFinderPanelProps) {
  const [fromNode, setFromNode] = useState<BusinessObjectNode | null>(null);
  const [toNode, setToNode] = useState<BusinessObjectNode | null>(null);
  const [pathIds, setPathIds] = useState<string[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Report builder state
  const [selectedFields, setSelectedFields] = useState<Map<string, string>>(new Map()); // fieldId -> fieldName
  const [copied, setCopied] = useState(false);

  const resolveNode = useCallback(
    (id: string): BusinessObjectNode =>
      nodesById[id] ?? { id, name: humanizeObjectName(id), category: '—', description: '' },
    [nodesById]
  );

  const handleFindPath = async () => {
    if (!fromNode?.id || !toNode?.id) return;
    setFinding(true);
    setError(null);
    setPathIds(null);
    setProgress('Starting search…');

    try {
      const result = await findPath(
        fromNode.id,
        toNode.id,
        edges,
        async (nodeIds) => {
          const rows = await getBusinessObjectEdgesTouching(nodeIds);
          return rows.map((r, i) => edgeRowToEdge(r, i));
        },
        6,
        setProgress
      );

      if (result) {
        setPathIds(result);
        onPathFound(result);
      } else {
        setError(`No path found between "${fromNode.name}" and "${toNode.name}" within 6 hops.`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setFinding(false);
      setProgress('');
    }
  };

  const toggleField = (fieldId: string, fieldName: string) => {
    setSelectedFields(prev => {
      const next = new Map(prev);
      if (next.has(fieldId)) next.delete(fieldId);
      else next.set(fieldId, fieldName);
      return next;
    });
  };

  const copyReport = () => {
    if (!pathIds) return;
    const pathNames = pathIds.map(id => resolveNode(id).name).join(' → ');
    const fields = [...selectedFields.values()];
    const text = [
      '=== Workday Report Path ===',
      '',
      `Path: ${pathNames}`,
      '',
      fields.length > 0 ? `Selected Fields (${fields.length}):` : 'No fields selected.',
      ...fields.map(f => `  • ${f}`),
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const pathNodes = pathIds?.map(id => ({ id, node: resolveNode(id) })) ?? [];

  return (
    <div className="h-full flex flex-col">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
            <Route className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Path Finder</h2>
            <p className="text-[10px] text-muted-foreground">Traverse Business Object relationships</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="finder" className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-5 mt-4 grid grid-cols-2 shrink-0">
          <TabsTrigger value="finder" className="text-xs">Find Path</TabsTrigger>
          <TabsTrigger value="report" className="text-xs" disabled={!pathIds}>
            Report Builder {pathIds && `(${pathIds.length} steps)`}
          </TabsTrigger>
        </TabsList>

        {/* ── Find Path tab ── */}
        <TabsContent value="finder" className="flex-1 flex flex-col min-h-0 mt-0">
          <div className="p-5 space-y-3 border-b border-border">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">From</label>
              <NodeCombobox
                placeholder="Starting Business Object…"
                value={fromNode}
                onChange={n => n.id ? setFromNode(n) : setFromNode(null)}
              />
            </div>

            <div className="flex justify-center">
              <ArrowRight className="w-4 h-4 text-muted-foreground" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">To</label>
              <NodeCombobox
                placeholder="Target Business Object…"
                value={toNode}
                onChange={n => n.id ? setToNode(n) : setToNode(null)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleFindPath}
              disabled={!fromNode?.id || !toNode?.id || finding}
            >
              {finding ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{progress || 'Searching…'}</>
              ) : (
                <><Route className="w-4 h-4 mr-2" />Find Path</>
              )}
            </Button>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <RouteOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}
          </div>

          {/* Path result */}
          <ScrollArea className="flex-1 p-5">
            <AnimatePresence mode="wait">
              {pathIds && (
                <motion.div
                  key={pathIds.join('-')}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Path · {pathIds.length} object{pathIds.length !== 1 ? 's' : ''} · {pathIds.length - 1} hop{pathIds.length - 2 !== 0 ? 's' : ''}
                  </p>
                  {pathNodes.map(({ id, node }, i) => (
                    <div key={id}>
                      <motion.button
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        onClick={() => onSelectNode(id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary hover:bg-accent transition-all text-left group"
                      >
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{node.name}</p>
                          <p className="text-[10px] text-muted-foreground">{node.description}</p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </motion.button>
                      {i < pathNodes.length - 1 && (
                        <div className="flex justify-center py-1">
                          <div className="w-px h-3 bg-border" />
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}

              {!pathIds && !finding && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Route className="w-10 h-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">Find a traversal path</p>
                  <p className="text-xs text-muted-foreground max-w-[180px]">
                    Enter two Business Objects above to discover how they connect.
                  </p>
                </div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </TabsContent>

        {/* ── Report Builder tab ── */}
        <TabsContent value="report" className="flex-1 flex flex-col min-h-0 mt-0">
          {pathIds ? (
            <>
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    {resolveNode(pathIds[0]).name} → {resolveNode(pathIds[pathIds.length - 1]).name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={copyReport} className="text-xs h-7 gap-1.5">
                  {copied ? <><Check className="w-3 h-3" /> Copied!</> : <><ClipboardCopy className="w-3 h-3" /> Copy</>}
                </Button>
              </div>

              <ScrollArea className="flex-1 p-5">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Expand each object to select report fields
                  </p>
                  {pathNodes.map(({ id, node }, i) => (
                    <ReportStep
                      key={id}
                      index={i}
                      nodeId={id}
                      node={node}
                      edges={edges}
                      onSelectNode={onSelectNode}
                      selectedFields={selectedFields}
                      onToggleField={toggleField}
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div>
                <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground mb-1">No path yet</p>
                <p className="text-xs text-muted-foreground">Find a path first to start building your report.</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

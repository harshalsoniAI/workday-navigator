import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowRight, Tag, Layers, Loader2 } from "lucide-react";
import { searchFields, type FieldSearchRow } from "@/lib/queries";

interface FieldSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onSelectObject: (objectId: string) => void;
}

export default function FieldSearchDialog({ open, onClose, onSelectObject }: FieldSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FieldSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setError(null);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await searchFields(q);
        if (!cancelled) setResults(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const handleSelect = (row: FieldSearchRow) => {
    onSelectObject(row.business_object_name);
    onClose();
  };

  const firstCategory = (cat: string | null) =>
    cat ? cat.split(/\n+/)[0].trim() : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-0">
          <DialogTitle className="text-sm font-semibold flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Global Field Search
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pt-3 pb-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
            )}
            <Input
              ref={inputRef}
              placeholder="Type a field name (e.g. 'Employee ID', 'Cost Center')…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9 h-10 text-sm"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 mb-2">
            Searches field names across all Workday Business Objects. Click a result to navigate to its parent object.
          </p>
        </div>

        <div className="mx-4 mb-0 border-t border-border" />

        <ScrollArea className="h-72">
          {error && (
            <p className="px-5 py-4 text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted-foreground text-center">
              No fields match &ldquo;{query}&rdquo;
            </p>
          )}

          {!loading && !error && query.trim().length < 2 && (
            <p className="px-5 py-6 text-xs text-muted-foreground text-center">
              Type at least 2 characters to begin
            </p>
          )}

          {results.length > 0 && (
            <ul>
              {results.map((row, i) => {
                const cat = firstCategory(row.category);
                return (
                  <li key={`${row.business_object_name}:${row.field}:${i}`}>
                    <button
                      onClick={() => handleSelect(row)}
                      className="w-full flex items-center gap-4 px-5 py-3 hover:bg-accent/50 transition-colors text-left border-b border-border last:border-0"
                    >
                      {/* Left: field info */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate leading-tight">
                          {row.field}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {row.report_field_type && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                              {row.report_field_type}
                            </span>
                          )}
                          {cat && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" />
                              {cat}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: parent object */}
                      <div className="shrink-0 flex items-center gap-1 text-xs text-primary font-medium max-w-[40%]">
                        <Layers className="w-3 h-3 shrink-0" />
                        <span className="truncate">{row.business_object_name}</span>
                        <ArrowRight className="w-3 h-3 shrink-0" />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        {results.length > 0 && (
          <div className="px-5 py-2 border-t border-border bg-secondary/30">
            <p className="text-[10px] text-muted-foreground">
              {results.length} result{results.length !== 1 ? "s" : ""} — click any row to open that Business Object
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

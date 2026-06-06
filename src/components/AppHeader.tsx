import { Search, Route, Maximize2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type PanelMode = "explorer" | "pathfinder";

interface AppHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onShowAll: () => void;
  nodeCount: number;
  searchLoading?: boolean;
  panelMode: PanelMode;
  onPanelModeChange: (mode: PanelMode) => void;
  onFitToScreen: () => void;
}

export default function AppHeader({
  searchQuery,
  onSearchChange,
  onShowAll,
  nodeCount,
  searchLoading = false,
  panelMode,
  onPanelModeChange,
  onFitToScreen,
}: AppHeaderProps) {
  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-5 gap-4 shrink-0">
      <div className="flex items-center gap-2.5 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="3" r="2" fill="white" opacity="0.9" />
            <circle cx="11" cy="3" r="2" fill="white" opacity="0.7" />
            <circle cx="7" cy="11" r="2" fill="white" opacity="0.9" />
            <line x1="3" y1="3" x2="11" y2="3" stroke="white" strokeWidth="1" opacity="0.5" />
            <line x1="3" y1="3" x2="7" y2="11" stroke="white" strokeWidth="1" opacity="0.5" />
            <line x1="11" y1="3" x2="7" y2="11" stroke="white" strokeWidth="1" opacity="0.5" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground tracking-tight leading-none">
            Business Object Explorer
          </h1>
          <p className="text-[10px] text-muted-foreground mt-0.5">Workday</p>
        </div>
      </div>

      <div className="flex-1 max-w-md relative ml-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search Business Objects..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={searchLoading || panelMode === "pathfinder"}
          className="pl-9 h-9 text-sm bg-secondary/50 border-transparent focus:border-primary/20 disabled:opacity-60"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {nodeCount} object{nodeCount !== 1 ? "s" : ""}
        </span>
        <button
          onClick={onShowAll}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Show All
        </button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Fit to screen */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onFitToScreen}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Fit to screen</TooltipContent>
        </Tooltip>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => onPanelModeChange("explorer")}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              panelMode === "explorer"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            Explorer
          </button>
          <button
            onClick={() => onPanelModeChange("pathfinder")}
            className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
              panelMode === "pathfinder"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Route className="w-3 h-3" />
            Path Finder
          </button>
        </div>
      </div>
    </header>
  );
}

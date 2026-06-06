import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type {
  BusinessObjectEdge,
  BusinessObjectNode,
} from "@/types/businessObject";
import { getPathEdgeKeys } from "@/lib/pathFinder";

export interface GraphCanvasHandle {
  fitToScreen(): void;
  exportPNG(): void;
}

interface GraphCanvasProps {
  nodes: BusinessObjectNode[];
  edges: BusinessObjectEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  isLoading?: boolean;
  highlightPath?: string[];
  isDark?: boolean;
  /** Called periodically with IDs of layout nodes currently inside the viewport. */
  onNodesEnterViewport?: (ids: string[]) => void;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetRadius: number;
  currentRadius: number;
  node: BusinessObjectNode;
}

interface MinimapState {
  x: number; y: number; w: number; h: number;
  mmScale: number; mmOffX: number; mmOffY: number;
}

const CATEGORY_COLORS: Record<string, { fill: string; stroke: string }> = {
  HCM: { fill: "hsl(234, 89%, 96%)", stroke: "hsl(234, 89%, 60%)" },
  Payroll: { fill: "hsl(160, 70%, 95%)", stroke: "hsl(160, 70%, 42%)" },
  Benefits: { fill: "hsl(280, 65%, 95%)", stroke: "hsl(280, 65%, 55%)" },
  Finance: { fill: "hsl(35, 90%, 95%)", stroke: "hsl(35, 90%, 50%)" },
  "Time Tracking": { fill: "hsl(190, 70%, 94%)", stroke: "hsl(190, 70%, 45%)" },
};

const DARK_CATEGORY_COLORS: Record<string, { fill: string; stroke: string }> = {
  HCM: { fill: "hsl(234, 60%, 20%)", stroke: "hsl(234, 89%, 65%)" },
  Payroll: { fill: "hsl(160, 50%, 18%)", stroke: "hsl(160, 70%, 48%)" },
  Benefits: { fill: "hsl(280, 45%, 20%)", stroke: "hsl(280, 65%, 62%)" },
  Finance: { fill: "hsl(35, 60%, 18%)", stroke: "hsl(35, 90%, 56%)" },
  "Time Tracking": { fill: "hsl(190, 50%, 18%)", stroke: "hsl(190, 70%, 52%)" },
};

function getCategoryColors(category: string, isDark: boolean) {
  const map = isDark ? DARK_CATEGORY_COLORS : CATEGORY_COLORS;
  return map[category] || (isDark ? DARK_CATEGORY_COLORS.HCM : CATEGORY_COLORS.HCM);
}

const BASE_RADIUS = 50;
const SELECTED_RADIUS = 58;
const MM_W = 148, MM_H = 96, MM_PAD = 12;
// Physics is considered settled below this kinetic-energy threshold
const ENERGY_IDLE_THRESHOLD = 0.05;
// Check viewport for lazy expansion every N rAF ticks
const VIEWPORT_CHECK_INTERVAL = 90;

const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  isLoading,
  highlightPath,
  isDark = false,
  onNodesEnterViewport,
}, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<LayoutNode[]>([]);
  const animRef = useRef<number>(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const sizeRef = useRef({ w: 800, h: 600 });
  const hoveredRef = useRef<string | null>(null);
  const minimapRef = useRef<MinimapState | null>(null);
  const lastPinchDistRef = useRef<number | null>(null);

  // Idle render pause
  const energyRef = useRef(Infinity);
  const needsRedrawRef = useRef(true);

  // Lazy viewport expansion
  const viewportTickRef = useRef(0);
  const onNodesEnterViewportRef = useRef(onNodesEnterViewport);
  useEffect(() => { onNodesEnterViewportRef.current = onNodesEnterViewport; }, [onNodesEnterViewport]);

  const setDraggingBoth = useCallback((id: string | null) => {
    draggingRef.current = id;
    setDragging(id);
  }, []);

  const markDirty = useCallback(() => { needsRedrawRef.current = true; }, []);

  useImperativeHandle(ref, () => ({
    fitToScreen() {
      const layout = layoutRef.current;
      if (!layout.length) return;
      const xs = layout.map((n) => n.x);
      const ys = layout.map((n) => n.y);
      const pad = 80;
      const minX = Math.min(...xs) - pad;
      const maxX = Math.max(...xs) + pad;
      const minY = Math.min(...ys) - pad;
      const maxY = Math.max(...ys) + pad;
      const { w, h } = sizeRef.current;
      const scaleX = w / (maxX - minX);
      const scaleY = h / (maxY - minY);
      const newScale = Math.min(scaleX, scaleY, 2) * 0.9;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      scaleRef.current = newScale;
      panRef.current = { x: w / 2 - cx * newScale, y: h / 2 - cy * newScale };
      needsRedrawRef.current = true;
    },
    exportPNG() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = "workday-navigator.png";
      a.click();
    },
  }));

  useEffect(() => {
    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h / 2;
    const existing = new Map(layoutRef.current.map((n) => [n.id, n]));

    layoutRef.current = nodes.map((node, i) => {
      const prev = existing.get(node.id);
      if (prev) {
        prev.node = node;
        return prev;
      }
      const angle = (2 * Math.PI * i) / nodes.length;
      const r = Math.min(cx, cy) * 0.5;
      return {
        id: node.id,
        x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
        targetRadius: BASE_RADIUS,
        currentRadius: BASE_RADIUS,
        node,
      };
    });
    panRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
    energyRef.current = Infinity; // kick physics on node change
    needsRedrawRef.current = true;
  }, [nodes]);

  // ResizeObserver: redraw when canvas element is resized
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => { needsRedrawRef.current = true; });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const getLayoutNode = useCallback(
    (id: string) => layoutRef.current.find((n) => n.id === id),
    []
  );

  /**
   * Cheap O(n) radius animation — always runs, independent of physics.
   * Returns max absolute delta so the loop knows if animation is still in progress.
   */
  const animateRadii = useCallback((): number => {
    let maxDelta = 0;
    layoutRef.current.forEach((n) => {
      n.targetRadius =
        n.id === selectedNodeId
          ? SELECTED_RADIUS
          : n.id === hoveredRef.current
          ? BASE_RADIUS + 4
          : BASE_RADIUS;
      const diff = n.targetRadius - n.currentRadius;
      const absDiff = Math.abs(diff);
      if (absDiff > 0.05) {
        n.currentRadius += diff * 0.15;
        if (absDiff > maxDelta) maxDelta = absDiff;
      } else {
        n.currentRadius = n.targetRadius;
      }
    });
    return maxDelta;
  }, [selectedNodeId]);

  /**
   * O(n²) physics simulation — only called when not settled.
   * Returns kinetic energy of the system.
   */
  const simulatePhysics = useCallback((): number => {
    const layout = layoutRef.current;
    const damping = 0.82;
    const repulsion = 10000;
    const springK = 0.008;
    const springLength = 200;

    layout.forEach((n) => { n.vx *= damping; n.vy *= damping; });

    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i], b = layout[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    edges.forEach((e) => {
      const a = getLayoutNode(e.source);
      const b = getLayoutNode(e.target);
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = springK * (dist - springLength);
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });

    const cx = sizeRef.current.w / 2, cy = sizeRef.current.h / 2;
    layout.forEach((n) => {
      n.vx += (cx - n.x) * 0.003;
      n.vy += (cy - n.y) * 0.003;
    });

    let energy = 0;
    layout.forEach((n) => {
      if (n.id === dragging) return;
      n.x += n.vx;
      n.y += n.vy;
      energy += n.vx * n.vx + n.vy * n.vy;
    });
    return energy;
  }, [edges, getLayoutNode, dragging]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    sizeRef.current = { w, h };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pathNodeSet = new Set(highlightPath ?? []);
    const pathEdgeKeys = highlightPath ? getPathEdgeKeys(highlightPath) : new Set<string>();
    const hasPath = pathNodeSet.size > 0;

    const canvasBg = isDark ? "hsl(224, 30%, 8%)" : "hsl(220, 20%, 98.5%)";
    const gridColor = isDark ? "hsl(224, 20%, 18%)" : "hsl(220, 14%, 90%)";
    const nodeUnselectedFill = isDark ? "hsl(224, 25%, 15%)" : "#ffffff";
    const nodeTextColor = isDark ? "hsl(220, 20%, 90%)" : "hsl(224, 30%, 18%)";
    const edgeBaseColor = isDark ? "hsl(220, 20%, 25%)" : "hsl(220, 14%, 87%)";
    const edgeHighlightColor = "hsl(234, 89%, 70%)";
    const pathEdgeColor = "hsl(35, 90%, 52%)";
    const labelTextPathColor = "hsl(35, 80%, 40%)";
    const labelTextHighlightColor = "hsl(234, 60%, 55%)";
    const nodeBorderUnselected = isDark ? "hsl(224, 20%, 30%)" : "hsl(220, 16%, 88%)";
    const loadingTextColor = isDark ? "hsl(220, 10%, 50%)" : "hsl(220, 10%, 60%)";

    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(scaleRef.current, scaleRef.current);

    const gridSize = 40;
    const startX = Math.floor(-panRef.current.x / scaleRef.current / gridSize) * gridSize - gridSize;
    const startY = Math.floor(-panRef.current.y / scaleRef.current / gridSize) * gridSize - gridSize;
    const endX = startX + w / scaleRef.current + gridSize * 2;
    const endY = startY + h / scaleRef.current + gridSize * 2;

    ctx.fillStyle = gridColor;
    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    if (isLoading) {
      ctx.restore();
      ctx.font = "500 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = loadingTextColor;
      ctx.fillText("Loading Business Objects...", w / 2, h / 2);
      return;
    }

    const layout = layoutRef.current;

    if (layout.length === 0) {
      ctx.restore();
      ctx.font = "500 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = loadingTextColor;
      ctx.fillText("No Business Objects found. Try a different search.", w / 2, h / 2);
      return;
    }

    // Edges
    edges.forEach((e) => {
      const a = getLayoutNode(e.source);
      const b = getLayoutNode(e.target);
      if (!a || !b) return;

      const isOnPath = pathEdgeKeys.has(`${e.source}|${e.target}`);
      const isHighlighted =
        !hasPath && selectedNodeId &&
        (e.source === selectedNodeId || e.target === selectedNodeId);
      const dimEdge =
        (hasPath && !isOnPath) ||
        (!hasPath && selectedNodeId && !isHighlighted);

      ctx.save();
      if (dimEdge) ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);

      if (isOnPath) {
        ctx.strokeStyle = pathEdgeColor; ctx.lineWidth = 3;
      } else if (isHighlighted) {
        ctx.strokeStyle = edgeHighlightColor; ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = edgeBaseColor; ctx.lineWidth = 1;
      }
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.restore();

      if (isHighlighted || isOnPath) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        ctx.font = "500 9px Inter, sans-serif";
        ctx.textAlign = "center";
        const labelColor = isOnPath ? labelTextPathColor : labelTextHighlightColor;
        const textWidth = ctx.measureText(e.relationship).width;
        ctx.fillStyle = canvasBg;
        ctx.fillRect(mx - textWidth / 2 - 4, my - 7, textWidth + 8, 14);
        ctx.fillStyle = labelColor;
        ctx.fillText(e.relationship, mx, my + 3);
      }
    });

    // Nodes
    const sortedLayout = [...layout].sort((a, b) => {
      if (a.id === selectedNodeId) return 1;
      if (b.id === selectedNodeId) return -1;
      return 0;
    });

    sortedLayout.forEach((n) => {
      const isSelected = n.id === selectedNodeId;
      const isHovered = n.id === hoveredRef.current;
      const isConnected =
        selectedNodeId &&
        edges.some(
          (e) =>
            (e.source === selectedNodeId && e.target === n.id) ||
            (e.target === selectedNodeId && e.source === n.id)
        );
      const colors = getCategoryColors(n.node.category, isDark);
      const r = n.currentRadius;
      const isOnPath = hasPath && pathNodeSet.has(n.id);
      const dimmed = hasPath
        ? !isOnPath
        : selectedNodeId && !isSelected && !isConnected;

      ctx.save();
      if (dimmed) ctx.globalAlpha = 0.35;

      ctx.shadowColor = isSelected
        ? "hsla(234, 89%, 55%, 0.3)"
        : isHovered
        ? isDark ? "hsla(0, 0%, 0%, 0.3)" : "hsla(0, 0%, 0%, 0.1)"
        : isDark ? "hsla(0, 0%, 0%, 0.2)" : "hsla(0, 0%, 0%, 0.06)";
      ctx.shadowBlur = isSelected ? 24 : isHovered ? 16 : 10;
      ctx.shadowOffsetY = isSelected ? 6 : 3;

      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? colors.stroke : nodeUnselectedFill;
      ctx.fill();

      ctx.shadowColor = "transparent";
      ctx.strokeStyle = isSelected ? colors.stroke : isHovered ? colors.stroke : nodeBorderUnselected;
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2 : 1.5;
      ctx.stroke();

      if (!isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, r - 3, -Math.PI * 0.5, -Math.PI * 0.5 + Math.PI * 0.3);
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.lineCap = "butt";
      }

      ctx.restore();

      ctx.save();
      if (dimmed) ctx.globalAlpha = 0.35;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.font = `600 ${isSelected ? 12 : 11}px Inter, sans-serif`;
      ctx.fillStyle = isSelected ? "#ffffff" : nodeTextColor;
      const words = n.node.name.split(" ");
      if (words.length > 1 && ctx.measureText(n.node.name).width > r * 1.5) {
        ctx.fillText(words[0], n.x, n.y - 7);
        ctx.fillText(words.slice(1).join(" "), n.x, n.y + 7);
      } else {
        ctx.fillText(n.node.name, n.x, n.y - 2);
      }

      ctx.font = `500 8px Inter, sans-serif`;
      ctx.fillStyle = isSelected ? "hsla(0, 0%, 100%, 0.75)" : colors.stroke;
      const catY = words.length > 1 && ctx.measureText(n.node.name).width > r ? n.y + 22 : n.y + 14;
      ctx.fillText(n.node.category, n.x, catY);

      ctx.restore();

      if (hasPath && pathNodeSet.has(n.id) && highlightPath) {
        const stepIdx = highlightPath.indexOf(n.id);
        if (stepIdx !== -1) {
          const bx = n.x + r * 0.72, by = n.y - r * 0.72;
          const br = 9;
          ctx.beginPath();
          ctx.arc(bx, by, br, 0, 2 * Math.PI);
          ctx.fillStyle = pathEdgeColor;
          ctx.fill();
          ctx.font = `700 9px Inter, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(String(stepIdx + 1), bx, by);
          ctx.textBaseline = "alphabetic";
        }
      }
    });

    ctx.restore();

    // Minimap overlay
    if (layout.length > 0) {
      const xs = layout.map((n) => n.x);
      const ys = layout.map((n) => n.y);
      const wMinX = Math.min(...xs) - 60, wMaxX = Math.max(...xs) + 60;
      const wMinY = Math.min(...ys) - 60, wMaxY = Math.max(...ys) + 60;
      const wSpanX = wMaxX - wMinX, wSpanY = wMaxY - wMinY;

      if (wSpanX > 0 && wSpanY > 0) {
        const mmX = w - MM_W - MM_PAD, mmY = h - MM_H - MM_PAD;
        const scaleX = MM_W / wSpanX, scaleY = MM_H / wSpanY;
        const mmScale = Math.min(scaleX, scaleY) * 0.88;
        const mmOffX = mmX + MM_W / 2 - ((wMinX + wMaxX) / 2) * mmScale;
        const mmOffY = mmY + MM_H / 2 - ((wMinY + wMaxY) / 2) * mmScale;

        minimapRef.current = { x: mmX, y: mmY, w: MM_W, h: MM_H, mmScale, mmOffX, mmOffY };

        ctx.save();
        ctx.globalAlpha = 0.93;
        ctx.fillStyle = isDark ? "hsl(224, 25%, 11%)" : "hsl(220, 20%, 96%)";
        ctx.strokeStyle = isDark ? "hsl(224, 20%, 28%)" : "hsl(220, 16%, 84%)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(mmX - 5, mmY - 5, MM_W + 10, MM_H + 10, 7);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.beginPath();
        ctx.rect(mmX, mmY, MM_W, MM_H);
        ctx.clip();

        layout.forEach((n) => {
          const nx = n.x * mmScale + mmOffX, ny = n.y * mmScale + mmOffY;
          ctx.beginPath();
          ctx.arc(nx, ny, n.id === selectedNodeId ? 3.5 : 2, 0, 2 * Math.PI);
          ctx.fillStyle = n.id === selectedNodeId
            ? "hsl(234, 89%, 60%)"
            : isDark ? "hsl(220, 20%, 45%)" : "hsl(220, 14%, 65%)";
          ctx.fill();
        });

        const vpLeft = (-panRef.current.x / scaleRef.current) * mmScale + mmOffX;
        const vpTop = (-panRef.current.y / scaleRef.current) * mmScale + mmOffY;
        const vpRight = ((w - panRef.current.x) / scaleRef.current) * mmScale + mmOffX;
        const vpBottom = ((h - panRef.current.y) / scaleRef.current) * mmScale + mmOffY;

        ctx.strokeStyle = isDark ? "hsla(234, 89%, 65%, 0.75)" : "hsla(234, 89%, 55%, 0.65)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(vpLeft, vpTop, vpRight - vpLeft, vpBottom - vpTop);
        ctx.setLineDash([]);
        ctx.restore();

        ctx.font = `500 9px Inter, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = isDark ? "hsl(220, 12%, 45%)" : "hsl(220, 10%, 60%)";
        ctx.fillText("MAP", mmX + 2, mmY - 7);
      }
    }
  }, [edges, getLayoutNode, selectedNodeId, isLoading, highlightPath, isDark]);

  // Animation loop with idle render pause
  useEffect(() => {
    // Reset energy so physics always restarts when nodes/edges change
    energyRef.current = Infinity;
    needsRedrawRef.current = true;

    let running = true;
    const loop = () => {
      if (!running) return;

      // --- Physics (O(n²): only run while not settled) ---
      const physicsActive =
        energyRef.current > ENERGY_IDLE_THRESHOLD || draggingRef.current !== null;
      if (physicsActive) {
        const energy = simulatePhysics();
        energyRef.current = energy;
      }

      // --- Radius animation (O(n): always run) ---
      const radiusDelta = animateRadii();
      if (radiusDelta > 0.1) needsRedrawRef.current = true;

      // --- Viewport check for lazy expansion ---
      viewportTickRef.current++;
      if (viewportTickRef.current >= VIEWPORT_CHECK_INTERVAL) {
        viewportTickRef.current = 0;
        const cb = onNodesEnterViewportRef.current;
        if (cb) {
          const { w, h } = sizeRef.current;
          const pad = BASE_RADIUS * 2;
          const vLeft = -panRef.current.x / scaleRef.current - pad;
          const vTop = -panRef.current.y / scaleRef.current - pad;
          const vRight = (w - panRef.current.x) / scaleRef.current + pad;
          const vBottom = (h - panRef.current.y) / scaleRef.current + pad;
          const visible = layoutRef.current
            .filter((n) => n.x >= vLeft && n.x <= vRight && n.y >= vTop && n.y <= vBottom)
            .map((n) => n.id);
          if (visible.length > 0) cb(visible);
        }
      }

      // --- Draw (only when something changed) ---
      if (physicsActive || needsRedrawRef.current) {
        draw();
        needsRedrawRef.current = false;
      }

      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [simulatePhysics, animateRadii, draw]);

  const hitTest = useCallback(
    (mx: number, my: number): LayoutNode | null => {
      const s = scaleRef.current;
      const px = (mx - panRef.current.x) / s;
      const py = (my - panRef.current.y) / s;
      for (let i = layoutRef.current.length - 1; i >= 0; i--) {
        const n = layoutRef.current[i];
        const dx = px - n.x, dy = py - n.y;
        if (dx * dx + dy * dy <= n.currentRadius * n.currentRadius) return n;
      }
      return null;
    },
    []
  );

  const isInMinimap = useCallback((mx: number, my: number): boolean => {
    const mm = minimapRef.current;
    if (!mm) return false;
    return mx >= mm.x - 5 && mx <= mm.x + mm.w + 5 && my >= mm.y - 5 && my <= mm.y + mm.h + 5;
  }, []);

  const panToMinimapClick = useCallback((mx: number, my: number) => {
    const mm = minimapRef.current;
    if (!mm) return;
    const worldX = (mx - mm.mmOffX) / mm.mmScale;
    const worldY = (my - mm.mmOffY) / mm.mmScale;
    const { w, h } = sizeRef.current;
    panRef.current = {
      x: w / 2 - worldX * scaleRef.current,
      y: h / 2 - worldY * scaleRef.current,
    };
    needsRedrawRef.current = true;
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      // Node hit takes priority over minimap
      const hit = hitTest(mx, my);
      if (hit) {
        setDraggingBoth(hit.id);
        const s = scaleRef.current;
        dragOffset.current = {
          x: (mx - panRef.current.x) / s - hit.x,
          y: (my - panRef.current.y) / s - hit.y,
        };
        energyRef.current = Infinity; // wake physics for drag interaction
      } else if (isInMinimap(mx, my)) {
        panToMinimapClick(mx, my);
      } else {
        isPanning.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
    },
    [hitTest, isInMinimap, panToMinimapClick, setDraggingBoth]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;

      if (dragging) {
        const s = scaleRef.current;
        const n = getLayoutNode(dragging);
        if (n) {
          n.x = (mx - panRef.current.x) / s - dragOffset.current.x;
          n.y = (my - panRef.current.y) / s - dragOffset.current.y;
          n.vx = 0; n.vy = 0;
        }
        needsRedrawRef.current = true;
      } else if (isPanning.current) {
        panRef.current.x += e.clientX - lastMouse.current.x;
        panRef.current.y += e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
        needsRedrawRef.current = true;
      } else {
        const hit = hitTest(mx, my);
        const newHovered = hit?.id ?? null;
        if (newHovered !== hoveredRef.current) {
          hoveredRef.current = newHovered;
          needsRedrawRef.current = true;
        }
        if (canvasRef.current) {
          canvasRef.current.style.cursor = isInMinimap(mx, my) ? "crosshair" : hit ? "pointer" : "grab";
        }
      }
    },
    [dragging, getLayoutNode, hitTest, isInMinimap]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const hit = hitTest(mx, my);
        if (hit && hit.id === dragging) onSelectNode(hit.id);
        setDraggingBoth(null);
      }
      isPanning.current = false;
    },
    [dragging, hitTest, onSelectNode, setDraggingBoth]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(0.3, Math.min(3, scaleRef.current * delta));
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    panRef.current.x = mx - ((mx - panRef.current.x) / scaleRef.current) * newScale;
    panRef.current.y = my - ((my - panRef.current.y) / scaleRef.current) * newScale;
    scaleRef.current = newScale;
    needsRedrawRef.current = true;
  }, []);

  // Touch support
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
        const hit = hitTest(mx, my);
        if (hit) {
          setDraggingBoth(hit.id);
          const s = scaleRef.current;
          dragOffset.current = {
            x: (mx - panRef.current.x) / s - hit.x,
            y: (my - panRef.current.y) / s - hit.y,
          };
          energyRef.current = Infinity;
        } else if (isInMinimap(mx, my)) {
          panToMinimapClick(mx, my);
        } else {
          isPanning.current = true;
          lastMouse.current = { x: touch.clientX, y: touch.clientY };
        }
      } else if (e.touches.length === 2) {
        setDraggingBoth(null);
        isPanning.current = false;
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
      }
    },
    [hitTest, isInMinimap, panToMinimapClick, setDraggingBoth]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
        const currentDragging = draggingRef.current;
        if (currentDragging) {
          const s = scaleRef.current;
          const n = getLayoutNode(currentDragging);
          if (n) { n.x = (mx - panRef.current.x) / s - dragOffset.current.x; n.y = (my - panRef.current.y) / s - dragOffset.current.y; n.vx = 0; n.vy = 0; }
          needsRedrawRef.current = true;
        } else if (isPanning.current) {
          panRef.current.x += touch.clientX - lastMouse.current.x;
          panRef.current.y += touch.clientY - lastMouse.current.y;
          lastMouse.current = { x: touch.clientX, y: touch.clientY };
          needsRedrawRef.current = true;
        }
      } else if (e.touches.length === 2 && lastPinchDistRef.current != null) {
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        const newDist = Math.sqrt(dx * dx + dy * dy);
        const ratio = newDist / lastPinchDistRef.current;
        const newScale = Math.max(0.3, Math.min(3, scaleRef.current * ratio));
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = midX - rect.left, my = midY - rect.top;
        panRef.current.x = mx - ((mx - panRef.current.x) / scaleRef.current) * newScale;
        panRef.current.y = my - ((my - panRef.current.y) / scaleRef.current) * newScale;
        scaleRef.current = newScale;
        lastPinchDistRef.current = newDist;
        needsRedrawRef.current = true;
      }
    },
    [getLayoutNode]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (e.changedTouches.length > 0 && draggingRef.current) {
        const touch = e.changedTouches[0];
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = touch.clientX - rect.left, my = touch.clientY - rect.top;
        const hit = hitTest(mx, my);
        if (hit && hit.id === draggingRef.current) onSelectNode(hit.id);
      }
      setDraggingBoth(null);
      isPanning.current = false;
      if (e.touches.length < 2) lastPinchDistRef.current = null;
    },
    [hitTest, onSelectNode, setDraggingBoth]
  );

  // markDirty is available on the handle indirectly via fitToScreen,
  // but expose it so parent effects can request a redraw without state churn.
  void markDirty;

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-xl"
      style={{ background: isDark ? "hsl(224, 30%, 8%)" : "hsl(220, 20%, 98.5%)", touchAction: "none" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setDraggingBoth(null);
        isPanning.current = false;
        if (hoveredRef.current !== null) {
          hoveredRef.current = null;
          needsRedrawRef.current = true;
        }
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    />
  );
});

export default GraphCanvas;

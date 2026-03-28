import React, { useCallback, useEffect, useRef, useState } from "react";
import { BusinessObjectNode, BusinessObjectEdge } from "@/data/mockData";

interface GraphCanvasProps {
  nodes: BusinessObjectNode[];
  edges: BusinessObjectEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  isLoading?: boolean;
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

const CATEGORY_COLORS: Record<string, { fill: string; stroke: string }> = {
  HCM: { fill: "hsl(234, 89%, 96%)", stroke: "hsl(234, 89%, 60%)" },
  Payroll: { fill: "hsl(160, 70%, 95%)", stroke: "hsl(160, 70%, 42%)" },
  Benefits: { fill: "hsl(280, 65%, 95%)", stroke: "hsl(280, 65%, 55%)" },
  Finance: { fill: "hsl(35, 90%, 95%)", stroke: "hsl(35, 90%, 50%)" },
  "Time Tracking": { fill: "hsl(190, 70%, 94%)", stroke: "hsl(190, 70%, 45%)" },
};

function getCategoryColors(category: string) {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.HCM;
}

const BASE_RADIUS = 50;
const SELECTED_RADIUS = 58;

export default function GraphCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  isLoading,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<LayoutNode[]>([]);
  const animRef = useRef<number>(0);
  const [dragging, setDragging] = useState<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panRef = useRef({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const sizeRef = useRef({ w: 800, h: 600 });
  const hoveredRef = useRef<string | null>(null);

  // Initialize layout when nodes change
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
        vx: 0,
        vy: 0,
        targetRadius: BASE_RADIUS,
        currentRadius: BASE_RADIUS,
        node,
      };
    });
    // Reset pan on node change
    panRef.current = { x: 0, y: 0 };
    scaleRef.current = 1;
  }, [nodes]);

  const getLayoutNode = useCallback(
    (id: string) => layoutRef.current.find((n) => n.id === id),
    []
  );

  // Force simulation
  const simulate = useCallback(() => {
    const layout = layoutRef.current;
    const damping = 0.82;
    const repulsion = 10000;
    const springK = 0.008;
    const springLength = 200;

    layout.forEach((n) => {
      n.vx *= damping;
      n.vy *= damping;
    });

    // Repulsion
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const a = layout[i],
          b = layout[j];
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force,
          fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Spring
    edges.forEach((e) => {
      const a = getLayoutNode(e.source);
      const b = getLayoutNode(e.target);
      if (!a || !b) return;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = springK * (dist - springLength);
      const fx = (dx / dist) * force,
        fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    });

    // Center gravity
    const cx = sizeRef.current.w / 2,
      cy = sizeRef.current.h / 2;
    layout.forEach((n) => {
      n.vx += (cx - n.x) * 0.003;
      n.vy += (cy - n.y) * 0.003;
    });

    // Update
    layout.forEach((n) => {
      if (n.id === dragging) return;
      n.x += n.vx;
      n.y += n.vy;

      // Animate radius
      n.targetRadius =
        n.id === selectedNodeId
          ? SELECTED_RADIUS
          : n.id === hoveredRef.current
          ? BASE_RADIUS + 4
          : BASE_RADIUS;
      n.currentRadius += (n.targetRadius - n.currentRadius) * 0.15;
    });
  }, [edges, getLayoutNode, dragging, selectedNodeId]);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    sizeRef.current = { w, h };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = "hsl(220, 20%, 98.5%)";
    ctx.fillRect(0, 0, w, h);

    // Grid dots
    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(scaleRef.current, scaleRef.current);

    const gridSize = 40;
    const startX = Math.floor(-panRef.current.x / scaleRef.current / gridSize) * gridSize - gridSize;
    const startY = Math.floor(-panRef.current.y / scaleRef.current / gridSize) * gridSize - gridSize;
    const endX = startX + w / scaleRef.current + gridSize * 2;
    const endY = startY + h / scaleRef.current + gridSize * 2;

    ctx.fillStyle = "hsl(220, 14%, 90%)";
    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    if (isLoading) {
      ctx.restore();
      // Loading indicator
      ctx.font = "500 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "hsl(220, 10%, 60%)";
      ctx.fillText("Loading Business Objects...", w / 2, h / 2);
      return;
    }

    const layout = layoutRef.current;

    if (layout.length === 0) {
      ctx.restore();
      ctx.font = "500 14px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "hsl(220, 10%, 60%)";
      ctx.fillText("No Business Objects found. Try a different search.", w / 2, h / 2);
      return;
    }

    // Edges
    edges.forEach((e) => {
      const a = getLayoutNode(e.source);
      const b = getLayoutNode(e.target);
      if (!a || !b) return;
      const isHighlighted =
        selectedNodeId &&
        (e.source === selectedNodeId || e.target === selectedNodeId);

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHighlighted
        ? "hsl(234, 89%, 70%)"
        : "hsl(220, 14%, 87%)";
      ctx.lineWidth = isHighlighted ? 2.5 : 1;
      ctx.setLineDash(isHighlighted ? [] : []);
      ctx.stroke();

      // Relationship label on highlighted edges
      if (isHighlighted) {
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        ctx.font = "500 9px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "hsl(234, 60%, 55%)";

        // Background for label
        const textWidth = ctx.measureText(e.relationship).width;
        ctx.save();
        ctx.fillStyle = "hsl(220, 20%, 98.5%)";
        ctx.fillRect(mx - textWidth / 2 - 4, my - 7, textWidth + 8, 14);
        ctx.restore();

        ctx.fillStyle = "hsl(234, 60%, 55%)";
        ctx.fillText(e.relationship, mx, my + 3);
      }
    });

    // Nodes (draw unselected first, then selected on top)
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
      const colors = getCategoryColors(n.node.category);
      const r = n.currentRadius;

      // Dim unrelated nodes when something is selected
      const dimmed = selectedNodeId && !isSelected && !isConnected;

      ctx.save();

      if (dimmed) {
        ctx.globalAlpha = 0.35;
      }

      // Shadow
      ctx.shadowColor = isSelected
        ? "hsla(234, 89%, 55%, 0.3)"
        : isHovered
        ? "hsla(0, 0%, 0%, 0.1)"
        : "hsla(0, 0%, 0%, 0.06)";
      ctx.shadowBlur = isSelected ? 24 : isHovered ? 16 : 10;
      ctx.shadowOffsetY = isSelected ? 6 : 3;

      // Node body
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? colors.stroke : "#ffffff";
      ctx.fill();

      // Border
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = isSelected ? colors.stroke : isHovered ? colors.stroke : "hsl(220, 16%, 88%)";
      ctx.lineWidth = isSelected ? 3 : isHovered ? 2 : 1.5;
      ctx.stroke();

      // Category accent ring
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

      // Text
      ctx.save();
      if (dimmed) ctx.globalAlpha = 0.35;

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Name
      ctx.font = `600 ${isSelected ? 12 : 11}px Inter, sans-serif`;
      ctx.fillStyle = isSelected ? "#ffffff" : "hsl(224, 30%, 18%)";
      const words = n.node.name.split(" ");
      if (words.length > 1 && ctx.measureText(n.node.name).width > r * 1.5) {
        ctx.fillText(words[0], n.x, n.y - 7);
        ctx.fillText(words.slice(1).join(" "), n.x, n.y + 7);
      } else {
        ctx.fillText(n.node.name, n.x, n.y - 2);
      }

      // Category
      ctx.font = `500 8px Inter, sans-serif`;
      ctx.fillStyle = isSelected
        ? "hsla(0, 0%, 100%, 0.75)"
        : colors.stroke;
      const catY = words.length > 1 && ctx.measureText(n.node.name).width > r ? n.y + 22 : n.y + 14;
      ctx.fillText(n.node.category, n.x, catY);

      ctx.restore();
    });

    ctx.restore();
  }, [edges, getLayoutNode, selectedNodeId, isLoading]);

  // Animation loop
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      simulate();
      draw();
      animRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
    };
  }, [simulate, draw]);

  // Hit test
  const hitTest = useCallback(
    (mx: number, my: number): LayoutNode | null => {
      const s = scaleRef.current;
      const px = (mx - panRef.current.x) / s;
      const py = (my - panRef.current.y) / s;
      for (let i = layoutRef.current.length - 1; i >= 0; i--) {
        const n = layoutRef.current[i];
        const dx = px - n.x,
          dy = py - n.y;
        if (dx * dx + dy * dy <= n.currentRadius * n.currentRadius) return n;
      }
      return null;
    },
    []
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit) {
        setDragging(hit.id);
        const s = scaleRef.current;
        dragOffset.current = {
          x: (mx - panRef.current.x) / s - hit.x,
          y: (my - panRef.current.y) / s - hit.y,
        };
      } else {
        isPanning.current = true;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
    },
    [hitTest]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left,
        my = e.clientY - rect.top;

      if (dragging) {
        const s = scaleRef.current;
        const n = getLayoutNode(dragging);
        if (n) {
          n.x = (mx - panRef.current.x) / s - dragOffset.current.x;
          n.y = (my - panRef.current.y) / s - dragOffset.current.y;
          n.vx = 0;
          n.vy = 0;
        }
      } else if (isPanning.current) {
        panRef.current.x += e.clientX - lastMouse.current.x;
        panRef.current.y += e.clientY - lastMouse.current.y;
        lastMouse.current = { x: e.clientX, y: e.clientY };
      } else {
        const hit = hitTest(mx, my);
        hoveredRef.current = hit?.id ?? null;
        canvasRef.current!.style.cursor = hit ? "pointer" : "grab";
      }
    },
    [dragging, getLayoutNode, hitTest]
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = e.clientX - rect.left,
          my = e.clientY - rect.top;
        const hit = hitTest(mx, my);
        if (hit && hit.id === dragging) {
          onSelectNode(hit.id);
        }
        setDragging(null);
      }
      isPanning.current = false;
    },
    [dragging, hitTest, onSelectNode]
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(0.3, Math.min(3, scaleRef.current * delta));
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    panRef.current.x =
      mx - ((mx - panRef.current.x) / scaleRef.current) * newScale;
    panRef.current.y =
      my - ((my - panRef.current.y) / scaleRef.current) * newScale;
    scaleRef.current = newScale;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded-xl"
      style={{ background: "hsl(220, 20%, 98.5%)" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setDragging(null);
        isPanning.current = false;
        hoveredRef.current = null;
      }}
      onWheel={handleWheel}
    />
  );
}

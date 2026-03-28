import React, { useCallback, useEffect, useRef, useState } from "react";
import { BusinessObjectNode, BusinessObjectEdge } from "@/data/mockData";

interface GraphCanvasProps {
  nodes: BusinessObjectNode[];
  edges: BusinessObjectEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
}

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  node: BusinessObjectNode;
}

const CATEGORY_COLORS: Record<string, string> = {
  HCM: "hsl(234, 89%, 60%)",
  Payroll: "hsl(160, 70%, 42%)",
  Benefits: "hsl(280, 65%, 55%)",
  Finance: "hsl(35, 90%, 50%)",
  "Time Tracking": "hsl(190, 70%, 45%)",
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || "hsl(234, 89%, 60%)";
}

const NODE_RADIUS = 48;

export default function GraphCanvas({ nodes, edges, selectedNodeId, onSelectNode }: GraphCanvasProps) {
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

  // Initialize layout
  useEffect(() => {
    const cx = sizeRef.current.w / 2;
    const cy = sizeRef.current.h / 2;
    layoutRef.current = nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const r = Math.min(cx, cy) * 0.55;
      return {
        id: node.id,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        vx: 0,
        vy: 0,
        node,
      };
    });
  }, [nodes]);

  const getLayoutNode = useCallback((id: string) => layoutRef.current.find((n) => n.id === id), []);

  // Force simulation tick
  const simulate = useCallback(() => {
    const layout = layoutRef.current;
    const k = 0.01;
    const repulsion = 8000;
    const damping = 0.85;

    // Reset forces
    layout.forEach((n) => { n.vx *= damping; n.vy *= damping; });

    // Repulsion between all nodes
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

    // Spring forces along edges
    edges.forEach((e) => {
      const a = getLayoutNode(e.source);
      const b = getLayoutNode(e.target);
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const desired = 180;
      const force = k * (dist - desired);
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    });

    // Center gravity
    const cx = sizeRef.current.w / 2, cy = sizeRef.current.h / 2;
    layout.forEach((n) => {
      n.vx += (cx - n.x) * 0.002;
      n.vy += (cy - n.y) * 0.002;
    });

    // Update positions (skip dragged node)
    layout.forEach((n) => {
      if (n.id === dragging) return;
      n.x += n.vx;
      n.y += n.vy;
    });
  }, [edges, getLayoutNode, dragging]);

  // Draw
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
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(panRef.current.x, panRef.current.y);
    ctx.scale(scaleRef.current, scaleRef.current);

    const layout = layoutRef.current;

    // Draw edges
    edges.forEach((e) => {
      const a = getLayoutNode(e.source);
      const b = getLayoutNode(e.target);
      if (!a || !b) return;
      const isHighlighted = selectedNodeId && (e.source === selectedNodeId || e.target === selectedNodeId);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = isHighlighted ? "hsl(234, 89%, 60%)" : "hsl(220, 14%, 85%)";
      ctx.lineWidth = isHighlighted ? 2.5 : 1.2;
      ctx.stroke();
    });

    // Draw nodes
    layout.forEach((n) => {
      const isSelected = n.id === selectedNodeId;
      const color = getCategoryColor(n.node.category);

      // Shadow
      ctx.save();
      ctx.shadowColor = isSelected ? "hsla(234, 89%, 60%, 0.35)" : "hsla(0, 0%, 0%, 0.08)";
      ctx.shadowBlur = isSelected ? 20 : 10;
      ctx.shadowOffsetY = isSelected ? 4 : 2;

      // Circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, NODE_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected ? color : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.stroke();
      ctx.restore();

      // Label
      ctx.font = `600 11px Inter, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isSelected ? "#ffffff" : "hsl(224, 30%, 20%)";

      // Word wrap for long names
      const words = n.node.name.split(" ");
      if (words.length > 1) {
        ctx.fillText(words[0], n.x, n.y - 7);
        ctx.fillText(words.slice(1).join(" "), n.x, n.y + 7);
      } else {
        ctx.fillText(n.node.name, n.x, n.y);
      }

      // Category badge
      ctx.font = `500 8px Inter, sans-serif`;
      ctx.fillStyle = isSelected ? "hsla(0, 0%, 100%, 0.7)" : color;
      ctx.fillText(n.node.category, n.x, n.y + (words.length > 1 ? 22 : 14));
    });

    ctx.restore();
  }, [edges, getLayoutNode, selectedNodeId]);

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
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [simulate, draw]);

  // Hit test
  const hitTest = useCallback((mx: number, my: number): LayoutNode | null => {
    const s = scaleRef.current;
    const px = (mx - panRef.current.x) / s;
    const py = (my - panRef.current.y) / s;
    for (let i = layoutRef.current.length - 1; i >= 0; i--) {
      const n = layoutRef.current[i];
      const dx = px - n.x, dy = py - n.y;
      if (dx * dx + dy * dy <= NODE_RADIUS * NODE_RADIUS) return n;
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
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
  }, [hitTest]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const s = scaleRef.current;
      const n = getLayoutNode(dragging);
      if (n) {
        n.x = (mx - panRef.current.x) / s - dragOffset.current.x;
        n.y = (my - panRef.current.y) / s - dragOffset.current.y;
        n.vx = 0; n.vy = 0;
      }
    } else if (isPanning.current) {
      panRef.current.x += e.clientX - lastMouse.current.x;
      panRef.current.y += e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };
    }
  }, [dragging, getLayoutNode]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = hitTest(mx, my);
      if (hit && hit.id === dragging) {
        onSelectNode(hit.id);
      }
      setDragging(null);
    }
    isPanning.current = false;
  }, [dragging, hitTest, onSelectNode]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(0.3, Math.min(3, scaleRef.current * delta));
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    panRef.current.x = mx - ((mx - panRef.current.x) / scaleRef.current) * newScale;
    panRef.current.y = my - ((my - panRef.current.y) / scaleRef.current) * newScale;
    scaleRef.current = newScale;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-grab active:cursor-grabbing rounded-xl"
      style={{ background: "hsl(220, 20%, 98%)" }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setDragging(null); isPanning.current = false; }}
      onWheel={handleWheel}
    />
  );
}

import React, { useEffect, useRef, useCallback } from "react";

// vis-network loaded via CDN in public/index.html
// Make sure you add the script tags there (see README)

const NODE_STYLES = {
  company: {
    color: { border: "#2563eb", background: "#dbeafe", highlight: { border: "#1d4ed8", background: "#bfdbfe" } },
    font:  { color: "#1e3a8a", size: 13, face: "Outfit", bold: true },
    size: 22,
    shape: "dot",
    shadow: { enabled: true, size: 10, color: "rgba(37,99,235,0.2)" },
  },
  country: {
    color: { border: "#0d9488", background: "#ccfbf1", highlight: { border: "#0f766e", background: "#99f6e4" } },
    font:  { color: "#134e4a", size: 12, face: "Outfit" },
    size: 16,
    shape: "dot",
    shadow: { enabled: true, size: 8, color: "rgba(13,148,136,0.2)" },
  },
  industry: {
    color: { border: "#7c3aed", background: "#ede9fe", highlight: { border: "#6d28d9", background: "#ddd6fe" } },
    font:  { color: "#4c1d95", size: 12, face: "Outfit" },
    size: 16,
    shape: "dot",
    shadow: { enabled: true, size: 8, color: "rgba(124,58,237,0.2)" },
  },
  default: {
    color: { border: "#94a3b8", background: "#f1f5f9" },
    font:  { color: "#475569", size: 12, face: "Outfit" },
    size: 14,
    shape: "dot",
  },
};

function GraphView({ nodes = [], edges = [], highlightIds = [] }) {
  const containerRef = useRef(null);
  const networkRef   = useRef(null);
  const visNodesRef  = useRef(null);
  const visEdgesRef  = useRef(null);

  // ── Build / Rebuild network ─────────────────────────────
  const buildNetwork = useCallback(() => {
    if (!containerRef.current || !window.vis) return;
    if (nodes.length === 0) return;

    // Clean up old instance
    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }

    const visNodes = nodes.map((n) => ({
      id:    n.id,
      label: n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label,
      title: `<div style="font-family:Outfit;padding:6px 10px;font-size:13px;"><b>${n.label}</b><br/><span style="color:#64748b;font-size:11px">${n.type}</span></div>`,
      ...(NODE_STYLES[n.type] || NODE_STYLES.default),
      borderWidth: 2,
    }));

    const visEdges = edges.map((e, i) => ({
      id:    i,
      from:  e.source,
      to:    e.target,
      label: e.label,
      font:  { color: "#94a3b8", size: 10, face: "JetBrains Mono", align: "middle", background: "rgba(255,255,255,0.9)" },
      color: { color: "#cbd5e1", highlight: "#2563eb", hover: "#93c5fd" },
      arrows: { to: { enabled: true, scaleFactor: 0.7, type: "arrow" } },
      smooth: { type: "curvedCW", roundness: 0.2 },
      width: 1.5,
      selectionWidth: 3,
    }));

    visNodesRef.current = new window.vis.DataSet(visNodes);
    visEdgesRef.current = new window.vis.DataSet(visEdges);

    const options = {
      physics: {
        enabled: true,
        stabilization: { iterations: 150, fit: true, updateInterval: 30 },
        barnesHut: {
          gravitationalConstant: -5000,
          springConstant: 0.05,
          damping: 0.18,
          centralGravity: 0.3,
        },
      },
      interaction: {
        hover: true,
        tooltipDelay: 80,
        navigationButtons: false,
        keyboard: false,
        zoomView: true,
        dragView: true,
      },
      configure: { enabled: false },
    };

    networkRef.current = new window.vis.Network(
      containerRef.current,
      { nodes: visNodesRef.current, edges: visEdgesRef.current },
      options
    );

    networkRef.current.once("stabilizationIterationsDone", () => {
      networkRef.current.setOptions({ physics: { enabled: false } });
    });
  }, [nodes, edges]);

  useEffect(() => { buildNetwork(); }, [buildNetwork]);

  // ── Highlight nodes when search results arrive ──────────
  useEffect(() => {
    if (!networkRef.current || !visNodesRef.current || highlightIds.length === 0) return;

    const all = visNodesRef.current.get();
    const updates = all.map((n) => ({ id: n.id, opacity: 0.25 }));
    visNodesRef.current.update(updates);

    const focusIds = [];
    highlightIds.forEach((name) => {
      const node = all.find((n) => n.id === name || n.title?.includes(name));
      if (!node) return;
      focusIds.push(node.id);
      visNodesRef.current.update([{ id: node.id, opacity: 1, size: 30 }]);

      // Brighten neighbours
      const edgeList = visEdgesRef.current.get();
      edgeList.forEach((e) => {
        if (e.from === node.id || e.to === node.id) {
          const nbr = e.from === node.id ? e.to : e.from;
          focusIds.push(nbr);
          visNodesRef.current.update([{ id: nbr, opacity: 0.8, size: 20 }]);
        }
      });
    });

    if (focusIds.length > 0) {
      networkRef.current.fit({
        nodes: [...new Set(focusIds)],
        animation: { duration: 800, easingFunction: "easeInOutQuad" },
      });
    }

    const timer = setTimeout(() => {
      const reset = visNodesRef.current.get().map((n) => ({ id: n.id, opacity: 1 }));
      visNodesRef.current.update(reset);
    }, 6000);

    return () => clearTimeout(timer);
  }, [highlightIds]);

  // ── Control helpers (called from App via ref) ───────────
  GraphView.resetView   = () => networkRef.current?.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
  GraphView.zoomIn      = () => { if (networkRef.current) networkRef.current.moveTo({ scale: networkRef.current.getScale() * 1.3 }); };
  GraphView.zoomOut     = () => { if (networkRef.current) networkRef.current.moveTo({ scale: networkRef.current.getScale() / 1.3 }); };
  GraphView.togglePhysics = (() => {
    let on = false;
    return () => {
      on = !on;
      networkRef.current?.setOptions({ physics: { enabled: on } });
    };
  })();

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
  );
}

export default GraphView;
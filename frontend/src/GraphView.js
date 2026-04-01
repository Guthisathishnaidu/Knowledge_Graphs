import React, { useEffect, useRef, useCallback } from "react";

const NODE_STYLES = {
  company: {
    color: { border: "#2563eb", background: "#dbeafe", highlight: { border: "#1d4ed8", background: "#bfdbfe" } },
    font:  { color: "#1e3a8a", size: 13, face: "Outfit", bold: true },
    size: 22, shape: "dot",
    shadow: { enabled: true, size: 10, color: "rgba(37,99,235,0.2)" },
  },
  country: {
    color: { border: "#0d9488", background: "#ccfbf1", highlight: { border: "#0f766e", background: "#99f6e4" } },
    font:  { color: "#134e4a", size: 12, face: "Outfit" },
    size: 16, shape: "dot",
    shadow: { enabled: true, size: 8, color: "rgba(13,148,136,0.2)" },
  },
  industry: {
    color: { border: "#7c3aed", background: "#ede9fe", highlight: { border: "#6d28d9", background: "#ddd6fe" } },
    font:  { color: "#4c1d95", size: 12, face: "Outfit" },
    size: 16, shape: "dot",
    shadow: { enabled: true, size: 8, color: "rgba(124,58,237,0.2)" },
  },
  default: {
    color: { border: "#94a3b8", background: "#f1f5f9" },
    font:  { color: "#475569", size: 12, face: "Outfit" },
    size: 14, shape: "dot",
  },
};

// Public API — call via GraphViewAPI.resetView() etc. from App.js
export const GraphViewAPI = {
  resetView:     () => {},
  zoomIn:        () => {},
  zoomOut:       () => {},
  togglePhysics: () => {},
  searchNode:    () => {},
  filterTypes:   () => {},
  exportImage:   () => {},
};

function GraphView({ nodes = [], edges = [], highlightIds = [], onNodeClick }) {
  const containerRef = useRef(null);
  const networkRef   = useRef(null);
  const visNodesRef  = useRef(null);
  const visEdgesRef  = useRef(null);
  const physicsOnRef = useRef(false); // FIX: was IIFE closure — resets on every render

  const buildNetwork = useCallback(() => {
    if (!containerRef.current || !window.vis || nodes.length === 0) return;

    if (networkRef.current) {
      networkRef.current.destroy();
      networkRef.current = null;
    }

    const visNodes = nodes.map((n) => ({
      id:    n.id,
      label: n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label,
      title: `<div style="font-family:Outfit;padding:6px 10px;font-size:13px;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.12)"><b>${n.label}</b><br/><span style="color:#64748b;font-size:11px;text-transform:capitalize">${n.type}</span></div>`,
      ...(NODE_STYLES[n.type] || NODE_STYLES.default),
      borderWidth: 2,
      _type: n.type,
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
      width: 1.5, selectionWidth: 3,
    }));

    visNodesRef.current = new window.vis.DataSet(visNodes);
    visEdgesRef.current = new window.vis.DataSet(visEdges);

    networkRef.current = new window.vis.Network(
      containerRef.current,
      { nodes: visNodesRef.current, edges: visEdgesRef.current },
      {
        physics: {
          enabled: true,
          stabilization: { iterations: 150, fit: true, updateInterval: 30 },
          barnesHut: { gravitationalConstant: -5000, springConstant: 0.05, damping: 0.18, centralGravity: 0.3 },
        },
        interaction: { hover: true, tooltipDelay: 80, navigationButtons: false, keyboard: false, zoomView: true, dragView: true },
        configure: { enabled: false },
      }
    );

    networkRef.current.once("stabilizationIterationsDone", () => {
      networkRef.current.setOptions({ physics: { enabled: false } });
      physicsOnRef.current = false;
    });

    // Node click → parent callback with full connection info
    networkRef.current.on("click", (params) => {
      if (params.nodes.length > 0 && onNodeClick) {
        const nodeId = params.nodes[0];
        const nodeData = visNodesRef.current.get(nodeId);
        const connectedEdges = visEdgesRef.current.get().filter(
          (e) => e.from === nodeId || e.to === nodeId
        );
        const connections = connectedEdges.map((e) => ({
          id:       e.from === nodeId ? e.to : e.from,
          relation: e.label,
          direction: e.from === nodeId ? "out" : "in",
        }));
        onNodeClick({ id: nodeId, label: nodeData?.label, type: nodeData?._type, connections });
      }
    });

    // Wire public API — FIX: assigned here so they always have current refs
    GraphViewAPI.resetView   = () => networkRef.current?.fit({ animation: { duration: 600, easingFunction: "easeInOutQuad" } });
    GraphViewAPI.zoomIn      = () => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() || 1) * 1.3 });
    GraphViewAPI.zoomOut     = () => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() || 1) / 1.3 });

    // FIX: physicsOnRef persists across renders
    GraphViewAPI.togglePhysics = () => {
      physicsOnRef.current = !physicsOnRef.current;
      networkRef.current?.setOptions({ physics: { enabled: physicsOnRef.current } });
      return physicsOnRef.current;
    };

    GraphViewAPI.searchNode = (term) => {
      if (!visNodesRef.current) return;
      if (!term.trim()) {
        visNodesRef.current.update(visNodesRef.current.get().map((n) => ({ id: n.id, opacity: 1 })));
        return;
      }
      const lower = term.toLowerCase();
      const all = visNodesRef.current.get();
      const matched = all.filter((n) =>
        (n.id + "").toLowerCase().includes(lower) ||
        (n.label + "").toLowerCase().includes(lower)
      );
      const matchedIds = new Set(matched.map((n) => n.id));
      visNodesRef.current.update(all.map((n) => ({ id: n.id, opacity: matchedIds.has(n.id) ? 1 : 0.12 })));
      if (matched.length > 0) {
        networkRef.current?.fit({ nodes: [...matchedIds], animation: { duration: 500, easingFunction: "easeInOutQuad" } });
      }
    };

    GraphViewAPI.filterTypes = (visibleTypes) => {
      if (!visNodesRef.current) return;
      visNodesRef.current.update(
        visNodesRef.current.get().map((n) => ({ id: n.id, hidden: !visibleTypes.includes(n._type) }))
      );
    };

    GraphViewAPI.exportImage = () => {
      const canvas = containerRef.current?.querySelector("canvas");
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = "knowledge-graph.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

  }, [nodes, edges, onNodeClick]);

  useEffect(() => { buildNetwork(); }, [buildNetwork]);

  // Highlight matching nodes when query results arrive
  useEffect(() => {
    if (!networkRef.current || !visNodesRef.current || highlightIds.length === 0) return;

    const all = visNodesRef.current.get();
    visNodesRef.current.update(all.map((n) => ({ id: n.id, opacity: 0.2 })));

    const focusIds = [];
    highlightIds.forEach((name) => {
      const node = all.find((n) => n.id === name);
      if (!node) return;
      focusIds.push(node.id);
      visNodesRef.current.update([{ id: node.id, opacity: 1, size: 32 }]);
      visEdgesRef.current.get().forEach((e) => {
        const nbr = e.from === node.id ? e.to : e.from === node.id ? null : e.from;
        if (nbr && (e.from === node.id || e.to === node.id)) {
          const nbrId = e.from === node.id ? e.to : e.from;
          focusIds.push(nbrId);
          visNodesRef.current.update([{ id: nbrId, opacity: 0.85, size: 20 }]);
        }
      });
    });

    if (focusIds.length > 0) {
      networkRef.current.fit({ nodes: [...new Set(focusIds)], animation: { duration: 800, easingFunction: "easeInOutQuad" } });
    }

    const timer = setTimeout(() => {
      if (visNodesRef.current)
        visNodesRef.current.update(visNodesRef.current.get().map((n) => ({ id: n.id, opacity: 1 })));
    }, 6000);
    return () => clearTimeout(timer);
  }, [highlightIds]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

export default GraphView;
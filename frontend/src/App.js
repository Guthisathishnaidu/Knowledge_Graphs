import React, { useState, useEffect, useRef, useCallback } from "react";
import GraphView, { GraphViewAPI } from "./GraphView";
import "./App.css";

const API = "http://localhost:8000";

// ── Animated counter ─────────────────────────────────────
function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let n = 0;
    const step = Math.ceil(target / (duration / 30));
    const t = setInterval(() => {
      n = Math.min(n + step, target);
      setVal(n);
      if (n >= target) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  }, [target, duration]);
  return val;
}

// ── Toast ─────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.icon}</span><span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────
function StatTile({ icon, label, value, colorClass }) {
  const animated = useCountUp(value);
  return (
    <div className="stat-tile">
      <span className="stat-icon">{icon}</span>
      <div className={`stat-number ${colorClass}`}>{value ? animated : "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

// ── CSV export helper ─────────────────────────────────────
function exportCSV(results, query) {
  if (!results.length) return;
  const header = ["Company", "Country", "Industry"];
  const rows   = results.map((r) => [
    `"${(r.company  || "").replace(/"/g, '""')}"`,
    `"${(r.country  || "").replace(/"/g, '""')}"`,
    `"${(r.industry || "").replace(/"/g, '""')}"`,
  ]);
  const csv  = [header.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `query-results-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main App ──────────────────────────────────────────────
export default function App() {
  const [stats,       setStats]       = useState({});
  const [graphData,   setGraphData]   = useState({ nodes: [], edges: [] });
  const [health,      setHealth]      = useState({});
  const [query,       setQuery]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [answer,      setAnswer]      = useState(null);
  const [answerState, setAnswerState] = useState("idle");
  const [results,     setResults]     = useState([]);
  const [highlights,  setHighlights]  = useState([]);
  const [source,      setSource]      = useState("mock");
  const [history,     setHistory]     = useState([]);
  const [activeTab,   setActiveTab]   = useState("graph");
  const [toasts,      setToasts]      = useState([]);
  const [queryCount,  setQueryCount]  = useState(0);

  // ── NEW: node detail panel ─────────────────────────────
  const [selectedNode, setSelectedNode] = useState(null);

  // ── NEW: graph search & filter ─────────────────────────
  const [graphSearch,  setGraphSearch]  = useState("");
  const [typeFilters,  setTypeFilters]  = useState({
    company: true, country: true, industry: true,
  });
  const [physicsLabel, setPhysicsLabel] = useState("Enable Physics");

  const inputRef = useRef(null);

  const toast = useCallback((msg, type = "info", icon = "ℹ️") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type, icon }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3200);
  }, []);

  // ── Fetch on mount + auto-refresh health every 30s ─────
  useEffect(() => {
    fetchHealth();
    fetchStats();
    fetchGraph();
    const healthInterval = setInterval(fetchHealth, 30000); // NEW: auto-refresh
    return () => clearInterval(healthInterval);
    // eslint-disable-next-line
  }, []);

  async function fetchHealth() {
    try {
      const r = await fetch(`${API}/health`);
      setHealth(await r.json());
    } catch {
      setHealth({ neo4j: "error", pinecone: "error", llm: "error" });
    }
  }

  async function fetchStats() {
    try {
      const r = await fetch(`${API}/stats`);
      setStats(await r.json());
    } catch {}
  }

  async function fetchGraph() {
    try {
      const r = await fetch(`${API}/graph`);
      setGraphData(await r.json());
    } catch {
      toast("Using demo graph data", "info", "📊");
    }
  }

  // ── FIX: history click — pass query directly, no closure bug ──
  function runQuery(q) {
    setQuery(q);
    executeSearch(q);
  }

  async function handleSearch() {
    executeSearch(query);
  }

  async function executeSearch(q) {
    if (!q.trim() || loading) return;
    setLoading(true);
    setAnswerState("loading");
    setResults([]);
    setHighlights([]);
    setSelectedNode(null);
    setHistory((p) => [q, ...p.filter((x) => x !== q)].slice(0, 8));

    try {
      const resp = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      const detailResults = data.details || data.companies?.map((c) => ({ company: c })) || [];
      setResults(detailResults);
      setAnswer(data.answer);
      setAnswerState("active");
      setSource(data.source || "mock");
      setHighlights(data.companies || []);
      setQueryCount((n) => n + 1);    // NEW: session query counter
      toast("Query complete", "success", "✅");
    } catch {
      setAnswerState("error");
      setAnswer("Cannot reach the backend.\n\nRun in your terminal:\n\n  cd backend\n  uvicorn api:app --reload --port 8000");
      toast("Backend unreachable", "error", "❌");
    } finally {
      setLoading(false);
    }
  }

  // ── NEW: graph search handler ──────────────────────────
  function handleGraphSearch(e) {
    const val = e.target.value;
    setGraphSearch(val);
    GraphViewAPI.searchNode(val);
  }

  // ── NEW: type filter toggle ────────────────────────────
  function toggleTypeFilter(type) {
    const next = { ...typeFilters, [type]: !typeFilters[type] };
    setTypeFilters(next);
    const visible = Object.entries(next).filter(([, v]) => v).map(([k]) => k);
    GraphViewAPI.filterTypes(visible);
  }

  // ── NEW: physics toggle with label ────────────────────
  function handleTogglePhysics() {
    const isOn = GraphViewAPI.togglePhysics();
    setPhysicsLabel(isOn ? "Disable Physics" : "Enable Physics");
  }

  function pillClass(val) {
    if (val === "connected" || val === "ready") return "live";
    if (val === "mock") return "mock";
    return "error";
  }
  function pillLabel(val) {
    return { connected: "Live", ready: "Ready", mock: "Mock", error: "Down", unavailable: "Down" }[val] || val || "—";
  }

  const companies  = [...new Set(results.map((r) => r.company).filter(Boolean))];
  const countries  = [...new Set(results.map((r) => r.country).filter(Boolean))];
  const industries = [...new Set(results.map((r) => r.industry).filter(Boolean))];

  return (
    <div className="app-shell">

      {/* ── TOPBAR ──────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-logo">⬡</div>
          <div className="brand-name">Graph<span>Mind</span></div>
          <span className="brand-tag">AI</span>
        </div>

        <div className="status-row">
          {[["NEO4J", health.neo4j], ["PINECONE", health.pinecone], ["LLM", health.llm]].map(([label, val]) => (
            <div key={label} className={`status-pill ${pillClass(val)}`}>
              <span className="status-dot" />
              {label} · {pillLabel(val)}
            </div>
          ))}
          {/* NEW: session query counter */}
          {queryCount > 0 && (
            <div className="status-pill session-badge">
              🔍 {queryCount} {queryCount === 1 ? "query" : "queries"} this session
            </div>
          )}
          {/* NEW: manual refresh health button */}
          <button className="refresh-btn" onClick={fetchHealth} title="Refresh service status">⟳</button>
        </div>
      </header>

      {/* ── BODY ────────────────────────────────────── */}
      <div className="app-body">

        {/* ── SIDEBAR ──────────────────────────────── */}
        <aside className="sidebar">

          {/* Stats */}
          <div className="sidebar-section">
            <div className="section-label">
              Overview
              <button className="mini-btn" onClick={() => { fetchStats(); fetchGraph(); }} title="Refresh stats">⟳</button>
            </div>
            <div className="stats-grid">
              <StatTile icon="🏢" label="Companies"  value={stats.companies}  colorClass="blue"   />
              <StatTile icon="🌍" label="Countries"  value={stats.countries}  colorClass="teal"   />
              <StatTile icon="⚙️" label="Industries" value={stats.industries} colorClass="violet" />
              <StatTile icon="🔗" label="Relations"  value={stats.relations}  colorClass="amber"  />
            </div>
          </div>

          {/* Top Matches */}
          <div className="sidebar-section">
            <div className="section-label">
              Top Matches
              {/* NEW: CSV Export button */}
              {results.length > 0 && (
                <button
                  className="mini-btn export-btn"
                  onClick={() => { exportCSV(results, query); toast("CSV downloaded", "success", "📥"); }}
                  title="Export results as CSV"
                >
                  ↓ CSV
                </button>
              )}
            </div>
            {results.length === 0 ? (
              <div className="empty-state" style={{ padding: "16px 0" }}>
                <span className="empty-icon" style={{ fontSize: 24 }}>⬡</span>
                <span className="empty-hint">Run a query to see results</span>
              </div>
            ) : (
              <div className="result-list">
                {results.map((r, i) => {
                  const name = r.company || r;
                  return (
                    <div
                      key={i}
                      className="result-card"
                      style={{ animationDelay: `${i * 70}ms` }}
                      onClick={() => setHighlights([name])}
                    >
                      <div className="result-avatar">{["🏢","🏭","🏬","🏗️"][i % 4]}</div>
                      <div>
                        <div className="result-name">{name}</div>
                        {(r.country || r.industry) && (
                          <div className="result-meta">
                            {[r.country, r.industry].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* History */}
          {history.length > 0 && (
            <div className="sidebar-section">
              <div className="section-label">Recent Queries</div>
              <div className="history-list">
                {history.map((q, i) => (
                  <div
                    key={i}
                    className="history-item"
                    onClick={() => runQuery(q)}  // FIX: no closure bug
                  >
                    ↺ {q}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── MAIN PANEL ──────────────────────────── */}
        <main className="main-panel">

          {/* Search bar */}
          <div className="main-search-bar">
            <div className="main-search-inner">
              <span className="main-search-icon">🔍</span>
              <input
                ref={inputRef}
                className="main-search-input"
                type="text"
                placeholder="Ask a business question… e.g. Which companies are in the plastics industry?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                className="main-search-btn"
                onClick={handleSearch}
                disabled={loading || !query.trim()}
              >
                {loading ? (
                  <span className="dot-wave"><span /><span /><span /></span>
                ) : "▶  Run Query"}
              </button>
            </div>
          </div>

          {/* AI Insight */}
          <div className="answer-section">
            <div className="answer-header">
              <div className="answer-title">🤖 AI Insight</div>
              {answerState === "active" && (
                <span className={`source-badge ${source}`}>
                  {source === "live" ? "● Live" : "◎ Demo"}
                </span>
              )}
            </div>

            <div className={`answer-card ${answerState === "active" ? "active" : ""} ${answerState === "error" ? "error" : ""}`}>
              {answerState === "idle" && (
                <span className="answer-placeholder">
                  Ask a business question above to get AI-powered insights from the knowledge graph…
                </span>
              )}
              {answerState === "loading" && (
                <div className="thinking-row">
                  <span className="dot-wave"><span /><span /><span /></span>
                  Searching graph and generating answer…
                </div>
              )}
              {(answerState === "active" || answerState === "error") && (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14 }}>
                  {answer}
                </pre>
              )}
            </div>

            {(companies.length > 0 || countries.length > 0 || industries.length > 0) && (
              <div className="tag-row">
                {companies.map((c)  => <span key={c} className="entity-tag company">🏢 {c}</span>)}
                {countries.map((c)  => <span key={c} className="entity-tag country">🌍 {c}</span>)}
                {industries.map((i) => <span key={i} className="entity-tag industry">⚙️ {i}</span>)}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="tab-bar">
            <button className={`tab-btn ${activeTab === "graph" ? "active" : ""}`} onClick={() => setActiveTab("graph")}>🌐 Knowledge Graph</button>
            <button className={`tab-btn ${activeTab === "table" ? "active" : ""}`} onClick={() => setActiveTab("table")}>📋 Data Table</button>
          </div>

          {/* ── GRAPH TAB ── */}
          {activeTab === "graph" && (
            <div className="graph-panel">
              <GraphView
                nodes={graphData.nodes}
                edges={graphData.edges}
                highlightIds={highlights}
                onNodeClick={setSelectedNode}   // NEW: node click detail
              />

              {/* Graph toolbar */}
              <div className="graph-controls">
                <button className="ctrl-btn" title="Fit view"  onClick={() => GraphViewAPI.resetView()}>⌖</button>
                <button className="ctrl-btn" title="Zoom in"   onClick={() => GraphViewAPI.zoomIn()}>+</button>
                <button className="ctrl-btn" title="Zoom out"  onClick={() => GraphViewAPI.zoomOut()}>−</button>
                <button className="ctrl-btn" title={physicsLabel} onClick={handleTogglePhysics}>⚛</button>
                <button className="ctrl-btn" title="Export PNG" onClick={() => { GraphViewAPI.exportImage(); toast("Graph exported", "success", "🖼️"); }}>⬇</button>
              </div>

              {/* NEW: Graph search box */}
              <div className="graph-search-box">
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>🔎</span>
                <input
                  className="graph-search-input"
                  placeholder="Search nodes…"
                  value={graphSearch}
                  onChange={handleGraphSearch}
                />
                {graphSearch && (
                  <button
                    className="graph-search-clear"
                    onClick={() => { setGraphSearch(""); GraphViewAPI.searchNode(""); }}
                  >✕</button>
                )}
              </div>

              {/* Legend + NEW: type filter */}
              <div className="graph-legend">
                <div className="legend-heading">Node Types</div>
                {[
                  { type: "company",  color: "#2563eb", bg: "#dbeafe", label: "Company" },
                  { type: "country",  color: "#0d9488", bg: "#ccfbf1", label: "Country" },
                  { type: "industry", color: "#7c3aed", bg: "#ede9fe", label: "Industry" },
                ].map(({ type, color, bg, label }) => (
                  <div
                    key={type}
                    className={`legend-row clickable-filter ${typeFilters[type] ? "" : "dimmed"}`}
                    onClick={() => toggleTypeFilter(type)}
                    title={`Click to ${typeFilters[type] ? "hide" : "show"} ${label} nodes`}
                  >
                    <div className="legend-dot" style={{ background: bg, border: `2px solid ${color}`, opacity: typeFilters[type] ? 1 : 0.3 }} />
                    <span style={{ opacity: typeFilters[type] ? 1 : 0.4 }}>{label}</span>
                  </div>
                ))}
                <div className="legend-hint">Click to filter</div>
              </div>

              {/* NEW: Node detail panel */}
              {selectedNode && (
                <div className="node-detail-panel">
                  <div className="node-detail-header">
                    <span className={`node-detail-badge ${selectedNode.type}`}>
                      {{ company: "🏢", country: "🌍", industry: "⚙️" }[selectedNode.type] || "⬡"} {selectedNode.type}
                    </span>
                    <button className="node-detail-close" onClick={() => setSelectedNode(null)}>✕</button>
                  </div>
                  <div className="node-detail-name">{selectedNode.id}</div>
                  {selectedNode.connections?.length > 0 && (
                    <>
                      <div className="node-detail-section">Connections ({selectedNode.connections.length})</div>
                      <div className="node-detail-list">
                        {selectedNode.connections.map((c, i) => (
                          <div key={i} className="node-detail-row">
                            <span className="node-detail-rel">{c.relation}</span>
                            <span className="node-detail-target">{c.id}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── TABLE TAB ── */}
          {activeTab === "table" && (
            <div className="table-panel">
              {results.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <div className="empty-text">No results yet</div>
                  <div className="empty-hint">Run a query to see data here</div>
                </div>
              ) : (
                <>
                  <div className="table-actions">
                    <span className="table-count">{results.length} result{results.length !== 1 ? "s" : ""}</span>
                    <button
                      className="table-export-btn"
                      onClick={() => { exportCSV(results, query); toast("CSV downloaded", "success", "📥"); }}
                    >
                      ↓ Export CSV
                    </button>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Company</th><th>Country</th><th>Industry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <tr
                          key={i}
                          style={{ animationDelay: `${i * 50}ms` }}
                          onClick={() => setHighlights([r.company])}
                          className="table-row-clickable"
                          title="Click to highlight in graph"
                        >
                          <td style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
                            {String(i + 1).padStart(2, "0")}
                          </td>
                          <td className="td-company">{r.company || r}</td>
                          <td className="td-country">{r.country  || "—"}</td>
                          <td className="td-industry">{r.industry || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}
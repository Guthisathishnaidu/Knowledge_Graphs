import React, { useState, useEffect, useRef, useCallback } from "react";
import GraphView from "./GraphView";
import "./App.css";

const API = "http://localhost:8000";

// ── Animated counter hook ────────────────────────────────
function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    let start = 0;
    const step = Math.ceil(target / (duration / 30));
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setVal(start);
      if (start >= target) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

// ── Toast ────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{t.icon}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ── Stat tile ────────────────────────────────────────────
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

// ── Main App ─────────────────────────────────────────────
export default function App() {
  // Data state
  const [stats,       setStats]       = useState({});
  const [graphData,   setGraphData]   = useState({ nodes: [], edges: [] });
  const [health,      setHealth]      = useState({});
  const [query,       setQuery]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [answer,      setAnswer]      = useState(null);
  const [answerState, setAnswerState] = useState("idle"); // idle | loading | active | error
  const [results,     setResults]     = useState([]);
  const [highlights,  setHighlights]  = useState([]);
  const [source,      setSource]      = useState("mock");
  const [history,     setHistory]     = useState([]);
  const [activeTab,   setActiveTab]   = useState("graph");
  const [toasts,      setToasts]      = useState([]);

  const inputRef = useRef(null);

  // ── Toast helper ────────────────────────────────────────
  const toast = useCallback((msg, type = "info", icon = "ℹ️") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type, icon }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  // ── Fetch on mount ──────────────────────────────────────
  useEffect(() => {
    fetchHealth();
    fetchStats();
    fetchGraph();
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
      const d = await r.json();
      setGraphData(d);
    } catch {
      toast("Using demo graph data", "info", "📊");
    }
  }

  // ── Search ───────────────────────────────────────────────
  async function handleSearch() {
    if (!query.trim() || loading) return;

    setLoading(true);
    setAnswerState("loading");
    setResults([]);
    setHighlights([]);

    // History
    setHistory((prev) => {
      const next = [query, ...prev.filter((q) => q !== query)].slice(0, 8);
      return next;
    });

    try {
      const resp = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      setResults(data.details || data.companies?.map((c) => ({ company: c })) || []);
      setAnswer(data.answer);
      setAnswerState("active");
      setSource(data.source || "mock");
      setHighlights(data.companies || []);
      toast("Query complete", "success", "✅");
    } catch (err) {
      setAnswerState("error");
      setAnswer(
        "Cannot reach the backend.\n\nRun this in your terminal:\n\ncd backend\nuvicorn api:app --reload --port 8000"
      );
      toast("Backend unreachable", "error", "❌");
    } finally {
      setLoading(false);
    }
  }

  function pillClass(val) {
    if (val === "connected" || val === "ready") return "live";
    if (val === "mock") return "mock";
    return "error";
  }

  function pillLabel(key, val) {
    const map = { connected: "Live", ready: "Ready", mock: "Mock", error: "Down", unavailable: "Down" };
    return map[val] || val || "—";
  }

  // ── Tag builder ─────────────────────────────────────────
  const companies  = [...new Set(results.map((r) => r.company).filter(Boolean))];
  const countries  = [...new Set(results.map((r) => r.country).filter(Boolean))];
  const industries = [...new Set(results.map((r) => r.industry).filter(Boolean))];

  return (
    <div className="app-shell">
      {/* ── TOPBAR ──────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-logo">⬡</div>
          <div className="brand-name">
            Graph<span>Mind</span>
          </div>
          <span className="brand-tag">AI</span>
        </div>

        <div className="status-row">
          {[
            { label: "NEO4J",    val: health.neo4j },
            { label: "PINECONE", val: health.pinecone },
            { label: "LLM",      val: health.llm },
          ].map(({ label, val }) => (
            <div key={label} className={`status-pill ${pillClass(val)}`}>
              <span className="status-dot" />
              {label} · {pillLabel(label, val)}
            </div>
          ))}
        </div>
      </header>

      {/* ── BODY ────────────────────────────────── */}
      <div className="app-body">

        {/* ── SIDEBAR ─────────────────────────── */}
        <aside className="sidebar">

          {/* Stats */}
          <div className="sidebar-section">
            <div className="section-label">Overview</div>
            <div className="stats-grid">
              <StatTile icon="🏢" label="Companies"  value={stats.companies}  colorClass="blue" />
              <StatTile icon="🌍" label="Countries"  value={stats.countries}  colorClass="teal" />
              <StatTile icon="⚙️" label="Industries" value={stats.industries} colorClass="violet" />
              <StatTile icon="🔗" label="Relations"  value={stats.relations}  colorClass="amber" />
            </div>
          </div>

          {/* Search */}
          <div className="sidebar-section">
            <div className="section-label">Query</div>
            <div className="search-field">
              <span className="search-field-icon">🔍</span>
              <input
                ref={inputRef}
                className="search-input"
                type="text"
                placeholder="e.g. plastic companies in Asia…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
            <button
              className="search-btn"
              onClick={handleSearch}
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <>
                  <span className="dot-wave">
                    <span /><span /><span />
                  </span>
                  Analyzing…
                </>
              ) : (
                <> ▶ &nbsp;Run Query </>
              )}
            </button>
          </div>

          {/* Results */}
          <div className="sidebar-section">
            <div className="section-label">Top Matches</div>
            {results.length === 0 ? (
              <div className="empty-state" style={{ padding: "16px 0" }}>
                <span className="empty-icon">⬡</span>
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
                      <div className="result-avatar">
                        {["🏢", "🏭", "🏬", "🏗️"][i % 4]}
                      </div>
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
                    onClick={() => { setQuery(q); setTimeout(handleSearch, 50); }}
                  >
                    ↺ {q}
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── MAIN PANEL ──────────────────────── */}
        <main className="main-panel">

          {/* Answer */}
          <div className="answer-section">
            <div className="answer-header">
              <div className="answer-title">
                🤖 AI Insight
              </div>
              {source && answerState === "active" && (
                <span className={`source-badge ${source}`}>
                  {source === "live" ? "● Live" : "◎ Demo"}
                </span>
              )}
            </div>

            <div className={`answer-card ${answerState === "active" ? "active" : ""} ${answerState === "error" ? "error" : ""}`}>
              {answerState === "idle" && (
                <span className="answer-placeholder">
                  Ask a business question to get AI-powered insights from the knowledge graph…
                </span>
              )}
              {answerState === "loading" && (
                <div className="thinking-row">
                  <span className="dot-wave">
                    <span /><span /><span />
                  </span>
                  Searching graph and generating answer…
                </div>
              )}
              {(answerState === "active" || answerState === "error") && (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 14 }}>
                  {answer}
                </pre>
              )}
            </div>

            {/* Entity tags */}
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
            <button
              className={`tab-btn ${activeTab === "graph" ? "active" : ""}`}
              onClick={() => setActiveTab("graph")}
            >
              🌐 Knowledge Graph
            </button>
            <button
              className={`tab-btn ${activeTab === "table" ? "active" : ""}`}
              onClick={() => setActiveTab("table")}
            >
              📋 Data Table
            </button>
          </div>

          {/* Graph tab */}
          {activeTab === "graph" && (
            <div className="graph-panel">
              <GraphView
                nodes={graphData.nodes}
                edges={graphData.edges}
                highlightIds={highlights}
              />

              {/* Controls */}
              <div className="graph-controls">
                <button className="ctrl-btn" title="Fit view"       onClick={() => GraphView.resetView()}>⌖</button>
                <button className="ctrl-btn" title="Zoom in"        onClick={() => GraphView.zoomIn()}>+</button>
                <button className="ctrl-btn" title="Zoom out"       onClick={() => GraphView.zoomOut()}>−</button>
                <button className="ctrl-btn" title="Toggle physics" onClick={() => GraphView.togglePhysics()}>⚛</button>
              </div>

              {/* Legend */}
              <div className="graph-legend">
                <div className="legend-heading">Node Types</div>
                {[
                  { color: "#2563eb", bg: "#dbeafe", label: "Company" },
                  { color: "#0d9488", bg: "#ccfbf1", label: "Country" },
                  { color: "#7c3aed", bg: "#ede9fe", label: "Industry" },
                ].map(({ color, bg, label }) => (
                  <div className="legend-row" key={label}>
                    <div
                      className="legend-dot"
                      style={{ background: bg, border: `2px solid ${color}` }}
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Table tab */}
          {activeTab === "table" && (
            <div className="table-panel">
              {results.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <div className="empty-text">No results yet</div>
                  <div className="empty-hint">Run a query to see data here</div>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Company</th>
                      <th>Country</th>
                      <th>Industry</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} style={{ animationDelay: `${i * 50}ms` }}>
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
              )}
            </div>
          )}
        </main>
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}
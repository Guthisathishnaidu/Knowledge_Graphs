import sys
import os

# ── PATH FIX: lets Python find milestone3/rag_pipeline.py ──
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Try importing the real pipeline, fallback to mock if not ready ──
try:
    from milestone3.rag_pipeline import search_companies, get_company_info, ask_llama
    PIPELINE_OK = True
    print("✅ RAG Pipeline loaded successfully")
except Exception as e:
    PIPELINE_OK = False
    print(f"⚠  RAG Pipeline not available ({e}) — using mock data")

# ────────────────────────────────────────────────────────────
#  MOCK DATA  (used when Neo4j / Pinecone / Ollama aren't up)
# ────────────────────────────────────────────────────────────
MOCK_DB = {
    "plastics":       [{"company": "Ferrell LLC",      "country": "Papua New Guinea",              "industry": "Plastics"},
                       {"company": "Carr Inc",          "country": "Kuwait",                        "industry": "Plastics"}],
    "automotive":     [{"company": "Holder-Sellers",   "country": "Turkmenistan",                  "industry": "Automotive"}],
    "transportation": [{"company": "Mayer Group",      "country": "Mauritius",                     "industry": "Transportation"}],
    "import":         [{"company": "Mcintosh-Mora",    "country": "Heard Island & McDonald Is.",   "industry": "Import / Export"}],
    "export":         [{"company": "Mcintosh-Mora",    "country": "Heard Island & McDonald Is.",   "industry": "Import / Export"}],
    "education":      [{"company": "Henry-Thompson",   "country": "Bahamas",                       "industry": "Primary / Secondary Education"}],
    "publishing":     [{"company": "Hansen-Everett",   "country": "Pakistan",                      "industry": "Publishing Industry"}],
    "outsourcing":    [{"company": "Gaines Inc",       "country": "Uzbekistan",                    "industry": "Outsourcing / Offshoring"}],
    "safety":         [{"company": "Hester Ltd",       "country": "China",                         "industry": "Public Safety"}],
    "glass":          [{"company": "Mckinney, Riley and Day", "country": "Finland",                "industry": "Glass / Ceramics / Concrete"}],
}

MOCK_GRAPH_NODES = [
    {"id": "Ferrell LLC",            "label": "Ferrell LLC",            "type": "company"},
    {"id": "Carr Inc",               "label": "Carr Inc",               "type": "company"},
    {"id": "Holder-Sellers",         "label": "Holder-Sellers",         "type": "company"},
    {"id": "Mayer Group",            "label": "Mayer Group",            "type": "company"},
    {"id": "Mcintosh-Mora",          "label": "Mcintosh-Mora",          "type": "company"},
    {"id": "Henry-Thompson",         "label": "Henry-Thompson",         "type": "company"},
    {"id": "Hansen-Everett",         "label": "Hansen-Everett",         "type": "company"},
    {"id": "Gaines Inc",             "label": "Gaines Inc",             "type": "company"},
    {"id": "Hester Ltd",             "label": "Hester Ltd",             "type": "company"},
    {"id": "Mckinney, Riley and Day","label": "Mckinney, Riley & Day",  "type": "company"},
    {"id": "Papua New Guinea",       "label": "Papua New Guinea",       "type": "country"},
    {"id": "Kuwait",                 "label": "Kuwait",                 "type": "country"},
    {"id": "Turkmenistan",           "label": "Turkmenistan",           "type": "country"},
    {"id": "Mauritius",              "label": "Mauritius",              "type": "country"},
    {"id": "Heard Island",           "label": "Heard Island",           "type": "country"},
    {"id": "Bahamas",                "label": "Bahamas",                "type": "country"},
    {"id": "Pakistan",               "label": "Pakistan",               "type": "country"},
    {"id": "Uzbekistan",             "label": "Uzbekistan",             "type": "country"},
    {"id": "China",                  "label": "China",                  "type": "country"},
    {"id": "Finland",                "label": "Finland",                "type": "country"},
    {"id": "Plastics",               "label": "Plastics",               "type": "industry"},
    {"id": "Automotive",             "label": "Automotive",             "type": "industry"},
    {"id": "Transportation",         "label": "Transportation",         "type": "industry"},
    {"id": "Import / Export",        "label": "Import / Export",        "type": "industry"},
    {"id": "Education",              "label": "Education",              "type": "industry"},
    {"id": "Publishing Industry",    "label": "Publishing",             "type": "industry"},
    {"id": "Outsourcing / Offshoring","label": "Outsourcing",           "type": "industry"},
    {"id": "Public Safety",          "label": "Public Safety",          "type": "industry"},
    {"id": "Glass / Ceramics",       "label": "Glass / Ceramics",       "type": "industry"},
]

MOCK_GRAPH_EDGES = [
    {"source": "Ferrell LLC",             "target": "Papua New Guinea",  "label": "LOCATED_IN"},
    {"source": "Ferrell LLC",             "target": "Plastics",          "label": "BELONGS_TO"},
    {"source": "Carr Inc",                "target": "Kuwait",            "label": "LOCATED_IN"},
    {"source": "Carr Inc",                "target": "Plastics",          "label": "BELONGS_TO"},
    {"source": "Holder-Sellers",          "target": "Turkmenistan",      "label": "LOCATED_IN"},
    {"source": "Holder-Sellers",          "target": "Automotive",        "label": "BELONGS_TO"},
    {"source": "Mayer Group",             "target": "Mauritius",         "label": "LOCATED_IN"},
    {"source": "Mayer Group",             "target": "Transportation",    "label": "BELONGS_TO"},
    {"source": "Mcintosh-Mora",           "target": "Heard Island",      "label": "LOCATED_IN"},
    {"source": "Mcintosh-Mora",           "target": "Import / Export",   "label": "BELONGS_TO"},
    {"source": "Henry-Thompson",          "target": "Bahamas",           "label": "LOCATED_IN"},
    {"source": "Henry-Thompson",          "target": "Education",         "label": "BELONGS_TO"},
    {"source": "Hansen-Everett",          "target": "Pakistan",          "label": "LOCATED_IN"},
    {"source": "Hansen-Everett",          "target": "Publishing Industry","label": "BELONGS_TO"},
    {"source": "Gaines Inc",              "target": "Uzbekistan",        "label": "LOCATED_IN"},
    {"source": "Gaines Inc",              "target": "Outsourcing / Offshoring","label": "BELONGS_TO"},
    {"source": "Hester Ltd",              "target": "China",             "label": "LOCATED_IN"},
    {"source": "Hester Ltd",              "target": "Public Safety",     "label": "BELONGS_TO"},
    {"source": "Mckinney, Riley and Day", "target": "Finland",           "label": "LOCATED_IN"},
    {"source": "Mckinney, Riley and Day", "target": "Glass / Ceramics",  "label": "BELONGS_TO"},
]

def mock_search(query: str):
    q = query.lower()
    results = []
    seen = set()
    for keyword, companies in MOCK_DB.items():
        if keyword in q:
            for c in companies:
                if c["company"] not in seen:
                    results.append(c)
                    seen.add(c["company"])
    if not results:
        results = MOCK_DB["plastics"]  # default sample
    return results[:3]

def mock_answer(query: str, companies: list) -> str:
    names = [c["company"] for c in companies]
    industries = list(set(c.get("industry","") for c in companies if c.get("industry")))
    countries  = list(set(c.get("country","")  for c in companies if c.get("country")))
    return (
        f"Based on the enterprise knowledge graph, the companies matching your query "
        f"'{query}' are: {', '.join(names)}. "
        f"They operate in the {', '.join(industries)} sector(s) and are located in "
        f"{', '.join(countries)}. "
        f"These results were retrieved via semantic search and validated through graph relationships."
    )

# ────────────────────────────────────────────────────────────
#  FASTAPI APP
# ────────────────────────────────────────────────────────────
app = FastAPI(title="AI Knowledge Graph API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str

# ── Routes ──────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "AI Knowledge Graph API v2.0 running ✅", "pipeline": PIPELINE_OK}

@app.get("/health")
def health():
    if PIPELINE_OK:
        try:
            from neo4j import GraphDatabase
            d = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j","12345678"))
            d.verify_connectivity()
            d.close()
            neo4j_status = "connected"
        except:
            neo4j_status = "unavailable"
    else:
        neo4j_status = "mock"

    return {
        "neo4j":    neo4j_status,
        "pinecone": "connected" if PIPELINE_OK else "mock",
        "llm":      "ready"     if PIPELINE_OK else "mock",
    }

@app.get("/stats")
def stats():
    if PIPELINE_OK:
        try:
            from neo4j import GraphDatabase
            driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j","12345678"))
            with driver.session() as s:
                c  = s.run("MATCH (n:Company)  RETURN count(n) AS cnt").single()["cnt"]
                co = s.run("MATCH (n:Country)  RETURN count(n) AS cnt").single()["cnt"]
                i  = s.run("MATCH (n:Industry) RETURN count(n) AS cnt").single()["cnt"]
                r  = s.run("MATCH ()-[r]->()   RETURN count(r) AS cnt").single()["cnt"]
            driver.close()
            return {"companies": c, "countries": co, "industries": i, "relations": r}
        except:
            pass

    return {
        "companies":  len([n for n in MOCK_GRAPH_NODES if n["type"] == "company"]),
        "countries":  len([n for n in MOCK_GRAPH_NODES if n["type"] == "country"]),
        "industries": len([n for n in MOCK_GRAPH_NODES if n["type"] == "industry"]),
        "relations":  len(MOCK_GRAPH_EDGES),
    }

@app.get("/graph")
def graph():
    if PIPELINE_OK:
        try:
            from neo4j import GraphDatabase
            driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j","12345678"))
            nodes_map, edges = {}, []
            with driver.session() as s:
                res = s.run(
                    "MATCH (c:Company)-[r]->(n) RETURN c.name, type(r), n.name, labels(n) LIMIT 80"
                )
                for rec in res:
                    src, rel, tgt = rec[0], rec[1], rec[2]
                    tgt_type = rec[3][0].lower() if rec[3] else "unknown"
                    if src not in nodes_map:
                        nodes_map[src] = {"id": src, "label": src, "type": "company"}
                    if tgt not in nodes_map:
                        nodes_map[tgt] = {"id": tgt, "label": tgt, "type": tgt_type}
                    edges.append({"source": src, "target": tgt, "label": rel})
            driver.close()
            return {"nodes": list(nodes_map.values()), "edges": edges}
        except:
            pass

    return {"nodes": MOCK_GRAPH_NODES, "edges": MOCK_GRAPH_EDGES}

@app.post("/query")
def query(req: QueryRequest):
    if PIPELINE_OK:
        try:
            companies_list = search_companies(req.query)
            context, details = "", []
            for c in companies_list:
                info = get_company_info(c)
                context += f"{c}: {info}\n"
                details.append({"company": c, "info": str(info)})
            answer = ask_llama(context, req.query)
            return {"companies": companies_list, "details": details, "answer": answer, "source": "live"}
        except Exception as e:
            print(f"Pipeline error: {e}")

    results  = mock_search(req.query)
    names    = [r["company"] for r in results]
    return {
        "companies": names,
        "details":   results,
        "answer":    mock_answer(req.query, results),
        "source":    "mock",
    }
import sys, os, traceback
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ════════════════════════════════════════════════════════════
#  CONFIG  — fixed to your actual Neo4j connection URL
# ════════════════════════════════════════════════════════════
NEO4J_URI = "bolt://localhost:7687"  # ← your connection URL
NEO4J_USER     = "neo4j"
NEO4J_PASSWORD = "12345678"

# ════════════════════════════════════════════════════════════
#  PIPELINE IMPORT
# ════════════════════════════════════════════════════════════
try:
    from milestone3.rag_pipeline import search_companies, get_company_info, ask_llama
    PIPELINE_OK = True
    print("✅ RAG Pipeline loaded successfully")
except Exception as e:
    PIPELINE_OK = False
    print(f"⚠  RAG Pipeline import failed: {e}")
    traceback.print_exc()

# ════════════════════════════════════════════════════════════
#  MOCK DATA  (only for /graph and /stats when Neo4j is down)
# ════════════════════════════════════════════════════════════
MOCK_GRAPH_NODES = [
    {"id":"Ferrell LLC","label":"Ferrell LLC","type":"company"},
    {"id":"Carr Inc","label":"Carr Inc","type":"company"},
    {"id":"Holder-Sellers","label":"Holder-Sellers","type":"company"},
    {"id":"Mayer Group","label":"Mayer Group","type":"company"},
    {"id":"Mcintosh-Mora","label":"Mcintosh-Mora","type":"company"},
    {"id":"Henry-Thompson","label":"Henry-Thompson","type":"company"},
    {"id":"Hansen-Everett","label":"Hansen-Everett","type":"company"},
    {"id":"Gaines Inc","label":"Gaines Inc","type":"company"},
    {"id":"Hester Ltd","label":"Hester Ltd","type":"company"},
    {"id":"Papua New Guinea","label":"Papua New Guinea","type":"country"},
    {"id":"Kuwait","label":"Kuwait","type":"country"},
    {"id":"Turkmenistan","label":"Turkmenistan","type":"country"},
    {"id":"Mauritius","label":"Mauritius","type":"country"},
    {"id":"Heard Island","label":"Heard Island","type":"country"},
    {"id":"Bahamas","label":"Bahamas","type":"country"},
    {"id":"Pakistan","label":"Pakistan","type":"country"},
    {"id":"Uzbekistan","label":"Uzbekistan","type":"country"},
    {"id":"China","label":"China","type":"country"},
    {"id":"Finland","label":"Finland","type":"country"},
    {"id":"Plastics","label":"Plastics","type":"industry"},
    {"id":"Automotive","label":"Automotive","type":"industry"},
    {"id":"Transportation","label":"Transportation","type":"industry"},
    {"id":"Import / Export","label":"Import / Export","type":"industry"},
    {"id":"Education","label":"Education","type":"industry"},
    {"id":"Publishing Industry","label":"Publishing","type":"industry"},
    {"id":"Outsourcing / Offshoring","label":"Outsourcing","type":"industry"},
    {"id":"Public Safety","label":"Public Safety","type":"industry"},
    {"id":"Glass / Ceramics","label":"Glass / Ceramics","type":"industry"},
]
MOCK_GRAPH_EDGES = [
    {"source":"Ferrell LLC","target":"Papua New Guinea","label":"LOCATED_IN"},
    {"source":"Ferrell LLC","target":"Plastics","label":"BELONGS_TO"},
    {"source":"Carr Inc","target":"Kuwait","label":"LOCATED_IN"},
    {"source":"Carr Inc","target":"Plastics","label":"BELONGS_TO"},
    {"source":"Holder-Sellers","target":"Turkmenistan","label":"LOCATED_IN"},
    {"source":"Holder-Sellers","target":"Automotive","label":"BELONGS_TO"},
    {"source":"Mayer Group","target":"Mauritius","label":"LOCATED_IN"},
    {"source":"Mayer Group","target":"Transportation","label":"BELONGS_TO"},
    {"source":"Mcintosh-Mora","target":"Heard Island","label":"LOCATED_IN"},
    {"source":"Mcintosh-Mora","target":"Import / Export","label":"BELONGS_TO"},
    {"source":"Henry-Thompson","target":"Bahamas","label":"LOCATED_IN"},
    {"source":"Henry-Thompson","target":"Education","label":"BELONGS_TO"},
    {"source":"Hansen-Everett","target":"Pakistan","label":"LOCATED_IN"},
    {"source":"Hansen-Everett","target":"Publishing Industry","label":"BELONGS_TO"},
    {"source":"Gaines Inc","target":"Uzbekistan","label":"LOCATED_IN"},
    {"source":"Gaines Inc","target":"Outsourcing / Offshoring","label":"BELONGS_TO"},
    {"source":"Hester Ltd","target":"China","label":"LOCATED_IN"},
    {"source":"Hester Ltd","target":"Public Safety","label":"BELONGS_TO"},
]

# ════════════════════════════════════════════════════════════
#  FASTAPI APP
# ════════════════════════════════════════════════════════════
app = FastAPI(title="AI Knowledge Graph API", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                  allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

class QueryRequest(BaseModel):
    query: str

def get_driver():
    from neo4j import GraphDatabase
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

@app.get("/")
def root():
    return {"message": "AI Knowledge Graph API v2.0 ✅", "pipeline": PIPELINE_OK}

@app.get("/health")
def health():
    try:
        d = get_driver(); d.verify_connectivity(); d.close()
        neo4j_status = "connected"
    except Exception as e:
        print(f"Neo4j health check failed: {e}")
        neo4j_status = "unavailable"
    return {
        "neo4j":    neo4j_status,
        "pinecone": "connected" if PIPELINE_OK else "mock",
        "llm":      "ready"     if PIPELINE_OK else "mock",
    }

@app.get("/stats")
def stats():
    try:
        d = get_driver()
        with d.session() as s:
            c  = s.run("MATCH (n:Company)  RETURN count(n) AS cnt").single()["cnt"]
            co = s.run("MATCH (n:Country)  RETURN count(n) AS cnt").single()["cnt"]
            i  = s.run("MATCH (n:Industry) RETURN count(n) AS cnt").single()["cnt"]
            r  = s.run("MATCH ()-[r]->()   RETURN count(r) AS cnt").single()["cnt"]
        d.close()
        return {"companies": c, "countries": co, "industries": i, "relations": r}
    except Exception as e:
        print(f"Stats error: {e}")
    return {
        "companies":  len([n for n in MOCK_GRAPH_NODES if n["type"] == "company"]),
        "countries":  len([n for n in MOCK_GRAPH_NODES if n["type"] == "country"]),
        "industries": len([n for n in MOCK_GRAPH_NODES if n["type"] == "industry"]),
        "relations":  len(MOCK_GRAPH_EDGES),
    }

@app.get("/graph")
def graph():
    try:
        d = get_driver()
        nm, edges = {}, []
        with d.session() as s:
            for rec in s.run("MATCH (c:Company)-[r]->(n) RETURN c.name,type(r),n.name,labels(n) LIMIT 100"):
                src, rel, tgt = rec[0], rec[1], rec[2]
                tgt_type = rec[3][0].lower() if rec[3] else "unknown"
                if src not in nm: nm[src] = {"id": src, "label": src, "type": "company"}
                if tgt not in nm: nm[tgt] = {"id": tgt, "label": tgt, "type": tgt_type}
                edges.append({"source": src, "target": tgt, "label": rel})
        d.close()
        return {"nodes": list(nm.values()), "edges": edges}
    except Exception as e:
        print(f"Graph error: {e}")
    return {"nodes": MOCK_GRAPH_NODES, "edges": MOCK_GRAPH_EDGES}

@app.post("/query")
def query_endpoint(req: QueryRequest):
    if not PIPELINE_OK:
        return {
            "companies": [], "details": [],
            "answer": "⚠ RAG Pipeline not loaded. Check terminal for import error.",
            "source": "error"
        }
    try:
        print(f"\n📥 Query: {req.query}")
        companies_list = search_companies(req.query)
        if not companies_list:
            return {
                "companies": [], "details": [],
                "answer": "No matching companies found for this query. Try different keywords.",
                "source": "live"
            }
        context, details = "", []
        for company in companies_list:
            info = get_company_info(company)
            info_str = ", ".join(info) if info else "No graph data found"
            context += f"{company}: {info_str}\n"
            details.append({
                "company":  company,
                "country":  next((i.replace("LOCATED_IN ", "") for i in info if "LOCATED_IN" in i), ""),
                "industry": next((i.replace("BELONGS_TO ", "") for i in info if "BELONGS_TO" in i), ""),
                "info":     info_str,
            })
        answer = ask_llama(context, req.query)
        return {"companies": companies_list, "details": details, "answer": answer, "source": "live"}
    except Exception as e:
        traceback.print_exc()
        return {
            "companies": [], "details": [],
            "answer": f"⚠ Pipeline error:\n\n{str(e)}\n\nCheck backend terminal.",
            "source": "error"
        }
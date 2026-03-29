from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
from neo4j import GraphDatabase
from functools import lru_cache
import requests
import traceback

# CONFIG
PINECONE_API_KEY = "pcsk_9akAT_C35cK2NN9iDwqWNcaK8zJ29Psewunc7Ym1Y8BpNncxe3GegwcodZdE5SidgJkYU"
INDEX_NAME       = "sathish"
NEO4J_URI        = "bolt://localhost:7687"
NEO4J_USER       = "neo4j"
NEO4J_PASSWORD   = "12345678"
OLLAMA_URL       = "http://localhost:11434/api/generate"
OLLAMA_MODEL     = "llama3"

# INIT
pc     = Pinecone(api_key=PINECONE_API_KEY)
index  = pc.Index(INDEX_NAME)
driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

@lru_cache(maxsize=1)          # single import, single init
def get_model():
    print("Loading embedding model...")
    m = SentenceTransformer("all-MiniLM-L6-v2")
    print("Embedding model loaded")
    return m

model = get_model()

# STEP 1 — Semantic Search
def search_companies(query: str) -> list:
    try:
        query_vector = model.encode(query).tolist()
        results = index.query(vector=query_vector, top_k=3, include_metadata=True)  # FIX: was 2
        companies = []
        for match in results["matches"]:
            name = match["metadata"].get("company")
            if name and name not in companies:
                companies.append(name)
        print(f"Pinecone matched: {companies}")
        return companies
    except Exception as e:
        print(f"Pinecone error: {e}")
        traceback.print_exc()
        raise

# STEP 2 — Graph Query
def get_company_info(company: str) -> list:
    try:
        cypher = """
        MATCH (c:Company {name: $company})-[r]->(n)
        RETURN type(r) AS relation, n.name AS value
        """
        with driver.session() as session:
            result = session.run(cypher, company=company)
            data = [f"{rec['relation']} {rec['value']}" for rec in result]
        print(f"Neo4j -> {company}: {data}")
        return data
    except Exception as e:
        print(f"Neo4j error for '{company}': {e}")
        traceback.print_exc()
        raise

# STEP 3 — LLaMA Answer  FIX: single definition, timeout, strict prompt
def ask_llama(context: str, question: str) -> str:
    prompt = f"""You are a precise AI assistant for an enterprise knowledge graph system.

STRICT RULES:
1. Answer ONLY using facts from the CONTEXT below.
2. Do NOT add any information not in the CONTEXT.
3. Do NOT guess, assume, or invent company details.
4. If context is insufficient say: "The knowledge graph does not have enough data to answer this."
5. Keep your answer short and factual.

CONTEXT (from knowledge graph):
{context}

QUESTION: {question}

ANSWER (based strictly on context above):"""

    try:
        response = requests.post(
            OLLAMA_URL,
            json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=60    # FIX: was missing
        )
        if response.status_code != 200:
            return f"Ollama HTTP error {response.status_code}: {response.text[:200]}"
        data = response.json()
        if "response" in data:
            return data["response"].strip()
        return f"Unexpected Ollama response: {list(data.keys())}"
    except requests.exceptions.ConnectionError:
        return "Ollama is not running. Run: ollama serve\nThen: ollama run llama3"
    except requests.exceptions.Timeout:
        return "Ollama timed out (>60s). Model may still be loading — try again."
    except Exception as e:
        traceback.print_exc()
        return f"LLM error: {e}"

# MAIN CLI
def run():
    print("\nAI Knowledge Graph CLI\n")
    while True:
        question = input("Ask a question (or quit): ").strip()
        if question.lower() in ("quit", "exit", "q"):
            break
        if not question:
            continue
        companies = search_companies(question)
        if not companies:
            print("No companies found.")
            continue
        context = ""
        for c in companies:
            info = get_company_info(c)
            context += f"{c}: {', '.join(info)}\n"   # FIX: join list to string
        print(f"\nAnswer:\n{ask_llama(context, question)}\n")

if __name__ == "__main__":
    run()
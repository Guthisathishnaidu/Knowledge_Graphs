from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
from neo4j import GraphDatabase
import requests

#  CONFIG


PINECONE_API_KEY = "pcsk_9akAT_C35cK2NN9iDwqWNcaK8zJ29Psewunc7Ym1Y8BpNncxe3GegwcodZdE5SidgJkYU"
INDEX_NAME = "sathish"

NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "12345678"

OLLAMA_URL = "http://localhost:11434/api/generate"

# INIT


pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

model = SentenceTransformer("all-MiniLM-L6-v2")

driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(NEO4J_USER, NEO4J_PASSWORD)
)


# STEP 1 — Semantic Search


def search_companies(query):

    query_vector = model.encode(query).tolist()

    results = index.query(
        vector=query_vector,
        top_k=3,
        include_metadata=True
    )

    companies = []

    for match in results["matches"]:
        companies.append(match["metadata"]["company"])

    return companies


# STEP 2 — Graph Query


def get_company_info(company):

    query = """
    MATCH (c:Company {name:$company})-[r]->(n)
    RETURN type(r) AS relation, n.name AS value
    """

    with driver.session() as session:
        result = session.run(query, company=company)

        data = []
        for record in result:
            data.append(f"{record['relation']} {record['value']}")

        return data


#  STEP 3 — LLaMA Answer


def ask_llama(context, question):

    prompt = f"""
Answer clearly and professionally.

Context:
{context}

Question:
{question}

Give a short and direct answer.
"""

    response = requests.post(
        OLLAMA_URL,
        json={
            "model": "llama3",
            "prompt": prompt,
            "stream": False
        }
    )

    return response.json()["response"]

#  MAIN PIPELINE


def run():

    while True:

        question = input("\nAsk a question: ")

        # Step 1
        companies = search_companies(question)

        # Step 2
        context = ""

        for company in companies:
            info = get_company_info(company)
            context += f"{company}: {info}\n"

        # Step 3
        answer = ask_llama(context, question)

        print("\n🤖 Answer:\n", answer)


if __name__ == "__main__":
    run()
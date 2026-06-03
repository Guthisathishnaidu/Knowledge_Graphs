from sentence_transformers import SentenceTransformer
from pinecone import Pinecone

PINECONE_API_KEY = "pcsk_9akAT_C35cK2NN9iDwqWNcaK8zJ29Psewunc7Ym1Y8BpNncxe3GegwcodZdE5SidgJkYU"
INDEX_NAME       = "sathish"

# FIX: wrapped in main guard — was running on every import
if __name__ == "__main__":
    pc    = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)
    model = SentenceTransformer("all-MiniLM-L6-v2")

    query        = "plastic companies"
    query_vector = model.encode(query).tolist()

    results = index.query(vector=query_vector, top_k=5, include_metadata=True)

    print("\nTop Results:\n")
    for match in results["matches"]:
        print(match["metadata"]["company"])
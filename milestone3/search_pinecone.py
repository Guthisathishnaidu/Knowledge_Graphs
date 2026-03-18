from sentence_transformers import SentenceTransformer
from pinecone import Pinecone

# 🔑 Your API Key
PINECONE_API_KEY = "pcsk_9akAT_C35cK2NN9iDwqWNcaK8zJ29Psewunc7Ym1Y8BpNncxe3GegwcodZdE5SidgJkYU"

# 📦 Your index name
INDEX_NAME = "sathish"

# Initialize Pinecone
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

# Load model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Query
query = "plastic companies"

query_vector = model.encode(query).tolist()

# Search
results = index.query(
    vector=query_vector,
    top_k=5,
    include_metadata=True
)

print("\nTop Results:\n")

for match in results["matches"]:
    print(match["metadata"]["company"])
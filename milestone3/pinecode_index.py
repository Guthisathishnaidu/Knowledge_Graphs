import pandas as pd
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone

# Pinecone Configuration


PINECONE_API_KEY = "pcsk_9akAT_C35cK2NN9iDwqWNcaK8zJ29Psewunc7Ym1Y8BpNncxe3GegwcodZdE5SidgJkYU"
INDEX_NAME = "sathish"


# Initialize Pinecone


pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(INDEX_NAME)

# Load Dataset


df = pd.read_csv("../data/processed/processed_companies.csv")

# Combine text fields
df["text"] = (
    df["name"].astype(str) + " " +
    df["industry"].astype(str) + " " +
    df["country"].astype(str) + " " +
    df["description"].astype(str)
)

# Load Embedding Model


model = SentenceTransformer("all-MiniLM-L6-v2")

# Generate Embeddings


print("Generating embeddings...")
embeddings = model.encode(df["text"].tolist())


# Upload to Pinecone


print("Uploading to Pinecone...")

vectors = []

for i, vector in enumerate(embeddings):
    vectors.append({
        "id": str(i),
        "values": vector.tolist(),
        "metadata": {
            "company": df.iloc[i]["name"],
            "text": df.iloc[i]["text"]
        }
    })

# Upload (batch)
index.upsert(vectors=vectors)

print("✅ Upload complete!")
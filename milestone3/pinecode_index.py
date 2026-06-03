import os
import pandas as pd
from sentence_transformers import SentenceTransformer
from pinecone import Pinecone

PINECONE_API_KEY = "pcsk_9akAT_C35cK2NN9iDwqWNcaK8zJ29Psewunc7Ym1Y8BpNncxe3GegwcodZdE5SidgJkYU"
INDEX_NAME       = "sathish"

# FIX: wrapped in main guard — was running on every import
if __name__ == "__main__":
    pc    = Pinecone(api_key=PINECONE_API_KEY)
    index = pc.Index(INDEX_NAME)

    csv_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "data", "processed", "processed_companies.csv")
    )
    df = pd.read_csv(csv_path)

    df["text"] = (
        df["name"].astype(str) + " " +
        df["industry"].astype(str) + " " +
        df["country"].astype(str) + " " +
        df["description"].astype(str)
    )

    model = SentenceTransformer("all-MiniLM-L6-v2")

    print("Generating embeddings...")
    embeddings = model.encode(df["text"].tolist(), show_progress_bar=True)

    print("Uploading to Pinecone...")
    vectors = []
    for i, vector in enumerate(embeddings):
        vectors.append({
            "id": str(i),
            "values": vector.tolist(),
            "metadata": {
                "company": df.iloc[i]["name"],
                "text":    df.iloc[i]["text"]
            }
        })

    BATCH_SIZE = 100
    total = len(vectors)
    for start in range(0, total, BATCH_SIZE):
        batch = vectors[start : start + BATCH_SIZE]
        index.upsert(vectors=batch)
        print(f"  Uploaded {min(start + BATCH_SIZE, total)}/{total}")

    print("Upload complete!")
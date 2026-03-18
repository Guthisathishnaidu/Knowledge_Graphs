# 🧠 AI Knowledge Graph with RAG (Neo4j + Pinecone + LLaMA)

## 📌 Project Overview

This project builds an intelligent AI system that combines:

- Knowledge Graph (Neo4j)
- Semantic Search (Pinecone)
- Large Language Model (LLaMA via Ollama)

It enables users to ask natural language questions and get accurate answers using a **Retrieval-Augmented Generation (RAG)** pipeline.

---

## 🚀 Features

✅ Build Knowledge Graph from company dataset  
✅ Perform Semantic Search using embeddings  
✅ Query structured graph data  
✅ Generate intelligent answers using LLaMA  
✅ End-to-end AI system (Graph + Vector DB + LLM)

## 🧩 Milestones

### ✅ Milestone 1 — Data Processing
- Data cleaning and preprocessing
- Stored in `data/processed/processed_companies.csv`

---

### ✅ Milestone 2 — Knowledge Graph (Neo4j)
- Extract entities (Company, Country, Industry)
- Build graph relationships:
  - `LOCATED_IN`
  - `BELONGS_TO`

Run:
```bash
cd milestone2_graph
python build_graph.py
```


# ✅ Milestone 3 — Semantic Search + RAG

This project Milestone 3 combines:
- Knowledge Graph (Neo4j)
- Semantic Search (Pinecone)
- LLM (LLaMA via Ollama)
- RAG Pipeline

🔹 Step 1: Upload embeddings
cd milestone3_rag
python pinecone_index.py

🔹 Step 2: Test semantic search
python search_pinecone.py

🔹 Step 3: Run full RAG system
python rag_pipeline.py


🛠️ Technologies Used
Python

Neo4j (Graph Database)

Pinecone (Vector Database)

Sentence Transformers (Embeddings)

Ollama (LLaMA Model)

Pandas



🧠 How It Works
User Query
   ↓
Embedding Model (Sentence Transformers)
   ↓
Pinecone (Semantic Search)
   ↓
Top Relevant Companies
   ↓
Neo4j (Graph Query)
   ↓
Context Retrieval
   ↓
LLaMA (Ollama)
   ↓
Final Answer
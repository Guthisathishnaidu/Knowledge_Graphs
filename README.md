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
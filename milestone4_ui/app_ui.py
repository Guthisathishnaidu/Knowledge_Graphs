import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import streamlit as st

# FIX: set_page_config MUST be the very first Streamlit call
st.set_page_config(page_title="AI Knowledge Graph", page_icon="🧠", layout="wide")

from milestone3.rag_pipeline import search_companies, get_company_info, ask_llama, get_model

@st.cache_resource
def load_model():
    return get_model()

load_model()

st.markdown("""
<style>
.card { background-color:#1c1f26; padding:20px; border-radius:10px; margin-bottom:10px; }
.answer-box { background-color:#163d2b; padding:20px; border-radius:10px; color:#d4f5e9; }
</style>
""", unsafe_allow_html=True)

st.markdown("# 🧠 AI Knowledge Graph Builder")
st.caption("Enterprise Intelligence Platform")

col1, col2, col3 = st.columns(3)
with col1: st.markdown('<div class="card">🟢 <b>Neo4j</b><br>Running</div>', unsafe_allow_html=True)
with col2: st.markdown('<div class="card">🔵 <b>Pinecone</b><br>Connected</div>', unsafe_allow_html=True)
with col3: st.markdown('<div class="card">🧠 <b>LLM</b><br>Ready</div>', unsafe_allow_html=True)

st.markdown("---")
st.markdown("## 🔍 Ask Business Question")
query = st.text_input("", placeholder="e.g. Which companies are in plastics industry?")

if query:
    with st.spinner("🤖 Analyzing enterprise data..."):
        companies = search_companies(query)
        col_left, col_right = st.columns([1, 2])
        with col_left:
            st.markdown("### 📌 Top Matches")
            for c in companies:
                st.markdown(f'<div class="card">✅ {c}</div>', unsafe_allow_html=True)
        with col_right:
            context = ""
            for company in companies:
                info = get_company_info(company)
                context += f"{company}: {', '.join(info)}\n"
            answer = ask_llama(context, query)
            st.markdown("### 🤖 AI Insight")
            st.markdown(f'<div class="answer-box">{answer}</div>', unsafe_allow_html=True)

if st.button("📊 Show Knowledge Graph"):
    from milestone4_ui.graph_visualization import show_graph
    graph_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "graph.html"))
    show_graph(graph_path)
    try:
        with open(graph_path, "r", encoding="utf-8") as f:
            html = f.read()
        st.components.v1.html(html, height=500)
    except FileNotFoundError:
        st.error("Graph file not found.")

st.markdown("---")
st.caption("© 2026 AI Knowledge Graph | Enterprise AI System")
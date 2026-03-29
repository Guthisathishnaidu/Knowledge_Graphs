from pyvis.network import Network
from neo4j import GraphDatabase

def show_graph():
    driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "12345678"))
    net    = Network(height="500px", width="100%", notebook=False)
    query  = "MATCH (c:Company)-[r]->(n) RETURN c.name, type(r), n.name LIMIT 100"  # FIX: was 20

    added_nodes = set()   # FIX: prevent duplicate nodes

    with driver.session() as session:
        for record in session.run(query):
            src, rel, tgt = record[0], record[1], record[2]
            if src not in added_nodes:
                net.add_node(src, label=src, color="#2563eb")
                added_nodes.add(src)
            if tgt not in added_nodes:
                net.add_node(tgt, label=tgt, color="#0d9488")
                added_nodes.add(tgt)
            net.add_edge(src, tgt, label=rel)

    driver.close()   # FIX: was missing
    net.save_graph("graph.html")
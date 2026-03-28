from pyvis.network import Network
from neo4j import GraphDatabase

def show_graph():

    driver = GraphDatabase.driver(
        "bolt://localhost:7687",
        auth=("neo4j", "12345678")
    )

    net = Network(height="500px", width="100%", notebook=False)

    query = """
    MATCH (c:Company)-[r]->(n)
    RETURN c.name, type(r), n.name LIMIT 20
    """

    with driver.session() as session:
        result = session.run(query)

        for record in result:
            net.add_node(record[0])
            net.add_node(record[2])
            net.add_edge(record[0], record[2], label=record[1])

    net.save_graph("graph.html")
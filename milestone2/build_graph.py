import os
import json
import pandas as pd
import requests
import re
from neo4j import GraphDatabase


# Neo4j Configuration


NEO4J_URI = "bolt://localhost:7687"
NEO4J_USER = "neo4j"
NEO4J_PASSWORD = "12345678"

driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(NEO4J_USER, NEO4J_PASSWORD)
)


# LLaMA Entity Extraction


def extract_entities(row):

    prompt = f"""
Extract entities from this company data.

Name: {row['name']}
Country: {row['country']}
Industry: {row['industry']}
Description: {row['description']}

Return ONLY valid JSON in this format:

{{
 "company": "",
 "country": "",
 "industry": ""
}}
"""

    try:

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3",
                "prompt": prompt,
                "stream": False
            }
        )

        if response.status_code != 200:
            print("⚠ Ollama error:", response.text)
            return None

        result = response.json()

        if "response" not in result:
            print("⚠ Unexpected response:", result)
            return None

        content = result["response"]

        json_match = re.search(r'\{.*\}', content, re.DOTALL)

        if json_match:
            return json.loads(json_match.group())
        else:
            print("⚠ JSON not found in model output")
            return None

    except Exception as e:
        print("⚠ Extraction error:", e)
        return None



# Insert into Neo4j


def insert_graph(tx, company, country, industry):

    tx.run("""
        MERGE (c:Company {name:$company})
        MERGE (co:Country {name:$country})
        MERGE (i:Industry {name:$industry})
        MERGE (c)-[:LOCATED_IN]->(co)
        MERGE (c)-[:BELONGS_TO]->(i)
    """, company=company, country=country, industry=industry)


def build_graph(entity_json):

    if entity_json is None:
        return

    with driver.session() as session:
        session.execute_write(
            insert_graph,
            entity_json["company"],
            entity_json["country"],
            entity_json["industry"]
        )



# Main Pipeline


def run():

    print("Reading dataset...")

    df = pd.read_csv("../data/processed/processed_companies.csv")

    df.columns = df.columns.str.strip().str.lower().str.replace(" ", "_")

    for index, row in df.iterrows():

        print(f"Processing: {row['name']}")

        entity_json = extract_entities(row)

        build_graph(entity_json)

    print("Graph successfully built!")


if __name__ == "__main__":
    run()
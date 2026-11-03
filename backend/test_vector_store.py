
from text_chunker import chunk_text
from embedding_service import (
    generate_embeddings,
    generate_embedding
)
from vector_store import store_chunks, search_chunks


# Sample DBMS content
sample_text = """
Database normalization reduces data redundancy.
First Normal Form requires atomic values.
Second Normal Form removes partial dependencies.
Third Normal Form removes transitive dependencies.
""" * 20


# STEP 1: Split text into chunks
chunks = chunk_text(
    sample_text,
    chunk_size=100,
    overlap=20
)

print("Total chunks:", len(chunks))


# STEP 2: Generate embeddings
texts = [chunk["text"] for chunk in chunks]

embeddings = generate_embeddings(texts)

print("Embeddings generated:", len(embeddings))


# STEP 3: Store chunks in ChromaDB
stored = store_chunks(
    chunks,
    embeddings,
    "DBMS_test"
)

print("Chunks stored:", stored)


# STEP 4: Generate embedding for search query
question = "What is database normalization?"

query_embedding = generate_embedding(question)


# STEP 5: Search ChromaDB
results = search_chunks(
    query_embedding,
    top_k=3
)


# STEP 6: Display retrieved results
print("\nQuestion:", question)
print("\nRelevant chunks:")

documents = results["documents"][0]
distances = results["distances"][0]
metadatas = results["metadatas"][0]

for index, document in enumerate(documents):

    print(f"\nResult {index + 1}")
    print("Distance:", round(distances[index], 4))
    print("Metadata:", metadatas[index])
    print("Content:", document[:300])


print("\nVector database test completed successfully!")

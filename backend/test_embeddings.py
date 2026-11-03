
from embedding_service import generate_embedding

sample_text = """
Database normalization reduces data redundancy
and improves database design.
"""

vector = generate_embedding(sample_text)

print("Embedding generated successfully!")
print("Vector dimensions:", len(vector))
print("First 10 values:", vector[:10])



from text_chunker import chunk_text

sample_text = """
Database Management Systems organize and manage data.
Normalization reduces data redundancy.
First Normal Form requires atomic values.
Second Normal Form removes partial dependencies.
Third Normal Form removes transitive dependencies.
""" * 50

chunks = chunk_text(
    sample_text,
    chunk_size=100,
    overlap=20
)

print("Total chunks:", len(chunks))

for chunk in chunks:

    print("\nChunk ID:", chunk["chunk_id"])
    print("Word count:", chunk["word_count"])
    print("Content:", chunk["text"][:150])

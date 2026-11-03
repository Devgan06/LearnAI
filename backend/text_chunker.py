def chunk_pages(pages, chunk_size=800, overlap=150):

    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("Invalid overlap value")

    all_chunks = []
    step = chunk_size - overlap

    for page in pages:

        words = page["text"].split()

        for start in range(0, len(words), step):

            end = start + chunk_size
            chunk_content = " ".join(words[start:end])

            if chunk_content.strip():
                all_chunks.append({
                    "chunk_id": len(all_chunks),
                    "page_number": page["page_number"],
                    "text": chunk_content,
                    "word_count": len(chunk_content.split())
                })

    return all_chunks
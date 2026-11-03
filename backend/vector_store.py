
import chromadb

client = chromadb.PersistentClient(
    path="./chroma_db"
)

collection = client.get_or_create_collection(
    name="learning_documents",
    metadata={"hnsw:space": "cosine"}
)


def store_chunks(chunks, embeddings, document_name, document_id=None):

    if len(chunks) != len(embeddings):
        raise ValueError("Chunks and embeddings count must match")

    if not chunks:
        return 0

    if not document_id:
        raise ValueError("A unique document_id is required")

    ids = []
    documents = []
    metadatas = []

    for chunk in chunks:

        ids.append(f"{document_id}_{chunk['chunk_id']}")
        documents.append(chunk["text"])

        metadatas.append({
            "document_id": document_id,
            "document_name": document_name,
            "chunk_id": chunk["chunk_id"],
            "page_number": chunk["page_number"],
            "word_count": chunk["word_count"]
        })

    collection.upsert(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

    return len(ids)


def list_documents():

    results = collection.get(
        include=["metadatas"]
    )

    documents = {}

    for metadata in results.get("metadatas", []):

        if not metadata:
            continue

        name = metadata.get("document_name", "Unknown document")

        document_id = metadata.get(
            "document_id",
            f"legacy:{name}"
        )

        if document_id not in documents:
            documents[document_id] = {
                "document_id": document_id,
                "filename": name,
                "total_chunks": 0,
                "total_pages": 0
            }

        documents[document_id]["total_chunks"] += 1

        documents[document_id]["total_pages"] = max(
            documents[document_id]["total_pages"],
            metadata.get("page_number", 0)
        )

    return list(documents.values())


def delete_document(document_id):

    if not document_id:
        raise ValueError("Document ID is required")

    # New documents: delete only chunks belonging to this exact ID.
    if not document_id.startswith("legacy:"):

        results = collection.get(
            where={"document_id": document_id},
            include=[]
        )

        ids = results.get("ids", [])

        if ids:
            collection.delete(ids=ids)

        return len(ids)

    # Legacy documents: delete only records without document_id.
    # This prevents deleting newer documents with the same filename.
    document_name = document_id.replace("legacy:", "", 1)

    results = collection.get(
        include=["metadatas"]
    )

    ids_to_delete = []

    for chunk_id, metadata in zip(
        results.get("ids", []),
        results.get("metadatas", [])
    ):

        if not metadata:
            continue

        if (
            metadata.get("document_name") == document_name
            and "document_id" not in metadata
        ):
            ids_to_delete.append(chunk_id)

    if ids_to_delete:
        collection.delete(ids=ids_to_delete)

    return len(ids_to_delete)


def search_chunks(
    query_embedding,
    document_ids=None,
    document_name=None,
    top_k=4
):

    where_filter = None

    selected_ids = document_ids or []

    new_ids = [
        item for item in selected_ids
        if not item.startswith("legacy:")
    ]

    legacy_names = [
        item.replace("legacy:", "", 1)
        for item in selected_ids
        if item.startswith("legacy:")
    ]

    conditions = []

    if new_ids:
        conditions.append({
            "document_id": {"$in": new_ids}
        })

    if legacy_names:
        conditions.append({
            "document_name": {"$in": legacy_names}
        })

    if conditions:
        if len(conditions) == 1:
            where_filter = conditions[0]
        else:
            where_filter = {"$or": conditions}

    elif document_name:
        where_filter = {
            "document_name": document_name
        }

    query_args = {
        "query_embeddings": [query_embedding],
        "n_results": top_k
    }

    if where_filter:
        query_args["where"] = where_filter

    return collection.query(**query_args)


import os

from dotenv import load_dotenv
from openai import OpenAI

from embedding_service import generate_embedding
from vector_store import search_chunks

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


def answer_question(
    question: str,
    document_ids=None,
    topic: str = "",
    document_name: str = None
):

    search_query = question

    if topic.strip():
        search_query = f"Learning topic: {topic}\nQuestion: {question}"

    query_embedding = generate_embedding(search_query)

    results = search_chunks(
        query_embedding=query_embedding,
        document_ids=document_ids,
        document_name=document_name,
        top_k=6
    )

    documents = results["documents"][0]
    metadatas = results["metadatas"][0]

    if not documents:
        return {
            "answer": "I couldn't find relevant information in your selected study materials.",
            "sources": []
        }

    context_parts = []

    for index, document in enumerate(documents):

        metadata = metadatas[index]

        page_number = metadata.get("page_number", "Unknown")
        document_name = metadata.get("document_name", "Unknown document")

        context_parts.append(
            f"[Source: {document_name}, Page {page_number}]\n{document}"
        )

    context = "\n\n".join(context_parts)

    topic_instruction = ""

    if topic.strip():
        topic_instruction = (
            f"The student's learning topic is: {topic}.\n"
            "Give particular attention to this topic while answering.\n"
        )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": f"""
You are LearnAI, an educational AI tutor.

Answer the student's question using ONLY the
provided study material.

{topic_instruction}

Instructions:
- Explain concepts clearly using simple language.
- Organize explanations when useful.
- Do not invent facts missing from the context.
- If the answer is not supported by the context,
  clearly say so.
- Do not invent source page numbers.
- Use information from all relevant selected documents.
"""
            },
            {
                "role": "user",
                "content": f"""
Study material:

{context}

Student question:
{question}

Provide a clear educational answer.
"""
            }
        ],
        temperature=0.2
    )

    answer = response.choices[0].message.content

    sources = []

    for metadata in metadatas:

        source = {
            "document": metadata.get("document_name", "Unknown document"),
            "page": metadata.get("page_number", "Unknown")
        }

        if source not in sources:
            sources.append(source)

    return {
        "answer": answer,
        "sources": sources
    }
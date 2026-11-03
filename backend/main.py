

from uuid import uuid4
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from pdf_processor import extract_pages_from_pdf
from text_chunker import chunk_pages
from embedding_service import generate_embeddings
from vector_store import store_chunks, list_documents, delete_document
from qa_service import answer_question
from quiz_service import generate_quiz


app = FastAPI(
    title="AI Learning Companion",
    description="AI-powered personalized learning platform",
    version="2.1.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QuestionRequest(BaseModel):
    question: str
    document_ids: List[str] = Field(default_factory=list)
    topic: str = ""


class QuizRequest(BaseModel):
    document_ids: List[str] = Field(default_factory=list)
    topic: str = ""
    num_questions: int = Field(default=5, ge=5, le=20)


@app.get("/")
def home():
    return {
        "message": "Welcome to AI Learning Companion!"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.get("/documents")
def get_documents():
    try:
        return {
            "documents": list_documents()
        }

    except Exception as error:
        print("Document listing error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve documents"
        )


@app.delete("/documents/{document_id}")
def remove_document(document_id: str):

    try:
        # Confirm the document exists before deleting.
        existing_documents = list_documents()

        document_exists = any(
            document["document_id"] == document_id
            for document in existing_documents
        )

        if not document_exists:
            raise HTTPException(
                status_code=404,
                detail="Document not found"
            )

        deleted_count = delete_document(document_id)

        if deleted_count == 0:
            raise HTTPException(
                status_code=404,
                detail="No indexed chunks found for this document"
            )

        return {
            "message": "Document deleted successfully",
            "document_id": document_id,
            "deleted_chunks": deleted_count
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Document deletion error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to delete document"
        )


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )

    pdf_bytes = await file.read()

    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="PDF exceeds 10 MB limit"
        )

    try:
        pages = extract_pages_from_pdf(pdf_bytes)

        if not pages:
            raise HTTPException(
                status_code=422,
                detail="No selectable text found in PDF"
            )

        chunks = chunk_pages(
            pages,
            chunk_size=800,
            overlap=150
        )

        texts = [chunk["text"] for chunk in chunks]

        embeddings = generate_embeddings(texts)

        document_id = str(uuid4())

        stored_count = store_chunks(
            chunks=chunks,
            embeddings=embeddings,
            document_name=file.filename,
            document_id=document_id
        )

        return {
            "message": "PDF indexed successfully",
            "document_id": document_id,
            "filename": file.filename,
            "total_pages": len(pages),
            "total_chunks": len(chunks),
            "stored_chunks": stored_count
        }

    except HTTPException:
        raise

    except Exception as error:
        print("PDF processing error:", error)

        raise HTTPException(
            status_code=500,
            detail="PDF processing failed"
        )

    finally:
        await file.close()


@app.post("/ask")
def ask_question(request: QuestionRequest):

    if not request.question.strip():
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty"
        )

    if not request.document_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one document"
        )

    try:
        result = answer_question(
            question=request.question,
            document_ids=request.document_ids,
            topic=request.topic
        )

        return result

    except Exception as error:
        print("Question answering error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to generate an answer"
        )


@app.post("/generate-quiz")
def create_quiz(request: QuizRequest):

    if not request.document_ids:
        raise HTTPException(
            status_code=400,
            detail="Select at least one document"
        )

    if request.num_questions not in [5, 10, 15, 20]:
        raise HTTPException(
            status_code=400,
            detail="Choose 5, 10, 15, or 20 questions"
        )

    try:
        questions = generate_quiz(
            document_ids=request.document_ids,
            topic=request.topic,
            num_questions=request.num_questions
        )

        if not questions:
            raise HTTPException(
                status_code=404,
                detail="No relevant content found"
            )

        return {
            "questions": questions,
            "total_questions": len(questions)
        }

    except HTTPException:
        raise

    except Exception as error:
        print("Quiz generation error:", error)

        raise HTTPException(
            status_code=500,
            detail="Unable to generate quiz"
        )

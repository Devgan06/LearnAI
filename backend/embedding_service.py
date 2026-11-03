
import os

from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables
load_dotenv()

# Read configuration
API_KEY = os.getenv("OPENAI_API_KEY")

MODEL = os.getenv(
    "OPENAI_EMBEDDING_MODEL",
    "text-embedding-3-small"
)

if not API_KEY:
    raise ValueError("OPENAI_API_KEY is missing from .env")

# Initialize OpenAI client
client = OpenAI(api_key=API_KEY)


def generate_embedding(text: str):

    response = client.embeddings.create(
        model=MODEL,
        input=text
    )

    return response.data[0].embedding


def generate_embeddings(texts: list[str]):

    if not texts:
        return []

    response = client.embeddings.create(
        model=MODEL,
        input=texts
    )

    return [
        item.embedding
        for item in response.data
    ]

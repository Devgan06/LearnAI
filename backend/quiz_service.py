

import os
import json

from dotenv import load_dotenv
from openai import OpenAI

from embedding_service import generate_embedding
from vector_store import search_chunks

load_dotenv()

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY")
)


def generate_quiz(
    document_ids=None,
    topic: str = "",
    num_questions: int = 5,
    document_name: str = None
):

    if num_questions not in [5, 10, 15, 20]:
        raise ValueError(
            "Question count must be 5, 10, 15, or 20"
        )

    # Build a retrieval query.
    if topic.strip():
        query = (
            f"Important concepts, definitions, examples and "
            f"key information about {topic}"
        )
    else:
        query = (
            "Important concepts, definitions, explanations, "
            "examples and key topics from the study material"
        )

    query_embedding = generate_embedding(query)

    # Retrieve more material for larger quizzes.
    results = search_chunks(
        query_embedding=query_embedding,
        document_ids=document_ids,
        document_name=document_name,
        top_k=min(num_questions * 2, 40)
    )

    documents = results["documents"][0]

    if not documents:
        return []

    context = "\n\n".join(documents)

    if topic.strip():
        topic_instruction = f"""
Focus the questions on this topic: {topic}

Use only the selected study material.
Do not create questions about unrelated topics.
"""
    else:
        topic_instruction = """
Create questions covering different concepts
across the selected study material.
Avoid repeatedly testing the same concept.
"""

    # Generate questions in batches of five.
    batch_size = 5
    all_questions = []

    for start in range(0, num_questions, batch_size):

        remaining = num_questions - start
        current_batch = min(batch_size, remaining)

        previous_questions = [
            question["question"]
            for question in all_questions
        ]

        previous_text = (
            "\n".join(previous_questions)
            if previous_questions
            else "None"
        )

        prompt = f"""
You are LearnAI, an educational quiz generator.

Generate EXACTLY {current_batch} new multiple-choice questions
using ONLY the provided study material.

{topic_instruction}

Requirements:
- Generate exactly {current_batch} questions.
- Each question must have exactly four options.
- Only one option must be correct.
- Avoid duplicate questions.
- Avoid questions similar to those already generated.
- Include conceptual and application-based questions.
- Keep questions clear and educational.
- Do not invent information outside the material.
- The correct_answer must exactly match one option.

Previously generated questions (do not repeat):
{previous_text}

Return valid JSON in this format:

{{
    "questions": [
        {{
            "question": "Question text",
            "options": [
                "Option A",
                "Option B",
                "Option C",
                "Option D"
            ],
            "correct_answer": "Option A",
            "explanation": "Explanation"
        }}
    ]
}}
"""

        # Retry a batch once if the response is invalid.
        batch_questions = None

        for attempt in range(2):

            response = client.chat.completions.create(
                model="gpt-4o-mini",
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": prompt
                    },
                    {
                        "role": "user",
                        "content": context
                    }
                ],
                temperature=0.3,
                max_tokens=3000
            )

            try:
                content = response.choices[0].message.content
                data = json.loads(content)

                generated = data.get("questions", [])

                valid_questions = []

                for question in generated:

                    options = question.get("options", [])
                    correct_answer = question.get("correct_answer")

                    if (
                        question.get("question")
                        and len(options) == 4
                        and len(set(options)) == 4
                        and correct_answer in options
                        and question.get("explanation")
                    ):
                        valid_questions.append(question)

                if len(valid_questions) == current_batch:
                    batch_questions = valid_questions
                    break

            except (json.JSONDecodeError, TypeError, AttributeError):
                pass

        if batch_questions is None:
            raise ValueError(
                f"Unable to generate batch starting at question "
                f"{start + 1}. Please try again."
            )

        all_questions.extend(batch_questions)

    return all_questions

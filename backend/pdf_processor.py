import fitz


def extract_pages_from_pdf(pdf_bytes: bytes):

    document = fitz.open(
        stream=pdf_bytes,
        filetype="pdf"
    )

    pages = []

    for page_number, page in enumerate(document, start=1):

        page_text = page.get_text()

        if page_text.strip():
            pages.append({
                "page_number": page_number,
                "text": page_text
            })

    document.close()

    return pages
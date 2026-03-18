import io
import structlog
from typing import Optional, BinaryIO
from google.cloud import vision
from google.cloud import documentai_v1 as documentai
from google.api_core.client_options import ClientOptions
from PIL import Image

from app.utils.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

# Initialize Google Cloud clients
vision_client = None
documentai_client = None

try:
    vision_client = vision.ImageAnnotatorClient()
    logger.info("✓ Google Vision API client initialized")
except Exception as e:
    logger.warning(f"⚠ Google Vision API client initialization failed: {e}")

try:
    # Document AI requires project ID and location
    PROJECT_ID = settings.google_project_id if hasattr(settings, 'google_project_id') else None
    LOCATION = settings.google_location if hasattr(settings, 'google_location') else "us"

    if PROJECT_ID:
        opts = ClientOptions(api_endpoint=f"{LOCATION}-documentai.googleapis.com")
        documentai_client = documentai.DocumentProcessorServiceClient(client_options=opts)
        logger.info(f"✓ Google Document AI client initialized (project: {PROJECT_ID}, location: {LOCATION})")
    else:
        logger.warning("⚠ Document AI not initialized: GOOGLE_PROJECT_ID not set")
except Exception as e:
    logger.warning(f"⚠ Google Document AI client initialization failed: {e}")


def normalize_text(text: str) -> str:
    """
    Normalize extracted text by:
    - Joining paragraphs/blocks into coherent sentences
    - Stripping duplicates and empty lines
    - Removing excessive whitespace
    """
    if not text:
        return ""

    # Split into lines
    lines = text.split('\n')

    # Remove empty lines and strip whitespace
    lines = [line.strip() for line in lines if line.strip()]

    # Remove duplicate consecutive lines
    normalized_lines = []
    prev_line = None
    for line in lines:
        if line != prev_line:
            normalized_lines.append(line)
            prev_line = line

    # Join with spaces (for most languages)
    # For languages like Arabic/Persian, preserve RTL by joining with space
    normalized = ' '.join(normalized_lines)

    # Clean up excessive whitespace
    normalized = ' '.join(normalized.split())

    logger.info("Text normalized", original_length=len(text), normalized_length=len(normalized))
    return normalized


def extract_text_from_image(file_content: bytes, filename: str) -> str:
    """
    Extract text from image using Google Vision API OCR.

    Args:
        file_content: Binary content of the image
        filename: Original filename (for logging)

    Returns:
        Extracted and normalized text
    """
    if not vision_client:
        raise RuntimeError("Google Vision API client not initialized")

    logger.info("Starting Vision API OCR", filename=filename, size=len(file_content))

    try:
        # Validate image with Pillow first
        try:
            img = Image.open(io.BytesIO(file_content))
            img.verify()
            logger.info("Image validated", format=img.format, size=img.size)
        except Exception as e:
            raise ValueError(f"Invalid image file: {e}")

        # Create Vision API image object
        image = vision.Image(content=file_content)

        # Perform text detection
        response = vision_client.text_detection(image=image)

        if response.error.message:
            raise RuntimeError(f"Vision API error: {response.error.message}")

        # Extract text from annotations
        texts = response.text_annotations

        if not texts:
            logger.warning("No text detected in image", filename=filename)
            return ""

        # First annotation contains the entire detected text
        extracted_text = texts[0].description

        logger.info(
            "Vision API OCR completed",
            filename=filename,
            text_length=len(extracted_text),
            preview=extracted_text[:50]
        )

        # Normalize the text
        normalized_text = normalize_text(extracted_text)

        return normalized_text

    except Exception as e:
        logger.error("Vision API OCR failed", filename=filename, error=str(e))
        raise


def extract_text_from_pdf(file_content: bytes, filename: str) -> str:
    """
    Extract text from PDF using Google Document AI.

    Args:
        file_content: Binary content of the PDF
        filename: Original filename (for logging)

    Returns:
        Extracted and normalized text
    """
    if not documentai_client:
        raise RuntimeError("Google Document AI client not initialized. Set GOOGLE_PROJECT_ID in .env")

    if not hasattr(settings, 'google_project_id') or not settings.google_project_id:
        raise RuntimeError("GOOGLE_PROJECT_ID not configured")

    if not hasattr(settings, 'document_ai_processor_id'):
        raise RuntimeError("DOCUMENT_AI_PROCESSOR_ID not configured. Create a processor in Google Cloud Console.")

    logger.info("Starting Document AI OCR", filename=filename, size=len(file_content))

    try:
        # Build processor resource name
        # Format: projects/{project}/locations/{location}/processors/{processor}
        PROJECT_ID = settings.google_project_id
        LOCATION = settings.google_location if hasattr(settings, 'google_location') else "us"
        PROCESSOR_ID = settings.document_ai_processor_id

        processor_name = f"projects/{PROJECT_ID}/locations/{LOCATION}/processors/{PROCESSOR_ID}"

        logger.info("Using Document AI processor", processor=processor_name)

        # Create the document
        raw_document = documentai.RawDocument(
            content=file_content,
            mime_type="application/pdf"
        )

        # Configure the process request
        request = documentai.ProcessRequest(
            name=processor_name,
            raw_document=raw_document
        )

        # Process the document
        result = documentai_client.process_document(request=request)
        document = result.document

        # Extract text
        extracted_text = document.text

        logger.info(
            "Document AI OCR completed",
            filename=filename,
            text_length=len(extracted_text),
            preview=extracted_text[:50]
        )

        # Normalize the text
        normalized_text = normalize_text(extracted_text)

        return normalized_text

    except Exception as e:
        logger.error("Document AI OCR failed", filename=filename, error=str(e))
        raise


def extract_text_from_google_doc(doc_id: str) -> str:
    """
    Extract text from Google Doc using Google Docs API.

    Args:
        doc_id: Google Doc ID

    Returns:
        Extracted and normalized text

    Note: This requires OAuth2 authentication and is deferred to Phase 2.
    For now, returns a placeholder.
    """
    logger.warning("Google Docs API not yet implemented", doc_id=doc_id)
    raise NotImplementedError("Google Docs extraction coming in Phase 2")


def detect_file_type(filename: str, content_type: Optional[str] = None) -> str:
    """
    Detect file type from filename and/or content type.

    Args:
        filename: Original filename
        content_type: MIME type (e.g., "image/png")

    Returns:
        File type: "image", "pdf", or "unknown"
    """
    # Check content type first
    if content_type:
        if content_type.startswith("image/"):
            return "image"
        if content_type == "application/pdf":
            return "pdf"

    # Fall back to file extension
    filename_lower = filename.lower()

    if filename_lower.endswith((".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp")):
        return "image"

    if filename_lower.endswith(".pdf"):
        return "pdf"

    return "unknown"

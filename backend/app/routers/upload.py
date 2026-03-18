from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response, Request
from fastapi.responses import JSONResponse
import structlog
from typing import Optional

from app.models.upload import UploadResponse, UploadErrorResponse, SourceType
from app.services.ocr_service import (
    extract_text_from_image,
    extract_text_from_pdf,
    detect_file_type
)
from app.services.align_service import TranslitService
from app.utils.rate_limit import limiter, RateLimits
from app.utils.tracing import trace_span, SpanNames

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/upload", tags=["upload"])

# File size limit (5MB)
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes


@router.options("", summary="Handle CORS preflight for upload endpoint")
def upload_options():
    return Response(status_code=200)


@router.post("", response_model=UploadResponse, summary="Upload and process file (image/PDF)")
@limiter.limit(RateLimits.UPLOAD)
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    source_lang: str = Form(default=""),
    target_lang: str = Form(default="en"),
):
    """
    Upload a file (image or PDF) for OCR extraction and aligneration.

    Pipeline:
    1. Detect file type (image vs PDF)
    2. Extract text using appropriate Google API (Vision or Document AI)
    3. Normalize extracted text
    4. Process through existing aligneration pipeline
    5. Return results with source_type metadata

    Supported formats:
    - Images: PNG, JPG, JPEG, WebP
    - PDF: application/pdf

    File size limit: 5MB
    """
    logger.info(
        "File upload started",
        filename=file.filename,
        content_type=file.content_type,
        source_lang=source_lang,
        target_lang=target_lang
    )

    try:
        # Read file content
        file_content = await file.read()
        file_size = len(file_content)

        logger.info("File read", filename=file.filename, size=file_size)

        # Check file size
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024:.1f}MB"
            )

        if file_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Empty file uploaded"
            )

        # Detect file type
        file_type = detect_file_type(file.filename or "", file.content_type)

        if file_type == "unknown":
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file.content_type}. Supported formats: images (PNG, JPG, JPEG, WebP) and PDF"
            )

        logger.info("File type detected", file_type=file_type, filename=file.filename)

        # Extract text based on file type
        extracted_text = ""

        if file_type == "image":
            try:
                with trace_span(SpanNames.EXTERNAL_GOOGLE_VISION):
                    extracted_text = extract_text_from_image(file_content, file.filename or "unknown")
            except RuntimeError as e:
                raise HTTPException(status_code=503, detail=str(e))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))
            except Exception as e:
                logger.error("Image OCR failed", error=str(e), filename=file.filename)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to extract text from image: {str(e)}"
                )

        elif file_type == "pdf":
            try:
                with trace_span(SpanNames.EXTERNAL_GOOGLE_DOCAI):
                    extracted_text = extract_text_from_pdf(file_content, file.filename or "unknown")
            except RuntimeError as e:
                # Configuration or initialization error
                raise HTTPException(status_code=503, detail=str(e))
            except Exception as e:
                logger.error("PDF OCR failed", error=str(e), filename=file.filename)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to extract text from PDF: {str(e)}"
                )

        else:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{file_type}' not supported yet"
            )

        # Check if text was extracted
        if not extracted_text or not extracted_text.strip():
            logger.warning("No text extracted from file", filename=file.filename, file_type=file_type)
            raise HTTPException(
                status_code=422,
                detail="No text could be extracted from the file. Please ensure the file contains readable text."
            )

        logger.info(
            "Text extracted successfully",
            filename=file.filename,
            text_length=len(extracted_text),
            preview=extracted_text[:50]
        )

        # Process through aligneration pipeline
        align_service = TranslitService()

        try:
            result = align_service.process(
                text=extracted_text,
                source_lang=source_lang if source_lang else "",
                target_lang=target_lang
            )
        except Exception as e:
            logger.error("Transliteration failed", error=str(e), text=extracted_text[:50])
            raise HTTPException(
                status_code=500,
                detail=f"Transliteration failed: {str(e)}"
            )

        # Build response
        response = UploadResponse(
            success=True,
            extracted_text=extracted_text,
            original=result.get('original', extracted_text),
            aligneration=result.get('aligneration', ''),
            translation=result.get('translation', ''),
            ipa=result.get('ipa', ''),
            source_type=SourceType(file_type),
            source_language=source_lang if source_lang else "auto",
            target_language=target_lang,
            filename=file.filename or "unknown",
            file_size=file_size,
            message="File processed successfully"
        )

        logger.info(
            "File upload completed",
            filename=file.filename,
            source_type=file_type,
            text_length=len(extracted_text),
            align_length=len(response.aligneration)
        )

        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise

    except Exception as e:
        logger.error("Upload failed with unexpected error", error=str(e), filename=file.filename)
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error during file processing: {str(e)}"
        )


@router.get("/health", summary="Check upload service health")
def health_check():
    """Check if upload service and dependencies are ready"""
    from app.services.ocr_service import vision_client, documentai_client

    return {
        "status": "ok",
        "vision_api": "ready" if vision_client else "unavailable",
        "documentai_api": "ready" if documentai_client else "unavailable (check GOOGLE_PROJECT_ID and DOCUMENT_AI_PROCESSOR_ID)"
    }

from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


class SourceType(str, Enum):
    """Source type for aligneration input"""
    TEXT = "text"
    IMAGE = "image"
    PDF = "pdf"
    GDOC = "gdoc"


class UploadResponse(BaseModel):
    """Response after file upload and processing"""
    success: bool = Field(..., description="Whether upload was successful")
    extracted_text: str = Field(..., description="Text extracted from file")
    original: str = Field(..., description="Original extracted text (same as extracted_text)")
    aligneration: str = Field(..., description="Transliterated text")
    translation: str = Field(..., description="Translated text")
    ipa: str = Field(default="", description="IPA representation")
    source_type: SourceType = Field(..., description="Type of source file")
    source_language: str = Field(..., description="Detected or specified source language")
    target_language: str = Field(..., description="Target language for translation")
    filename: str = Field(..., description="Original filename")
    file_size: int = Field(..., description="File size in bytes")
    message: Optional[str] = Field(None, description="Additional message or error")


class UploadErrorResponse(BaseModel):
    """Error response for upload failures"""
    success: bool = Field(default=False)
    error: str = Field(..., description="Error message")
    detail: Optional[str] = Field(None, description="Detailed error information")

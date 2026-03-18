import pytest
import io
from unittest.mock import patch, MagicMock, Mock
from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from app.models.upload import SourceType

client = TestClient(app)


# Test fixtures - Create sample files
@pytest.fixture
def sample_image_bytes():
    """Create a simple test image in memory"""
    img = Image.new('RGB', (100, 100), color='white')
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    return img_bytes.getvalue()


@pytest.fixture
def sample_pdf_bytes():
    """Mock PDF bytes"""
    # Simple PDF header (minimal valid PDF)
    return b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<<>>\nstartxref\n9\n%%EOF'


class TestFileTypeDetection:
    """Test file type detection logic"""

    def test_detect_image_from_content_type(self):
        """Test image detection from MIME type"""
        from app.services.ocr_service import detect_file_type

        assert detect_file_type("test.png", "image/png") == "image"
        assert detect_file_type("test.jpg", "image/jpeg") == "image"
        assert detect_file_type("test.webp", "image/webp") == "image"

    def test_detect_pdf_from_content_type(self):
        """Test PDF detection from MIME type"""
        from app.services.ocr_service import detect_file_type

        assert detect_file_type("test.pdf", "application/pdf") == "pdf"

    def test_detect_image_from_extension(self):
        """Test image detection from file extension"""
        from app.services.ocr_service import detect_file_type

        assert detect_file_type("test.PNG", None) == "image"
        assert detect_file_type("test.jpg", None) == "image"
        assert detect_file_type("test.JPEG", None) == "image"

    def test_detect_unknown_type(self):
        """Test unknown file type detection"""
        from app.services.ocr_service import detect_file_type

        assert detect_file_type("test.docx", "application/vnd.openxmlformats") == "unknown"
        assert detect_file_type("test.txt", "text/plain") == "unknown"


class TestTextNormalization:
    """Test text normalization function"""

    def test_normalize_basic_text(self):
        """Test basic text normalization"""
        from app.services.ocr_service import normalize_text

        text = "  Line 1  \n\n  Line 2  \n  Line 3  "
        result = normalize_text(text)
        assert result == "Line 1 Line 2 Line 3"

    def test_normalize_duplicate_lines(self):
        """Test removal of duplicate consecutive lines"""
        from app.services.ocr_service import normalize_text

        text = "Hello\nHello\nWorld\nWorld"
        result = normalize_text(text)
        assert result == "Hello World"

    def test_normalize_arabic_text(self):
        """Test normalization preserves RTL text"""
        from app.services.ocr_service import normalize_text

        text = "سلام\nچطوری؟"
        result = normalize_text(text)
        assert result == "سلام چطوری؟"

    def test_normalize_empty_text(self):
        """Test normalization of empty text"""
        from app.services.ocr_service import normalize_text

        assert normalize_text("") == ""
        assert normalize_text("   \n\n   ") == ""


class TestImageOCR:
    """Test image OCR with mocked Vision API"""

    @patch('app.services.ocr_service.vision_client')
    def test_extract_text_from_image_success(self, mock_vision_client, sample_image_bytes):
        """Test successful text extraction from image"""
        # Mock Vision API response
        mock_annotation = MagicMock()
        mock_annotation.description = "سلام"

        mock_response = MagicMock()
        mock_response.text_annotations = [mock_annotation]
        mock_response.error.message = ""

        mock_vision_client.text_detection.return_value = mock_response

        from app.services.ocr_service import extract_text_from_image

        result = extract_text_from_image(sample_image_bytes, "test.png")
        assert result == "سلام"
        mock_vision_client.text_detection.assert_called_once()

    @patch('app.services.ocr_service.vision_client')
    def test_extract_text_from_image_no_text(self, mock_vision_client, sample_image_bytes):
        """Test image with no detectable text"""
        mock_response = MagicMock()
        mock_response.text_annotations = []
        mock_response.error.message = ""

        mock_vision_client.text_detection.return_value = mock_response

        from app.services.ocr_service import extract_text_from_image

        result = extract_text_from_image(sample_image_bytes, "test.png")
        assert result == ""

    @patch('app.services.ocr_service.vision_client')
    def test_extract_text_invalid_image(self, mock_vision_client):
        """Test extraction from invalid image data"""
        from app.services.ocr_service import extract_text_from_image

        invalid_bytes = b"not an image"

        with pytest.raises(ValueError, match="Invalid image file"):
            extract_text_from_image(invalid_bytes, "test.png")

    @patch('app.services.ocr_service.vision_client', None)
    def test_extract_text_vision_client_not_initialized(self, sample_image_bytes):
        """Test when Vision API client is not initialized"""
        from app.services.ocr_service import extract_text_from_image

        with pytest.raises(RuntimeError, match="Google Vision API client not initialized"):
            extract_text_from_image(sample_image_bytes, "test.png")


class TestPDFOCR:
    """Test PDF OCR with mocked Document AI"""

    @patch('app.services.ocr_service.documentai_client')
    @patch('app.services.ocr_service.settings')
    def test_extract_text_from_pdf_success(self, mock_settings, mock_documentai_client, sample_pdf_bytes):
        """Test successful text extraction from PDF"""
        # Mock settings
        mock_settings.google_project_id = "test-project"
        mock_settings.google_location = "us"
        mock_settings.document_ai_processor_id = "test-processor"

        # Mock Document AI response
        mock_document = MagicMock()
        mock_document.text = "کتاب خوب است"

        mock_result = MagicMock()
        mock_result.document = mock_document

        mock_documentai_client.process_document.return_value = mock_result

        from app.services.ocr_service import extract_text_from_pdf

        result = extract_text_from_pdf(sample_pdf_bytes, "test.pdf")
        assert result == "کتاب خوب است"
        mock_documentai_client.process_document.assert_called_once()

    @patch('app.services.ocr_service.documentai_client', None)
    def test_extract_text_documentai_not_initialized(self, sample_pdf_bytes):
        """Test when Document AI client is not initialized"""
        from app.services.ocr_service import extract_text_from_pdf

        with pytest.raises(RuntimeError, match="Google Document AI client not initialized"):
            extract_text_from_pdf(sample_pdf_bytes, "test.pdf")


class TestUploadEndpoint:
    """Test the /upload API endpoint"""

    @patch('app.routers.upload.extract_text_from_image')
    @patch('app.routers.upload.TranslitService')
    def test_upload_image_success(self, mock_align_service, mock_extract, sample_image_bytes):
        """Test successful image upload and processing"""
        # Mock OCR extraction
        mock_extract.return_value = "سلام"

        # Mock aligneration service
        mock_service_instance = MagicMock()
        mock_service_instance.process.return_value = {
            'original': 'سلام',
            'aligneration': 'salaam',
            'translation': 'hello',
            'ipa': 'salɑːm'
        }
        mock_align_service.return_value = mock_service_instance

        # Create multipart form data
        files = {'file': ('test.png', sample_image_bytes, 'image/png')}
        data = {'source_lang': 'fa', 'target_lang': 'en'}

        response = client.post("/upload", files=files, data=data)

        assert response.status_code == 200
        json_data = response.json()

        assert json_data['success'] is True
        assert json_data['extracted_text'] == 'سلام'
        assert json_data['aligneration'] == 'salaam'
        assert json_data['translation'] == 'hello'
        assert json_data['source_type'] == 'image'
        assert json_data['filename'] == 'test.png'

    @patch('app.routers.upload.extract_text_from_pdf')
    @patch('app.routers.upload.TranslitService')
    def test_upload_pdf_success(self, mock_align_service, mock_extract, sample_pdf_bytes):
        """Test successful PDF upload and processing"""
        # Mock OCR extraction
        mock_extract.return_value = "کتاب خوب است"

        # Mock aligneration service
        mock_service_instance = MagicMock()
        mock_service_instance.process.return_value = {
            'original': 'کتاب خوب است',
            'aligneration': 'ketab khub ast',
            'translation': 'the book is good',
            'ipa': 'ketɑːb'
        }
        mock_align_service.return_value = mock_service_instance

        files = {'file': ('test.pdf', sample_pdf_bytes, 'application/pdf')}
        data = {'source_lang': 'fa', 'target_lang': 'en'}

        response = client.post("/upload", files=files, data=data)

        assert response.status_code == 200
        json_data = response.json()

        assert json_data['success'] is True
        assert json_data['extracted_text'] == 'کتاب خوب است'
        assert json_data['source_type'] == 'pdf'

    def test_upload_empty_file(self):
        """Test upload of empty file"""
        files = {'file': ('test.png', b'', 'image/png')}
        data = {'source_lang': 'fa', 'target_lang': 'en'}

        response = client.post("/upload", files=files, data=data)

        assert response.status_code == 400
        assert 'Empty file' in response.json()['detail']

    def test_upload_file_too_large(self):
        """Test upload of file exceeding size limit"""
        # Create 6MB file
        large_file = b'x' * (6 * 1024 * 1024)

        files = {'file': ('test.png', large_file, 'image/png')}
        data = {'source_lang': 'fa', 'target_lang': 'en'}

        response = client.post("/upload", files=files, data=data)

        assert response.status_code == 413
        assert 'too large' in response.json()['detail']

    def test_upload_unsupported_file_type(self):
        """Test upload of unsupported file type"""
        files = {'file': ('test.docx', b'fake docx content', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
        data = {'source_lang': 'fa', 'target_lang': 'en'}

        response = client.post("/upload", files=files, data=data)

        assert response.status_code == 400
        assert 'Unsupported file type' in response.json()['detail']

    @patch('app.routers.upload.extract_text_from_image')
    def test_upload_no_text_extracted(self, mock_extract, sample_image_bytes):
        """Test when no text is extracted from file"""
        mock_extract.return_value = ""

        files = {'file': ('test.png', sample_image_bytes, 'image/png')}
        data = {'source_lang': 'fa', 'target_lang': 'en'}

        response = client.post("/upload", files=files, data=data)

        assert response.status_code == 422
        assert 'No text could be extracted' in response.json()['detail']

    @patch('app.routers.upload.extract_text_from_image')
    @patch('app.routers.upload.TranslitService')
    def test_upload_aligneration_failure(self, mock_align_service, mock_extract, sample_image_bytes):
        """Test handling of aligneration service failure"""
        mock_extract.return_value = "test text"

        mock_service_instance = MagicMock()
        mock_service_instance.process.side_effect = Exception("Transliteration error")
        mock_align_service.return_value = mock_service_instance

        files = {'file': ('test.png', sample_image_bytes, 'image/png')}
        data = {'source_lang': 'fa', 'target_lang': 'en'}

        response = client.post("/upload", files=files, data=data)

        assert response.status_code == 500
        assert 'Transliteration failed' in response.json()['detail']


class TestUploadHealthCheck:
    """Test the upload service health check endpoint"""

    def test_health_check(self):
        """Test health check endpoint"""
        response = client.get("/upload/health")

        assert response.status_code == 200
        json_data = response.json()

        assert 'status' in json_data
        assert 'vision_api' in json_data
        assert 'documentai_api' in json_data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

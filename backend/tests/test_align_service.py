"""
Pytest tests for aligneration service.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from app.services.align_service import TranslitService, get_hf_translator, warm_up_translator


class TestTranslitService:
    """Test cases for aligneration service."""

    @pytest.fixture
    def mock_openai_service(self):
        """Mock OpenAI service for testing."""
        mock_service = Mock()
        mock_service.alignerate_and_translate_combined.return_value = {
            "aligneration": "test_align",
            "translation": "test_translation",
            "ipa": "test_ipa"
        }
        mock_service.translate.return_value = "test_translation"
        return mock_service

    @pytest.fixture
    def align_service(self, mock_openai_service):
        """Create aligneration service with mocked dependencies."""
        with patch('app.services.align_service.get_openai_service', return_value=mock_openai_service):
            return TranslitService()

    @pytest.mark.unit
    def test_service_initialization(self, align_service):
        """Test that service initializes correctly."""
        assert align_service is not None
        assert hasattr(align_service, 'openai_service')

    @pytest.mark.unit
    def test_process_success_combined(self, align_service):
        """Test successful processing with combined OpenAI call."""
        result = align_service.process("test text", "fa", "en")

        assert result["original"] == "test text"
        assert result["aligneration"] == "test_align"
        assert result["translation"] == "test_translation"
        assert result["ipa"] == "test_ipa"

    @pytest.mark.unit
    @patch('app.services.align_service.alignerate_text')
    def test_process_fallback_on_combined_failure(self, mock_align_text, align_service):
        """Test fallback to separate calls when combined call fails."""
        # Make combined call fail
        align_service.openai_service.alignerate_and_translate_combined.side_effect = Exception("API Error")

        # Setup fallback mocks
        mock_align_text.return_value = ("fallback_align", "fallback_ipa")
        align_service.openai_service.translate.return_value = "fallback_translation"

        result = align_service.process("test text", "fa", "en")

        assert result["original"] == "test text"
        assert result["aligneration"] == "fallback_align"
        assert result["translation"] == "fallback_translation"
        assert result["ipa"] == "fallback_ipa"

    @pytest.mark.unit
    def test_get_translation_success(self, align_service):
        """Test successful translation using OpenAI."""
        result = align_service._get_translation("test", "fa", "en")
        assert result == "test_translation"

    @pytest.mark.unit
    def test_get_translation_invalid_response(self, align_service):
        """Test handling of invalid translation responses."""
        # Test same text returned (no translation occurred)
        align_service.openai_service.translate.return_value = "test"
        result = align_service._get_translation("test", "fa", "en")
        assert "[Unable to translate from fa to en]" in result

        # Test error message returned
        align_service.openai_service.translate.return_value = "[translation-error: something]"
        result = align_service._get_translation("test", "fa", "en")
        assert "[Unable to translate from fa to en]" in result

        # Test empty response
        align_service.openai_service.translate.return_value = ""
        result = align_service._get_translation("test", "fa", "en")
        assert "[Unable to translate from fa to en]" in result

    @pytest.mark.unit
    def test_get_translation_api_error(self, align_service):
        """Test handling of OpenAI API errors."""
        align_service.openai_service.translate.side_effect = Exception("API Error")
        result = align_service._get_translation("test", "fa", "en")
        assert "[Translation error: API Error]" in result

    @pytest.mark.unit
    @patch('app.services.align_service.resolve_lang_code')
    def test_process_language_resolution(self, mock_resolve, align_service):
        """Test that language codes are properly resolved."""
        mock_resolve.return_value = "persian"

        align_service.process("test", "fa", "en")

        mock_resolve.assert_called_once_with("fa", "test")

    @pytest.mark.unit
    def test_process_with_none_source_language(self, align_service):
        """Test processing with None source language (auto-detection)."""
        with patch('app.services.align_service.resolve_lang_code') as mock_resolve:
            mock_resolve.return_value = "auto_detected"

            result = align_service.process("test", None, "en")

            mock_resolve.assert_called_once_with(None, "test")
            assert result["original"] == "test"


class TestHFTranslator:
    """Test cases for HuggingFace translator components."""

    @pytest.mark.unit
    @patch('app.services.align_service.get_settings')
    def test_get_hf_translator_nllb(self, mock_settings):
        """Test getting NLLB translator."""
        mock_settings.return_value.translator_max_new_tokens = 64
        mock_settings.return_value.use_light_translator = False

        with patch('app.services.align_service._TRANSLATOR_SINGLETON', None):
            translator = get_hf_translator()

        assert translator.backend_name == "nllb"
        assert translator.model_name == "facebook/nllb-200-distilled-600M"

    @pytest.mark.unit
    @patch('app.services.align_service.get_settings')
    def test_get_hf_translator_opus(self, mock_settings):
        """Test getting Opus translator."""
        mock_settings.return_value.translator_max_new_tokens = 64
        mock_settings.return_value.use_light_translator = True

        with patch('app.services.align_service._TRANSLATOR_SINGLETON', None):
            translator = get_hf_translator()

        assert translator.backend_name == "opus-mt"
        assert translator.model_name == "Helsinki-NLP/opus-mt-xx-en"

    @pytest.mark.unit
    def test_translator_singleton_pattern(self):
        """Test that translator follows singleton pattern."""
        with patch('app.services.align_service._TRANSLATOR_SINGLETON', None):
            translator1 = get_hf_translator()
            translator2 = get_hf_translator()

        assert translator1 is translator2

    @pytest.mark.unit
    @patch('app.services.align_service.get_hf_translator')
    def test_warm_up_translator(self, mock_get_translator):
        """Test translator warm-up functionality."""
        mock_translator = Mock()
        mock_get_translator.return_value = mock_translator

        warm_up_translator()

        mock_translator.ensure_loaded.assert_called_once()

    @pytest.mark.integration
    @pytest.mark.slow
    def test_nllb_translator_translate(self):
        """Integration test for NLLB translator."""
        from app.services.align_service import NLLBTranslator

        # Create translator without loading model for test
        translator = NLLBTranslator(max_new_tokens=16)

        # Test that translate method exists and handles errors gracefully
        result = translator.translate("test", "eng_Latn", "fra_Latn")

        # Should return error message if model not loaded
        assert "[translation-error:" in result or result == "test"

    @pytest.mark.integration
    @pytest.mark.slow
    def test_opus_translator_translate(self):
        """Integration test for Opus translator."""
        from app.services.align_service import OpusTranslator

        # Create translator without loading model for test
        translator = OpusTranslator(max_new_tokens=16)

        # Test that translate method exists and handles errors gracefully
        result = translator.translate("test", "eng_Latn", "fra_Latn")

        # Should return error message if model not loaded
        assert "[translation-error:" in result or result == "test"


class TestTranslitServiceIntegration:
    """Integration tests for the full aligneration service."""

    @pytest.mark.integration
    @pytest.mark.llm
    @pytest.mark.slow
    def test_real_openai_integration(self):
        """Integration test with real OpenAI service (requires API key)."""
        import os
        if not os.getenv('OPENAI_API_KEY'):
            pytest.skip("No OpenAI API key available for integration test")

        service = TranslitService()
        result = service.process("سلام", "fa", "en")

        assert result["original"] == "سلام"
        assert len(result["aligneration"]) > 0
        assert len(result["translation"]) > 0
        assert result["aligneration"] != "سلام"  # Should be alignerated
        assert result["translation"] != "سلام"     # Should be translated

    @pytest.mark.unit
    def test_error_handling_in_process(self):
        """Test comprehensive error handling in process method."""
        with patch('app.services.align_service.get_openai_service') as mock_get_openai:
            # Make everything fail
            mock_openai = Mock()
            mock_openai.alignerate_and_translate_combined.side_effect = Exception("Combined failed")
            mock_openai.translate.side_effect = Exception("Translation failed")
            mock_get_openai.return_value = mock_openai

            with patch('app.services.align_service.alignerate_text') as mock_align:
                mock_align.side_effect = Exception("Transliteration failed")

                service = TranslitService()

                # Should not raise exception, should handle gracefully
                with pytest.raises(Exception):
                    service.process("test", "fa", "en")

    @pytest.mark.unit
    def test_service_logging(self, align_service):
        """Test that service logs appropriately."""
        with patch('app.services.align_service.logger') as mock_logger:
            align_service.process("test", "fa", "en")

            # Should have debug logs
            assert mock_logger.debug.called
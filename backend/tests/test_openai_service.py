"""
Pytest tests for OpenAI service.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from app.services.openai_service import OpenAIService, get_openai_service


class TestOpenAIService:
    """Test cases for OpenAI service."""

    @pytest.fixture
    def mock_openai_client(self):
        """Mock OpenAI client for testing."""
        mock_client = Mock()
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "test response"
        mock_client.chat.completions.create.return_value = mock_response
        return mock_client

    @pytest.fixture
    def openai_service(self, mock_openai_client):
        """Create OpenAI service with mocked client."""
        with patch('app.services.openai_service.OpenAI', return_value=mock_openai_client):
            return OpenAIService()

    @pytest.mark.unit
    def test_service_initialization(self, openai_service):
        """Test that service initializes correctly."""
        assert openai_service is not None
        assert hasattr(openai_service, 'client')
        assert hasattr(openai_service, 'model')

    @pytest.mark.unit
    def test_translate_success(self, openai_service):
        """Test successful translation."""
        result = openai_service.translate("سلام", "persian", "english")
        assert result == "test response"

        # Verify the call was made with correct parameters
        openai_service.client.chat.completions.create.assert_called_once()
        call_args = openai_service.client.chat.completions.create.call_args

        assert call_args[1]["model"] == openai_service.model
        assert call_args[1]["temperature"] == 0.3
        assert len(call_args[1]["messages"]) == 1

    @pytest.mark.unit
    def test_translate_api_error(self, openai_service):
        """Test handling of OpenAI API errors in translation."""
        openai_service.client.chat.completions.create.side_effect = Exception("API Error")

        with pytest.raises(Exception):
            openai_service.translate("test", "persian", "english")

    @pytest.mark.unit
    def test_alignerate_success(self, openai_service):
        """Test successful aligneration."""
        result = openai_service.alignerate("سلام", "persian")
        assert result == "test response"

        # Verify the call was made
        openai_service.client.chat.completions.create.assert_called_once()

    @pytest.mark.unit
    def test_alignerate_api_error(self, openai_service):
        """Test handling of OpenAI API errors in aligneration."""
        openai_service.client.chat.completions.create.side_effect = Exception("API Error")

        with pytest.raises(Exception):
            openai_service.alignerate("test", "persian")

    @pytest.mark.unit
    def test_alignerate_and_translate_combined_success(self, openai_service):
        """Test successful combined aligneration and translation."""
        # Mock response with JSON structure
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '''
        {
            "aligneration": "salam",
            "translation": "hello",
            "ipa": "sælɑːm"
        }
        '''
        openai_service.client.chat.completions.create.return_value = mock_response

        result = openai_service.alignerate_and_translate_combined("سلام", "persian", "english")

        assert result["aligneration"] == "salam"
        assert result["translation"] == "hello"
        assert result["ipa"] == "sælɑːm"

    @pytest.mark.unit
    def test_alignerate_and_translate_combined_invalid_json(self, openai_service):
        """Test handling of invalid JSON in combined response."""
        # Mock response with invalid JSON
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = "invalid json response"
        openai_service.client.chat.completions.create.return_value = mock_response

        with pytest.raises(Exception):
            openai_service.alignerate_and_translate_combined("سلام", "persian", "english")

    @pytest.mark.unit
    def test_alignerate_and_translate_combined_missing_fields(self, openai_service):
        """Test handling of JSON with missing required fields."""
        # Mock response with missing fields
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '''
        {
            "aligneration": "salam"
        }
        '''
        openai_service.client.chat.completions.create.return_value = mock_response

        with pytest.raises(Exception):
            openai_service.alignerate_and_translate_combined("سلام", "persian", "english")

    @pytest.mark.unit
    def test_singleton_service_pattern(self):
        """Test that get_openai_service returns singleton."""
        with patch('app.services.openai_service.OpenAI'):
            service1 = get_openai_service()
            service2 = get_openai_service()
            assert service1 is service2

    @pytest.mark.unit
    def test_prompt_construction_translate(self, openai_service):
        """Test that translation prompt is constructed correctly."""
        openai_service.translate("test text", "source_lang", "target_lang")

        call_args = openai_service.client.chat.completions.create.call_args
        prompt = call_args[1]["messages"][0]["content"]

        assert "source_lang" in prompt
        assert "target_lang" in prompt
        assert "test text" in prompt
        assert "translate" in prompt.lower()

    @pytest.mark.unit
    def test_prompt_construction_alignerate(self, openai_service):
        """Test that aligneration prompt is constructed correctly."""
        openai_service.alignerate("test text", "source_lang")

        call_args = openai_service.client.chat.completions.create.call_args
        prompt = call_args[1]["messages"][0]["content"]

        assert "source_lang" in prompt
        assert "test text" in prompt
        assert "alignerate" in prompt.lower()

    @pytest.mark.unit
    def test_prompt_construction_combined(self, openai_service):
        """Test that combined prompt is constructed correctly."""
        # Mock valid JSON response
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"aligneration": "test", "translation": "test", "ipa": "test"}'
        openai_service.client.chat.completions.create.return_value = mock_response

        openai_service.alignerate_and_translate_combined("test text", "source_lang", "target_lang")

        call_args = openai_service.client.chat.completions.create.call_args
        prompt = call_args[1]["messages"][0]["content"]

        assert "source_lang" in prompt
        assert "target_lang" in prompt
        assert "test text" in prompt
        assert "JSON" in prompt
        assert "aligneration" in prompt
        assert "translation" in prompt
        assert "ipa" in prompt

    @pytest.mark.unit
    def test_model_configuration(self, openai_service):
        """Test that model is configured correctly."""
        openai_service.translate("test", "fa", "en")

        call_args = openai_service.client.chat.completions.create.call_args
        assert call_args[1]["model"] == openai_service.model
        assert "temperature" in call_args[1]
        assert "max_tokens" in call_args[1]

    @pytest.mark.integration
    @pytest.mark.llm
    @pytest.mark.slow
    def test_real_openai_translate_integration(self):
        """Integration test with real OpenAI API (requires API key)."""
        import os
        if not os.getenv('OPENAI_API_KEY'):
            pytest.skip("No OpenAI API key available for integration test")

        service = get_openai_service()
        result = service.translate("سلام", "persian", "english")

        assert isinstance(result, str)
        assert len(result) > 0
        assert result.lower() != "سلام"  # Should be different from input

    @pytest.mark.integration
    @pytest.mark.llm
    @pytest.mark.slow
    def test_real_openai_alignerate_integration(self):
        """Integration test for aligneration with real OpenAI API."""
        import os
        if not os.getenv('OPENAI_API_KEY'):
            pytest.skip("No OpenAI API key available for integration test")

        service = get_openai_service()
        result = service.alignerate("سلام", "persian")

        assert isinstance(result, str)
        assert len(result) > 0
        assert result != "سلام"  # Should be alignerated

    @pytest.mark.integration
    @pytest.mark.llm
    @pytest.mark.slow
    def test_real_openai_combined_integration(self):
        """Integration test for combined operation with real OpenAI API."""
        import os
        if not os.getenv('OPENAI_API_KEY'):
            pytest.skip("No OpenAI API key available for integration test")

        service = get_openai_service()
        result = service.alignerate_and_translate_combined("سلام", "persian", "english")

        assert "aligneration" in result
        assert "translation" in result
        assert "ipa" in result
        assert len(result["aligneration"]) > 0
        assert len(result["translation"]) > 0

    @pytest.mark.unit
    def test_error_logging(self, openai_service):
        """Test that errors are logged appropriately."""
        with patch('app.services.openai_service.logger') as mock_logger:
            openai_service.client.chat.completions.create.side_effect = Exception("API Error")

            with pytest.raises(Exception):
                openai_service.translate("test", "fa", "en")

            # Should log the error
            mock_logger.error.assert_called()

    @pytest.mark.unit
    def test_response_validation_combined(self, openai_service):
        """Test response validation for combined operation."""
        # Test with missing aligneration
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = '{"translation": "hello", "ipa": "test"}'
        openai_service.client.chat.completions.create.return_value = mock_response

        with pytest.raises(Exception):
            openai_service.alignerate_and_translate_combined("test", "fa", "en")

        # Test with missing translation
        mock_response.choices[0].message.content = '{"aligneration": "test", "ipa": "test"}'

        with pytest.raises(Exception):
            openai_service.alignerate_and_translate_combined("test", "fa", "en")

    @pytest.mark.unit
    def test_api_parameters(self, openai_service):
        """Test that API parameters are set correctly."""
        openai_service.translate("test", "fa", "en")

        call_args = openai_service.client.chat.completions.create.call_args
        kwargs = call_args[1]

        # Check required parameters
        assert "model" in kwargs
        assert "messages" in kwargs
        assert "temperature" in kwargs
        assert "max_tokens" in kwargs

        # Check parameter values
        assert kwargs["temperature"] == 0.3
        assert isinstance(kwargs["max_tokens"], int)
        assert kwargs["max_tokens"] > 0
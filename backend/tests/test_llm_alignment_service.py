"""
Comprehensive pytest tests for LLM alignment service.
"""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
from app.services.llm_alignment_service import LLMAlignmentService, get_llm_alignment_service


class TestLLMAlignmentService:
    """Test cases for LLM alignment service."""

    @pytest.fixture
    def mock_openai_service(self):
        """Mock OpenAI service for testing."""
        mock_service = Mock()
        mock_service.client = Mock()
        mock_service.model = "gpt-3.5-turbo"
        return mock_service

    @pytest.fixture
    def llm_service(self, mock_openai_service):
        """Create LLM alignment service with mocked dependencies."""
        with patch('app.services.llm_alignment_service.get_openai_service', return_value=mock_openai_service):
            return LLMAlignmentService()

    @pytest.mark.unit
    def test_service_initialization(self, llm_service):
        """Test that service initializes correctly."""
        assert llm_service is not None
        assert hasattr(llm_service, 'openai_service')

    @pytest.mark.unit
    def test_parse_valid_dual_level_response(self, llm_service):
        """Test parsing valid dual-level JSON response."""
        valid_response = json.dumps({
            "phrase_alignments": [
                {"source": "بستنی خریدیم", "target": "we bought ice cream"}
            ],
            "word_alignments": [
                {"source": "بستنی", "target": "ice cream"},
                {"source": "خریدیم", "target": "we bought"}
            ]
        })

        result = llm_service._parse_llm_response(valid_response)

        assert "phrase_alignments" in result
        assert "word_alignments" in result
        assert len(result["phrase_alignments"]) == 1
        assert len(result["word_alignments"]) == 2

        # Check phrase alignment
        phrase = result["phrase_alignments"][0]
        assert phrase["source"] == "بستنی خریدیم"
        assert phrase["target"] == "we bought ice cream"
        assert phrase["confidence"] == 0.9
        assert phrase["refined"] is True

        # Check word alignments
        word1 = result["word_alignments"][0]
        assert word1["source"] == "بستنی"
        assert word1["target"] == "ice cream"
        assert word1["confidence"] == 0.8
        assert word1["refined"] is True

    @pytest.mark.unit
    def test_parse_legacy_format_response(self, llm_service):
        """Test parsing legacy format for backward compatibility."""
        legacy_response = json.dumps({
            "alignments": [
                {"source": "سلام", "target": "hello"}
            ]
        })

        result = llm_service._parse_llm_response(legacy_response)

        assert "phrase_alignments" in result
        assert "word_alignments" in result
        assert len(result["phrase_alignments"]) == 1
        assert len(result["word_alignments"]) == 0

    @pytest.mark.unit
    def test_parse_malformed_json_fallback(self, llm_service):
        """Test fallback parsing for malformed JSON."""
        malformed_response = '''
        {
          "phrase_alignments": [
            {"source": "بستنی", "target": "ice cream"}
          // missing closing bracket
        '''

        result = llm_service._parse_llm_response(malformed_response)

        # Should fallback to regex parsing
        assert "phrase_alignments" in result
        assert "word_alignments" in result

    @pytest.mark.unit
    def test_parse_empty_response(self, llm_service):
        """Test handling of empty or invalid responses."""
        empty_result = llm_service._parse_llm_response("")
        assert empty_result["phrase_alignments"] == []
        assert empty_result["word_alignments"] == []

        invalid_result = llm_service._parse_llm_response("invalid json")
        assert invalid_result["phrase_alignments"] == []
        assert invalid_result["word_alignments"] == []

    @pytest.mark.unit
    def test_fallback_parse_extracts_alignments(self, llm_service):
        """Test that fallback parser can extract alignments from malformed JSON."""
        malformed_with_data = '''
        Some text before
        "source": "بستنی", "target": "ice cream"
        more text
        "source": "خریدیم", "target": "we bought"
        '''

        result = llm_service._fallback_parse(malformed_with_data)

        assert len(result["phrase_alignments"]) == 2
        assert result["phrase_alignments"][0]["source"] == "بستنی"
        assert result["phrase_alignments"][0]["target"] == "ice cream"
        assert result["phrase_alignments"][1]["source"] == "خریدیم"
        assert result["phrase_alignments"][1]["target"] == "we bought"

    @pytest.mark.unit
    @patch('app.services.llm_alignment_service.get_openai_service')
    def test_align_phrases_success(self, mock_get_openai):
        """Test successful phrase alignment."""
        # Setup mock
        mock_openai_service = Mock()
        mock_response = Mock()
        mock_response.choices = [Mock()]
        mock_response.choices[0].message.content = json.dumps({
            "phrase_alignments": [
                {"source": "سلام", "target": "hello"}
            ],
            "word_alignments": [
                {"source": "سلام", "target": "hello"}
            ]
        })

        mock_openai_service.client.chat.completions.create.return_value = mock_response
        mock_openai_service.model = "gpt-3.5-turbo"
        mock_get_openai.return_value = mock_openai_service

        service = LLMAlignmentService()
        result = service.align_phrases("سلام", "hello")

        assert "alignments" in result  # Backward compatibility
        assert "phrase_alignments" in result
        assert "word_alignments" in result
        assert "timing" in result
        assert len(result["phrase_alignments"]) == 1
        assert len(result["word_alignments"]) == 1

    @pytest.mark.unit
    @patch('app.services.llm_alignment_service.get_openai_service')
    def test_align_phrases_openai_error(self, mock_get_openai):
        """Test handling of OpenAI API errors."""
        # Setup mock to raise exception
        mock_openai_service = Mock()
        mock_openai_service.client.chat.completions.create.side_effect = Exception("API Error")
        mock_get_openai.return_value = mock_openai_service

        service = LLMAlignmentService()
        result = service.align_phrases("test", "test")

        assert "error" in result
        assert result["alignments"] == []
        assert result["phrase_alignments"] == []
        assert result["word_alignments"] == []

    @pytest.mark.integration
    @pytest.mark.llm
    @pytest.mark.slow
    def test_real_alignment_integration(self):
        """Integration test with real LLM service (requires API key)."""
        # Skip if no API key available
        import os
        if not os.getenv('OPENAI_API_KEY'):
            pytest.skip("No OpenAI API key available for integration test")

        service = get_llm_alignment_service()
        result = service.align_phrases("سلام", "hello")

        assert "phrase_alignments" in result
        assert "word_alignments" in result
        assert "timing" in result
        assert isinstance(result["timing"]["total"], (int, float))

    @pytest.mark.unit
    def test_language_agnostic_prompt_generation(self, llm_service):
        """Test that prompt is language-agnostic."""
        # Test with different language pairs
        test_cases = [
            ("Bonjour", "Hello"),  # French
            ("こんにちは", "Hello"),  # Japanese
            ("Hola", "Hello"),     # Spanish
            ("Guten Tag", "Hello") # German
        ]

        for source, target in test_cases:
            # We can't test the exact prompt content without exposing it,
            # but we can test that the method accepts any language input
            with patch.object(llm_service.openai_service.client.chat.completions, 'create') as mock_create:
                mock_response = Mock()
                mock_response.choices = [Mock()]
                mock_response.choices[0].message.content = '{"phrase_alignments": [], "word_alignments": []}'
                mock_create.return_value = mock_response

                result = llm_service.align_phrases(source, target)
                assert result is not None

    @pytest.mark.unit
    def test_confidence_and_refinement_flags(self, llm_service):
        """Test that confidence and refinement flags are properly set."""
        response_with_flags = json.dumps({
            "phrase_alignments": [
                {"source": "test", "target": "test"}
            ],
            "word_alignments": [
                {"source": "test", "target": "test"}
            ]
        })

        result = llm_service._parse_llm_response(response_with_flags)

        # Check that LLM alignments get proper flags
        phrase = result["phrase_alignments"][0]
        assert phrase["confidence"] == 0.9  # High confidence for phrases
        assert phrase["refined"] is True    # LLM-generated

        word = result["word_alignments"][0]
        assert word["confidence"] == 0.8   # Slightly lower for words
        assert word["refined"] is True     # LLM-generated

    @pytest.mark.unit
    def test_singleton_service_pattern(self):
        """Test that get_llm_alignment_service returns singleton."""
        service1 = get_llm_alignment_service()
        service2 = get_llm_alignment_service()
        assert service1 is service2

    @pytest.mark.unit
    def test_prompt_includes_dual_level_instructions(self, llm_service):
        """Test that prompt includes both phrase and word level instructions."""
        with patch.object(llm_service.openai_service.client.chat.completions, 'create') as mock_create:
            mock_response = Mock()
            mock_response.choices = [Mock()]
            mock_response.choices[0].message.content = '{"phrase_alignments": [], "word_alignments": []}'
            mock_create.return_value = mock_response

            llm_service.align_phrases("test", "test")

            # Check that the call was made with dual-level instructions
            call_args = mock_create.call_args
            messages = call_args[1]['messages']
            prompt_content = messages[0]['content']

            assert "phrase_alignments" in prompt_content
            assert "word_alignments" in prompt_content
            assert "Phrase Alignments:" in prompt_content
            assert "Word Alignments:" in prompt_content

    @pytest.mark.unit
    def test_timing_measurement(self, llm_service):
        """Test that timing is properly measured."""
        with patch.object(llm_service.openai_service.client.chat.completions, 'create') as mock_create:
            mock_response = Mock()
            mock_response.choices = [Mock()]
            mock_response.choices[0].message.content = '{"phrase_alignments": [], "word_alignments": []}'
            mock_create.return_value = mock_response

            result = llm_service.align_phrases("test", "test")

            assert "timing" in result
            assert "llm_processing" in result["timing"]
            assert "total" in result["timing"]
            assert isinstance(result["timing"]["total"], (int, float))
            assert result["timing"]["total"] >= 0
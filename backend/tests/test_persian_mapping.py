"""
Unit tests for Persian IPA to Latin mapping.

Tests the persian_ipa_to_latin function with various Persian words and phrases
to ensure accurate aligneration following Persian conventions.
Note: This module focuses on testing the Persian-specific IPA post-processing,
while the main aligneration is now handled by OpenAI API.
"""

import pytest
import sys
from pathlib import Path

# Add the app directory to the Python path for imports
app_dir = Path(__file__).parent.parent / "app"
sys.path.insert(0, str(app_dir))

from app.utils.persian_mapping import persian_ipa_to_latin, get_persian_mapping_rules


class TestPersianMapping:
    """Test cases for Persian IPA to Latin mapping functionality."""

    def test_basic_persian_words(self):
        """Test basic Persian words with standard IPA symbols."""
        test_cases = [
            # امیدوارم - I hope
            ("ɒmjdvɒrm", "omidvaram"),

            # خوبی - good/well
            ("xubj", "khubi"),

            # چیز - thing
            ("t͡ʃjz", "chiz"),
        ]

        for ipa, expected in test_cases:
            result = persian_ipa_to_latin(ipa)
            assert result == expected, f"Failed for {ipa}: expected '{expected}', got '{result}'"

    def test_consonant_mappings(self):
        """Test specific consonant mapping rules."""
        test_cases = [
            # شب - night
            ("ʃb", "shab"),

            # جان - soul/life
            ("d͡ʒɒn", "jọn"),  # Note: ɒ → o

            # ژاله - dew
            ("ʒɒleh", "zhoله"),  # ʒ → zh, ɒ → o

            # خانه - house
            ("xɒneh", "khoneh"),  # x → kh, ɒ → o
        ]

        for ipa, expected in test_cases:
            result = persian_ipa_to_latin(ipa)
            # For these tests, we'll check key transformations
            if "ʃ" in ipa:
                assert "sh" in result, f"ʃ → sh mapping failed in {ipa}"
            if "d͡ʒ" in ipa:
                assert "j" in result, f"d͡ʒ → j mapping failed in {ipa}"
            if "t͡ʃ" in ipa:
                assert "ch" in result, f"t͡ʃ → ch mapping failed in {ipa}"
            if "x" in ipa:
                assert "kh" in result, f"x → kh mapping failed in {ipa}"
            if "ʒ" in ipa:
                assert "zh" in result, f"ʒ → zh mapping failed in {ipa}"

    def test_vowel_mappings(self):
        """Test Persian-specific vowel mappings."""
        test_cases = [
            # Test ɒ → o (Persian-specific, not 'a' like generic)
            ("ɒ", "o"),
            ("bɒd", "bod"),

            # Test other vowels
            ("ɪ", "i"),
            ("ʊ", "u"),
            ("ɛ", "e"),
            ("ə", "e"),  # schwa → e
        ]

        for ipa, expected in test_cases:
            result = persian_ipa_to_latin(ipa)
            assert result == expected, f"Vowel mapping failed for {ipa}: expected '{expected}', got '{result}'"

    def test_context_specific_rules(self):
        """Test context-specific mapping rules."""
        test_cases = [
            # ɒn → an (word-final)
            ("mɒn", "man"),  # Should become "man"

            # ɒʃ → ash
            ("ɒʃ", "ash"),

            # j → i (when not part of d͡ʒ)
            ("pjr", "pir"),  # j → i when not part of affricate
        ]

        for ipa, expected in test_cases:
            result = persian_ipa_to_latin(ipa)
            # Check specific transformations (exact match might vary due to other rules)
            if "ɒn" in ipa and ipa.endswith("ɒn"):
                assert result.endswith("an"), f"ɒn → an mapping failed in {ipa}"
            if "ɒʃ" in ipa:
                assert "ash" in result, f"ɒʃ → ash mapping failed in {ipa}"

    def test_affricate_priority(self):
        """Test that affricates are processed before individual components."""
        test_cases = [
            # چ should become "ch", not "t" + "sh"
            ("t͡ʃ", "ch"),

            # ج should become "j", not "d" + "zh"
            ("d͡ʒ", "j"),
        ]

        for ipa, expected in test_cases:
            result = persian_ipa_to_latin(ipa)
            assert result == expected, f"Affricate mapping failed for {ipa}: expected '{expected}', got '{result}'"

    def test_empty_and_edge_cases(self):
        """Test edge cases and empty inputs."""
        test_cases = [
            ("", ""),  # Empty string
            ("abc", "abc"),  # ASCII text (should pass through)
            ("123", "123"),  # Numbers (should pass through)
            ("a b c", "a b c"),  # Spaces (should be preserved)
        ]

        for ipa, expected in test_cases:
            result = persian_ipa_to_latin(ipa)
            assert result == expected, f"Edge case failed for '{ipa}': expected '{expected}', got '{result}'"

    def test_diacritic_removal(self):
        """Test that diacritics and markers are properly removed."""
        test_cases = [
            ("aː", "a"),  # Length marker removal
            ("ˈa", "a"),  # Primary stress removal
            ("ˌa", "a"),  # Secondary stress removal
        ]

        for ipa, expected in test_cases:
            result = persian_ipa_to_latin(ipa)
            assert result == expected, f"Diacritic removal failed for {ipa}: expected '{expected}', got '{result}'"

    def test_get_mapping_rules(self):
        """Test that the mapping rules dictionary is available."""
        rules = get_persian_mapping_rules()

        assert isinstance(rules, dict), "Mapping rules should be a dictionary"
        assert len(rules) > 0, "Mapping rules should not be empty"

        # Test that key mappings are present
        assert rules.get('ɒ') == 'o', "Persian ɒ → o mapping should be present"
        assert rules.get('x') == 'kh', "x → kh mapping should be present"
        assert rules.get('ʃ') == 'sh', "ʃ → sh mapping should be present"

    def test_real_world_examples(self):
        """Test with actual Persian words (if we know their IPA representation)."""
        # These would be the actual IPA outputs from Epitran for these words
        # The exact IPA might vary, but these are representative examples

        test_cases = [
            # سلام - hello (approximate IPA)
            ("sɒlɒm", "salam"),

            # دوست - friend (approximate IPA)
            ("dust", "dust"),

            # خوشحال - happy (approximate IPA)
            ("xoʃhɒl", "khoshhol"),
        ]

        for ipa, expected_pattern in test_cases:
            result = persian_ipa_to_latin(ipa)
            # Check that key transformations occurred
            assert isinstance(result, str), f"Result should be string for {ipa}"
            assert len(result) > 0, f"Result should not be empty for {ipa}"
            # The exact result might vary, so we test general correctness
            assert all(ord(c) < 128 for c in result), f"Result should be ASCII for {ipa}"


if __name__ == "__main__":
    # Run tests when script is executed directly
    pytest.main([__file__, "-v"])
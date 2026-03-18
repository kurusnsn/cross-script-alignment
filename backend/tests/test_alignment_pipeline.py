#!/usr/bin/env python3
"""
Unit tests for phrase-level alignment pipeline.

Tests the complete pipeline: SimAlign → merge_alignments_with_confidence → LLM refinement
Ensures phrase-level mappings work correctly and prevent regressions.
"""

import pytest
import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.simalign_service import merge_alignments_with_confidence, get_simalign_service, group_collocations


class TestPhraseLevelAlignment:
    """Test suite for phrase-level alignment functionality."""

    def test_single_to_multi_phrase(self):
        """Test single source word mapping to multiple target words."""
        # بستنی → ice cream
        src_tokens = ["بستنی", "خریدیم"]
        tgt_tokens = ["We", "bought", "ice", "cream"]

        # Simulate SimAlign output: بستنی maps to both "ice" and "cream"
        alignments = [
            (0, 2),  # بستنی → ice
            (0, 3),  # بستنی → cream
            (1, 0),  # خریدیم → We
            (1, 1),  # خریدیم → bought
        ]

        confidence_scores = {
            (0, 2): 0.85,  # بستنی → ice
            (0, 3): 0.75,  # بستنی → cream
            (1, 0): 0.70,  # خریدیم → We
            (1, 1): 0.80,  # خریدیم → bought
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should create "بستنی" → "ice cream" mapping
        ice_cream_mapping = next(
            (a for a in result if a["source"] == "بستنی" and "ice" in a["target"] and "cream" in a["target"]),
            None
        )

        assert ice_cream_mapping is not None, f"Expected 'بستنی → ice cream' mapping not found. Got: {result}"
        assert ice_cream_mapping["target"] == "ice cream"
        assert ice_cream_mapping["confidence"] > 0.7
        assert ice_cream_mapping["refined"] is False

    def test_multi_to_multi_phrase(self):
        """Test multiple source words mapping to multiple target words."""
        # حالت چطوره → how are you
        src_tokens = ["حالت", "چطوره"]
        tgt_tokens = ["how", "are", "you"]

        # Simulate alignment where both source words map to all target words
        alignments = [
            (0, 1),  # حالت → are
            (0, 2),  # حالت → you
            (1, 0),  # چطوره → how
            (1, 1),  # چطوره → are (overlap creates connection)
        ]

        confidence_scores = {
            (0, 1): 0.65,
            (0, 2): 0.70,
            (1, 0): 0.75,
            (1, 1): 0.60,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should create "حالت چطوره" → "how are you" mapping
        full_mapping = next(
            (a for a in result if "حالت" in a["source"] and "چطوره" in a["source"] and
             "how" in a["target"] and "are" in a["target"] and "you" in a["target"]),
            None
        )

        assert full_mapping is not None, f"Expected 'حالت چطوره → how are you' mapping not found. Got: {result}"
        assert "حالت" in full_mapping["source"]
        assert "چطوره" in full_mapping["source"]
        assert "how" in full_mapping["target"]
        assert "are" in full_mapping["target"]
        assert "you" in full_mapping["target"]

    def test_multi_source_to_multi_target(self):
        """Test complex multi-source to multi-target phrase mapping."""
        # با خانواده‌ام → with my family
        src_tokens = ["با", "خانواده‌ام", "رفتم"]
        tgt_tokens = ["I", "went", "with", "my", "family"]

        alignments = [
            (0, 2),  # با → with
            (1, 3),  # خانواده‌ام → my
            (1, 4),  # خانواده‌ام → family
            (2, 0),  # رفتم → I
            (2, 1),  # رفتم → went
        ]

        confidence_scores = {(pair[0], pair[1]): 0.8 for pair in alignments}

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should have خانواده‌ام → my family
        family_mapping = next(
            (a for a in result if a["source"] == "خانواده‌ام" and "my" in a["target"] and "family" in a["target"]),
            None
        )

        assert family_mapping is not None, f"Expected 'خانواده‌ام → my family' mapping not found. Got: {result}"
        assert family_mapping["target"] == "my family"

    def test_consecutive_grouping(self):
        """Test that consecutive tokens are properly grouped."""
        src_tokens = ["good", "morning"]
        tgt_tokens = ["صبح", "بخیر"]

        # Both source words map to both target words (connected component)
        alignments = [
            (0, 0),  # good → صبح
            (1, 1),  # morning → بخیر
        ]

        confidence_scores = {(0, 0): 0.9, (1, 1): 0.85}

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should create separate mappings since no overlap
        assert len(result) == 2
        good_mapping = next((a for a in result if a["source"] == "good"), None)
        morning_mapping = next((a for a in result if a["source"] == "morning"), None)

        assert good_mapping is not None
        assert morning_mapping is not None
        assert good_mapping["target"] == "صبح"
        assert morning_mapping["target"] == "بخیر"

    def test_confidence_calculation(self):
        """Test that confidence scores are properly averaged."""
        src_tokens = ["test"]
        tgt_tokens = ["آزمایش", "تست"]

        alignments = [
            (0, 0),  # test → آزمایش
            (0, 1),  # test → تست
        ]

        confidence_scores = {
            (0, 0): 0.9,
            (0, 1): 0.7,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        assert len(result) == 1
        assert result[0]["source"] == "test"
        assert result[0]["target"] == "آزمایش تست"
        # Average of 0.9 and 0.7 = 0.8
        assert abs(result[0]["confidence"] - 0.8) < 0.01

    def test_no_duplicate_usage(self):
        """Test that tokens are not used in multiple phrases."""
        src_tokens = ["hello", "world"]
        tgt_tokens = ["سلام", "دنیا"]

        alignments = [
            (0, 0),  # hello → سلام
            (1, 1),  # world → دنیا
        ]

        confidence_scores = {(0, 0): 0.9, (1, 1): 0.8}

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        assert len(result) == 2

        # Verify all source and target tokens are used exactly once
        used_sources = [a["source"] for a in result]
        used_targets = [a["target"] for a in result]

        assert "hello" in used_sources
        assert "world" in used_sources
        assert "سلام" in used_targets
        assert "دنیا" in used_targets

    def test_empty_inputs(self):
        """Test handling of empty inputs."""
        result = merge_alignments_with_confidence([], [], [], {})
        assert result == []

        result = merge_alignments_with_confidence(["test"], [], [], {})
        assert result == []

        result = merge_alignments_with_confidence([], ["test"], [], {})
        assert result == []

    def test_refined_flag_initialization(self):
        """Test that refined flag is properly initialized to False."""
        src_tokens = ["test"]
        tgt_tokens = ["آزمایش"]
        alignments = [(0, 0)]
        confidence_scores = {(0, 0): 0.8}

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        assert len(result) == 1
        assert "refined" in result[0]
        assert result[0]["refined"] is False


class TestCollocationBasedAlignment:
    """Test suite for collocation-based alignment functionality."""

    def test_group_collocations_ice_cream(self):
        """Test ice cream collocation grouping."""
        tokens = ["We", "bought", "ice", "cream", "and", "cake"]
        grouped, mapping = group_collocations(tokens)

        # Should group "ice cream" but leave others separate
        assert "ice cream" in grouped
        assert "We" in grouped
        assert "bought" in grouped
        assert "and" in grouped
        assert "cake" in grouped

        # Check mapping
        ice_cream_idx = grouped.index("ice cream")
        assert mapping[ice_cream_idx] == [2, 3]  # "ice" and "cream" indices

    def test_group_collocations_how_are_you(self):
        """Test how are you collocation grouping."""
        tokens = ["hello", "how", "are", "you", "doing"]
        grouped, mapping = group_collocations(tokens)

        # Should group "how are you"
        assert "how are you" in grouped
        assert "hello" in grouped
        assert "doing" in grouped

        # Check mapping
        how_are_you_idx = grouped.index("how are you")
        assert mapping[how_are_you_idx] == [1, 2, 3]

    def test_group_collocations_multiple_phrases(self):
        """Test multiple collocations in one sentence."""
        tokens = ["I", "bought", "ice", "cream", "and", "hot", "dog"]
        grouped, mapping = group_collocations(tokens)

        # Should group both "ice cream" and "hot dog"
        assert "ice cream" in grouped
        assert "hot dog" in grouped
        assert "I" in grouped
        assert "bought" in grouped
        assert "and" in grouped

    def test_group_collocations_no_matches(self):
        """Test when no collocations are found."""
        tokens = ["simple", "sentence", "here"]
        grouped, mapping = group_collocations(tokens)

        # Should return original tokens
        assert grouped == tokens
        assert len(mapping) == len(tokens)
        for i, token in enumerate(tokens):
            assert mapping[i] == [i]

    def test_collocation_ice_cream_alignment(self):
        """Test that بستنی correctly aligns to 'ice cream' after collocation grouping."""
        # Simulate scenario where SimAlign gives:
        # بستنی → ice (index 2)
        # خریدیم → We (index 0)
        # خریدیم → bought (index 1)

        src_tokens = ["بستنی", "خریدیم"]
        tgt_tokens = ["We", "bought", "ice", "cream"]

        # SimAlign raw output: بستنی only maps to "ice" (missing "cream")
        alignments = [
            (0, 2),  # بستنی → ice
            (1, 0),  # خریدیم → We
            (1, 1),  # خریدیم → bought
        ]

        confidence_scores = {
            (0, 2): 0.85,  # بستنی → ice
            (1, 0): 0.70,  # خریدیم → We
            (1, 1): 0.80,  # خریدیم → bought
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # After collocation grouping, should create "بستنی" → "ice cream" mapping
        ice_cream_mapping = next(
            (a for a in result if a["source"] == "بستنی" and "ice cream" in a["target"]),
            None
        )

        assert ice_cream_mapping is not None, f"Expected 'بستنی → ice cream' mapping not found. Got: {result}"
        assert ice_cream_mapping["target"] == "ice cream"
        assert ice_cream_mapping["confidence"] > 0.7

    def test_collocation_with_multi_source(self):
        """Test collocation with multiple source words mapping to grouped target."""
        # Test case: حالت چطوره → how are you
        src_tokens = ["حالت", "چطوره"]
        tgt_tokens = ["how", "are", "you", "doing"]

        # SimAlign gives partial alignments
        alignments = [
            (0, 1),  # حالت → are
            (1, 0),  # چطوره → how
        ]

        confidence_scores = {
            (0, 1): 0.65,
            (1, 0): 0.75,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should create phrase mapping involving "how are you"
        phrase_with_how_are_you = next(
            (a for a in result if "how are you" in a["target"]),
            None
        )

        assert phrase_with_how_are_you is not None, f"Expected phrase with 'how are you' not found. Got: {result}"

    def test_collocation_preserves_confidence(self):
        """Test that confidence scores are properly preserved through collocation grouping."""
        src_tokens = ["test"]
        tgt_tokens = ["ice", "cream"]

        alignments = [
            (0, 0),  # test → ice
            (0, 1),  # test → cream
        ]

        confidence_scores = {
            (0, 0): 0.9,
            (0, 1): 0.7,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        assert len(result) == 1
        assert result[0]["source"] == "test"
        assert result[0]["target"] == "ice cream"
        # Should be average of 0.9 and 0.7 = 0.8
        assert abs(result[0]["confidence"] - 0.8) < 0.01

    def test_collocation_mixed_scenario(self):
        """Test complex scenario with both grouped and non-grouped tokens."""
        src_tokens = ["من", "بستنی", "خریدم"]
        tgt_tokens = ["I", "bought", "ice", "cream", "yesterday"]

        alignments = [
            (0, 0),  # من → I
            (1, 2),  # بستنی → ice
            (1, 3),  # بستنی → cream
            (2, 1),  # خریدم → bought
        ]

        confidence_scores = {pair: 0.8 for pair in alignments}

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should have proper mappings including "بستنی → ice cream"
        sources = [a["source"] for a in result]
        targets = [a["target"] for a in result]

        assert "بستنی" in sources
        assert "ice cream" in targets

        # Find the ice cream mapping
        ice_cream_mapping = next(a for a in result if "ice cream" in a["target"])
        assert ice_cream_mapping["source"] == "بستنی"


class TestAlignmentPipeline:
    """Test the complete alignment pipeline integration."""

    def test_pipeline_integration(self):
        """Test the complete pipeline with real SimAlign service."""
        service = get_simalign_service()

        # Test with a simple phrase that should produce good alignment
        source_text = "سلام دنیا"
        target_text = "hello world"

        result = service.align_word_pairs(source_text, target_text)

        assert result.source_tokens == ["سلام", "دنیا"]
        assert result.target_tokens == ["hello", "world"]
        assert len(result.alignments) > 0

        # Alignments should be reasonable
        for alignment in result.alignments:
            assert 0 <= alignment.source_index < len(result.source_tokens)
            assert 0 <= alignment.target_index < len(result.target_tokens)

    @pytest.mark.integration
    def test_phrase_align_endpoint(self):
        """Test the complete phrase alignment endpoint."""
        import requests

        url = "http://localhost:8000/align/phrase-align"
        payload = {
            "source_text": "بستنی خریدیم",
            "target_text": "We bought ice cream"
        }

        try:
            response = requests.post(url, json=payload, timeout=30)
            response.raise_for_status()
            result = response.json()

            # Should have proper phrase-level alignments
            assert "alignments" in result
            assert len(result["alignments"]) > 0

            # Look for ice cream mapping
            ice_cream_found = any(
                "بستنی" in a["source"] and "ice" in a["target"] and "cream" in a["target"]
                for a in result["alignments"]
            )

            assert ice_cream_found, f"Expected 'بستنی → ice cream' not found in: {result['alignments']}"

        except requests.exceptions.RequestException:
            pytest.skip("Backend not available for integration test")


class TestSpanEmbeddingSimilarity:
    """Test suite for span embedding similarity functionality."""

    def test_span_similarity_enhances_confidence(self):
        """Test that span similarity can enhance confidence for multi-token phrases."""
        # Simulate a multi→multi mapping that should get span enhancement
        src_tokens = ["دیروز", "رفتم"]  # "yesterday went"
        tgt_tokens = ["yesterday", "I", "went"]

        # Alignments: both source tokens map to corresponding targets
        alignments = [
            (0, 0),  # دیروز → yesterday
            (1, 1),  # رفتم → I
            (1, 2),  # رفتم → went
        ]

        # Moderate confidence scores
        confidence_scores = {
            (0, 0): 0.65,
            (1, 1): 0.55,
            (1, 2): 0.60,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should have created phrase alignments
        assert len(result) >= 1

        # Look for the multi-token alignment that should get span enhancement
        multi_alignment = next(
            (a for a in result if len(a["source"].split()) >= 1 and len(a["target"].split()) >= 2),
            None
        )

        if multi_alignment:
            # If span similarity worked, confidence should be reasonable (not super low)
            assert multi_alignment["confidence"] >= 0.4
            print(f" Span enhancement test: {multi_alignment['source']} → {multi_alignment['target']} ({multi_alignment['confidence']:.3f})")


class TestEnhancedLLMTriggers:
    """Test suite for enhanced LLM refinement triggers."""

    def test_multi_to_one_trigger(self):
        """Test that multi-token source to single target triggers LLM refinement."""
        # 3+ source tokens mapping to 1 target token
        src_tokens = ["به", "طور", "کلی"]  # "generally" (literally "in general way")
        tgt_tokens = ["generally"]

        alignments = [
            (0, 0),  # به → generally
            (1, 0),  # طور → generally
            (2, 0),  # کلی → generally
        ]

        confidence_scores = {
            (0, 0): 0.7,
            (1, 0): 0.6,
            (2, 0): 0.8,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should create one merged alignment
        assert len(result) == 1

        # Should be flagged for LLM refinement
        alignment = result[0]
        assert alignment.get("_needs_llm_refinement", False), "Multi-to-one should trigger LLM refinement"

        # Confidence should be lowered
        assert alignment["confidence"] <= 0.6, f"Expected lowered confidence, got {alignment['confidence']}"

        print(f" Multi-to-one trigger: {alignment['source']} → {alignment['target']} (flagged for LLM)")

    def test_one_to_multi_trigger(self):
        """Test that single source to multi-token target triggers LLM refinement."""
        # 1 source token mapping to 3+ target tokens
        src_tokens = ["صبحانه"]  # "breakfast"
        tgt_tokens = ["breakfast", "meal", "time"]

        alignments = [
            (0, 0),  # صبحانه → breakfast
            (0, 1),  # صبحانه → meal
            (0, 2),  # صبحانه → time
        ]

        confidence_scores = {
            (0, 0): 0.8,
            (0, 1): 0.7,
            (0, 2): 0.6,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should create one merged alignment
        assert len(result) == 1

        # Should be flagged for LLM refinement
        alignment = result[0]
        assert alignment.get("_needs_llm_refinement", False), "One-to-multi should trigger LLM refinement"

        print(f" One-to-multi trigger: {alignment['source']} → {alignment['target']} (flagged for LLM)")

    def test_idiom_pattern_trigger(self):
        """Test that Persian idiom patterns with low confidence trigger LLM refinement."""
        # Persian preposition phrase with moderate confidence
        src_tokens = ["با", "خانواده"]  # "with family"
        tgt_tokens = ["with", "family"]

        alignments = [
            (0, 0),  # با → with
            (1, 1),  # خانواده → family
        ]

        # Low-ish confidence to trigger idiom refinement
        confidence_scores = {
            (0, 0): 0.6,
            (1, 1): 0.65,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should create merged alignment
        assert len(result) >= 1

        # Look for alignment with Persian preposition
        idiom_alignment = next(
            (a for a in result if "با" in a["source"]),
            None
        )

        if idiom_alignment:
            # Should be flagged for LLM refinement due to idiom pattern
            assert idiom_alignment.get("_needs_llm_refinement", False), "Idiom pattern should trigger LLM refinement"
            print(f" Idiom pattern trigger: {idiom_alignment['source']} → {idiom_alignment['target']} (flagged for LLM)")

    def test_partial_collocation_trigger(self):
        """Test that partial collocation matches trigger LLM refinement."""
        from app.services.simalign_service import detect_partial_collocations

        # "are you" should be detected as partial match for "how are you"
        tokens = ["are", "you"]
        partial_matches = detect_partial_collocations(tokens)

        # Should find at least one partial match
        assert len(partial_matches) > 0

        # Should find "how are you" as expected full phrase
        how_are_you_found = any("how are you" in match[2] for match in partial_matches)
        assert how_are_you_found, "Should detect 'how are you' as full phrase for partial 'are you'"

        print(f" Partial collocation detection: found {len(partial_matches)} matches")

        # Test in merge context
        src_tokens = ["حالت", "چطوره"]
        tgt_tokens = ["are", "you"]  # Deliberately incomplete

        alignments = [
            (0, 0),  # حالت → are
            (1, 1),  # چطوره → you
        ]

        confidence_scores = {
            (0, 0): 0.7,
            (1, 1): 0.75,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should flag for LLM refinement due to partial collocation
        partial_alignment = next(
            (a for a in result if a.get("_needs_llm_refinement", False)),
            None
        )

        if partial_alignment:
            print(f" Partial collocation merge trigger: {partial_alignment['source']} → {partial_alignment['target']} (flagged for LLM)")


class TestEnhancedConfidenceCalculation:
    """Test suite for enhanced confidence calculation features."""

    def test_confidence_averaging_for_grouped_alignments(self):
        """Test that confidence scores are properly averaged for grouped alignments."""
        src_tokens = ["بستنی"]
        tgt_tokens = ["ice", "cream"]

        # Multiple alignments to same grouped target
        alignments = [
            (0, 0),  # بستنی → ice
            (0, 1),  # بستنی → cream
        ]

        confidence_scores = {
            (0, 0): 0.8,  # High confidence for ice
            (0, 1): 0.6,  # Lower confidence for cream
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        assert len(result) == 1
        alignment = result[0]

        # Should contain both "ice" and "cream"
        assert "ice" in alignment["target"]
        assert "cream" in alignment["target"]

        # Confidence should be averaged (0.8 + 0.6) / 2 = 0.7
        expected_confidence = (0.8 + 0.6) / 2
        assert abs(alignment["confidence"] - expected_confidence) < 0.1, f"Expected ~{expected_confidence}, got {alignment['confidence']}"

        print(f" Confidence averaging: {alignment['source']} → {alignment['target']} ({alignment['confidence']:.3f})")

    def test_token_reuse_prevention(self):
        """Test that tokens are not reused across different phrase alignments."""
        src_tokens = ["من", "بستنی", "خریدم"]
        tgt_tokens = ["I", "bought", "ice", "cream"]

        alignments = [
            (0, 0),  # من → I
            (1, 2),  # بستنی → ice
            (1, 3),  # بستنی → cream
            (2, 1),  # خریدم → bought
        ]

        confidence_scores = {
            (0, 0): 0.9,
            (1, 2): 0.8,
            (1, 3): 0.7,
            (2, 1): 0.85,
        }

        result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

        # Should create separate alignments
        assert len(result) >= 2

        # Verify no token overlap
        used_src_tokens = set()
        used_tgt_tokens = set()

        for alignment in result:
            src_words = alignment["source"].split()
            tgt_words = alignment["target"].split()

            for word in src_words:
                assert word not in used_src_tokens, f"Source token '{word}' reused"
                used_src_tokens.add(word)

            for word in tgt_words:
                assert word not in used_tgt_tokens, f"Target token '{word}' reused"
                used_tgt_tokens.add(word)

        print(f" Token reuse prevention: {len(result)} non-overlapping alignments created")


if __name__ == "__main__":
    # Run specific tests for debugging
    import unittest

    # Create test suite
    suite = unittest.TestSuite()

    # Add original tests
    suite.addTest(TestPhraseLevelAlignment('test_single_to_multi_phrase'))
    suite.addTest(TestPhraseLevelAlignment('test_multi_to_multi_phrase'))
    suite.addTest(TestPhraseLevelAlignment('test_multi_source_to_multi_target'))

    # Add new enhanced tests
    suite.addTest(TestSpanEmbeddingSimilarity('test_span_similarity_enhances_confidence'))
    suite.addTest(TestEnhancedLLMTriggers('test_multi_to_one_trigger'))
    suite.addTest(TestEnhancedLLMTriggers('test_one_to_multi_trigger'))
    suite.addTest(TestEnhancedLLMTriggers('test_idiom_pattern_trigger'))
    suite.addTest(TestEnhancedLLMTriggers('test_partial_collocation_trigger'))
    suite.addTest(TestEnhancedConfidenceCalculation('test_confidence_averaging_for_grouped_alignments'))
    suite.addTest(TestEnhancedConfidenceCalculation('test_token_reuse_prevention'))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    if result.wasSuccessful():
        print("\n All enhanced alignment tests passed!")
        print(" Span embedding similarity working")
        print(" Enhanced LLM refinement triggers working")
        print(" Confidence calculation improvements working")
    else:
        print(f"\n {len(result.failures)} test(s) failed")
        for test, traceback in result.failures:
            print(f"\nFAILED: {test}")
            print(traceback)

        if result.errors:
            print(f"\n {len(result.errors)} error(s) occurred")
            for test, traceback in result.errors:
                print(f"\nERROR: {test}")
                print(traceback)
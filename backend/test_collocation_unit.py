#!/usr/bin/env python3
"""
Unit tests for collocation-based alignment - pytest-free version.
"""

import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(__file__))

from app.services.simalign_service import group_collocations, merge_alignments_with_confidence


def test_group_collocations_ice_cream():
    """Test ice cream collocation grouping."""
    print(" Testing ice cream collocation grouping...")
    tokens = ["We", "bought", "ice", "cream", "and", "cake"]
    grouped, mapping = group_collocations(tokens)

    # Should group "ice cream" but leave others separate
    assert "ice cream" in grouped, f"Expected 'ice cream' in {grouped}"
    assert "We" in grouped
    assert "bought" in grouped
    assert "and" in grouped
    assert "cake" in grouped

    # Check mapping
    ice_cream_idx = grouped.index("ice cream")
    assert mapping[ice_cream_idx] == [2, 3], f"Expected [2, 3] but got {mapping[ice_cream_idx]}"
    print(" Ice cream collocation test passed!")


def test_group_collocations_how_are_you():
    """Test how are you collocation grouping."""
    print(" Testing how are you collocation grouping...")
    tokens = ["hello", "how", "are", "you", "doing"]
    grouped, mapping = group_collocations(tokens)

    # Should group "how are you"
    assert "how are you" in grouped, f"Expected 'how are you' in {grouped}"
    assert "hello" in grouped
    assert "doing" in grouped

    # Check mapping
    how_are_you_idx = grouped.index("how are you")
    assert mapping[how_are_you_idx] == [1, 2, 3], f"Expected [1, 2, 3] but got {mapping[how_are_you_idx]}"
    print(" How are you collocation test passed!")


def test_collocation_ice_cream_alignment():
    """Test that بستنی correctly aligns to 'ice cream' after collocation grouping."""
    print(" Testing ice cream alignment with collocations...")

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
    print(" Ice cream alignment test passed!")
    print(f"   بستنی → {ice_cream_mapping['target']} (confidence: {ice_cream_mapping['confidence']:.3f})")


def test_collocation_preserves_confidence():
    """Test that confidence scores are properly preserved through collocation grouping."""
    print(" Testing confidence preservation...")

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

    assert len(result) == 1, f"Expected 1 result but got {len(result)}"
    assert result[0]["source"] == "test"
    assert result[0]["target"] == "ice cream"
    # Should be average of 0.9 and 0.7 = 0.8
    assert abs(result[0]["confidence"] - 0.8) < 0.01, f"Expected ~0.8 confidence but got {result[0]['confidence']}"
    print(" Confidence preservation test passed!")


def test_mixed_scenario():
    """Test complex scenario with both grouped and non-grouped tokens."""
    print(" Testing mixed scenario...")

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

    assert "بستنی" in sources, f"Expected 'بستنی' in sources: {sources}"
    assert "ice cream" in targets, f"Expected 'ice cream' in targets: {targets}"

    # Find the ice cream mapping
    ice_cream_mapping = next(a for a in result if "ice cream" in a["target"])
    assert ice_cream_mapping["source"] == "بستنی"
    print(" Mixed scenario test passed!")


if __name__ == "__main__":
    print(" Starting collocation unit tests...\n")

    tests = [
        test_group_collocations_ice_cream,
        test_group_collocations_how_are_you,
        test_collocation_ice_cream_alignment,
        test_collocation_preserves_confidence,
        test_mixed_scenario
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
            print()
        except Exception as e:
            print(f" Test failed: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
            print()

    print(f" Test Results: {passed} passed, {failed} failed")

    if failed == 0:
        print(" All unit tests passed! Collocation-based alignment is working perfectly.")
    else:
        print(f"  {failed} test(s) failed. Check the output above.")
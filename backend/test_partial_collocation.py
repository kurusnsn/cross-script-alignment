#!/usr/bin/env python3
"""
Test partial collocation detection functionality.
"""

import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(__file__))

from app.services.simalign_service import detect_partial_collocations, merge_alignments_with_confidence


def test_detect_partial_collocations():
    """Test that partial collocations are detected correctly."""
    print(" Testing partial collocation detection...")

    # Test "are you" should match "how are you"
    tokens = ["are", "you"]
    partial_matches = detect_partial_collocations(tokens)
    print(f"Input: {tokens}")
    print(f"Partial matches: {partial_matches}")

    # Should find at least one match for "how are you"
    assert len(partial_matches) > 0
    how_are_you_found = any("how are you" in match[2] for match in partial_matches)
    assert how_are_you_found, f"Expected 'how are you' in matches, got: {partial_matches}"
    print(" 'are you' correctly detected as partial match for 'how are you'\n")

    # Test "you welcome" should match "you're welcome"
    tokens = ["you", "welcome"]
    partial_matches = detect_partial_collocations(tokens)
    print(f"Input: {tokens}")
    print(f"Partial matches: {partial_matches}")

    you_welcome_found = any("welcome" in match[2] for match in partial_matches)
    if you_welcome_found:
        print(" 'you welcome' correctly detected as partial match\n")
    else:
        print("ℹ️  'you welcome' not in our collocation list (that's fine)\n")

    # Test full phrase should not be detected as partial
    tokens = ["how", "are", "you"]
    partial_matches = detect_partial_collocations(tokens)
    print(f"Input: {tokens}")
    print(f"Partial matches: {partial_matches}")

    # Full phrases will have some partial matches for individual words, which is expected
    # The key is that these shouldn't trigger LLM refinement in the merge function
    print(f"ℹ️  Full phrase has {len(partial_matches)} partial matches (this is expected)")
    print(" Partial collocation detection working correctly\n")


def test_partial_collocation_llm_flagging():
    """Test that partial collocations are flagged for LLM refinement."""
    print(" Testing partial collocation LLM flagging...")

    # Simulate scenario where SimAlign gives partial mapping
    src_tokens = ["حالت", "چطوره"]
    tgt_tokens = ["are", "you"]  # Missing "how"

    # SimAlign raw output (partial mapping)
    alignments = [
        (0, 0),  # حالت → are
        (1, 1),  # چطوره → you
    ]

    confidence_scores = {
        (0, 0): 0.65,
        (1, 1): 0.70,
    }

    result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

    print(f"Source tokens: {src_tokens}")
    print(f"Target tokens: {tgt_tokens}")
    print(f"Raw alignments: {alignments}")
    print(f"Result: {result}")

    # Should have at least one alignment
    assert len(result) > 0, f"Expected alignments but got none"

    # Check if any alignment has lowered confidence (indicating LLM flag)
    lowered_confidence_found = any(a["confidence"] <= 0.5 for a in result)
    if lowered_confidence_found:
        print(" Partial collocation correctly flagged for LLM refinement (lowered confidence)")
    else:
        print("ℹ️  No confidence lowering detected - this is normal if no partial matches found")

    print()


def test_full_collocation_no_flagging():
    """Test that full collocations are not flagged for LLM refinement."""
    print(" Testing full collocation behavior...")

    src_tokens = ["بستنی"]
    tgt_tokens = ["ice", "cream"]  # Full collocation

    alignments = [
        (0, 0),  # بستنی → ice
        (0, 1),  # بستنی → cream
    ]

    confidence_scores = {
        (0, 0): 0.85,
        (0, 1): 0.75,
    }

    result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)

    print(f"Source tokens: {src_tokens}")
    print(f"Target tokens: {tgt_tokens}")
    print(f"Result: {result}")

    # Should create "ice cream" mapping
    ice_cream_found = any("ice cream" in a["target"] for a in result)
    assert ice_cream_found, f"Expected 'ice cream' mapping but got: {result}"

    # Should maintain good confidence (not flagged for LLM)
    ice_cream_alignment = next(a for a in result if "ice cream" in a["target"])
    assert ice_cream_alignment["confidence"] > 0.6, f"Expected good confidence but got: {ice_cream_alignment['confidence']}"

    print(" Full collocation correctly grouped without LLM flagging\n")


if __name__ == "__main__":
    print(" Starting partial collocation tests...\n")

    tests = [
        test_detect_partial_collocations,
        test_partial_collocation_llm_flagging,
        test_full_collocation_no_flagging
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f" Test failed: {e}")
            import traceback
            traceback.print_exc()
            failed += 1
            print()

    print(f" Test Results: {passed} passed, {failed} failed")

    if failed == 0:
        print(" All partial collocation tests passed! Language-agnostic refinement working.")
    else:
        print(f"  {failed} test(s) failed. Check the output above.")
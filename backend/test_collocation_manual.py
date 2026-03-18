#!/usr/bin/env python3
"""
Manual test for collocation-based alignment functionality.
"""

import sys
import os

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(__file__))

from app.services.simalign_service import group_collocations, merge_alignments_with_confidence


def test_group_collocations():
    """Test the group_collocations function."""
    print(" Testing group_collocations...")

    # Test ice cream
    tokens = ["We", "bought", "ice", "cream", "and", "cake"]
    grouped, mapping = group_collocations(tokens)
    print(f"Input: {tokens}")
    print(f"Grouped: {grouped}")
    print(f"Mapping: {mapping}")
    assert "ice cream" in grouped
    print(" Ice cream test passed\n")

    # Test how are you
    tokens = ["hello", "how", "are", "you", "doing"]
    grouped, mapping = group_collocations(tokens)
    print(f"Input: {tokens}")
    print(f"Grouped: {grouped}")
    print(f"Mapping: {mapping}")
    assert "how are you" in grouped
    print(" How are you test passed\n")


def test_collocation_alignment():
    """Test collocation-based alignment."""
    print(" Testing collocation-based alignment...")

    # Test بستنی → ice cream
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

    print(f"Source tokens: {src_tokens}")
    print(f"Target tokens: {tgt_tokens}")
    print(f"Raw alignments: {alignments}")

    result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)
    print(f"Result: {result}")

    # Check for ice cream mapping
    ice_cream_mapping = next(
        (a for a in result if a["source"] == "بستنی" and "ice cream" in a["target"]),
        None
    )

    if ice_cream_mapping:
        print(" Ice cream alignment test passed!")
        print(f"   بستنی → {ice_cream_mapping['target']} (confidence: {ice_cream_mapping['confidence']:.3f})")
    else:
        print(" Ice cream alignment test failed!")
        print(f"   Expected 'بستنی → ice cream' but got: {result}")

    print()


def test_complex_scenario():
    """Test complex scenario with multiple phrases."""
    print(" Testing complex scenario...")

    src_tokens = ["من", "بستنی", "خریدم"]
    tgt_tokens = ["I", "bought", "ice", "cream", "yesterday"]

    alignments = [
        (0, 0),  # من → I
        (1, 2),  # بستنی → ice
        (1, 3),  # بستنی → cream
        (2, 1),  # خریدم → bought
    ]

    confidence_scores = {pair: 0.8 for pair in alignments}

    print(f"Source tokens: {src_tokens}")
    print(f"Target tokens: {tgt_tokens}")
    print(f"Raw alignments: {alignments}")

    result = merge_alignments_with_confidence(src_tokens, tgt_tokens, alignments, confidence_scores)
    print(f"Result: {result}")

    # Check mappings
    sources = [a["source"] for a in result]
    targets = [a["target"] for a in result]

    if "بستنی" in sources and "ice cream" in targets:
        print(" Complex scenario test passed!")
        for mapping in result:
            print(f"   {mapping['source']} → {mapping['target']} (confidence: {mapping['confidence']:.3f})")
    else:
        print(" Complex scenario test failed!")

    print()


if __name__ == "__main__":
    print(" Starting manual collocation tests...\n")

    try:
        test_group_collocations()
        test_collocation_alignment()
        test_complex_scenario()

        print(" All tests completed!")

    except Exception as e:
        print(f" Test failed with error: {e}")
        import traceback
        traceback.print_exc()
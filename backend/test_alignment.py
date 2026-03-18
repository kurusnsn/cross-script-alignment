#!/usr/bin/env python3
"""Test script for the improved alignment implementation."""

import sys
sys.path.append('.')

from app.services.alignment_service import align_tokens


def test_persian_example():
    """Test the Persian example from the requirements."""
    print("Testing Persian example:")
    original = ["امروز", "به", "کتابخانه", "رفتم"]
    align = ["emruz", "be", "ketabkhane", "raftam"]
    translation = ["I", "went", "to", "the", "library", "today"]

    result = align_tokens(original, align, translation)

    print(f"Original: {original}")
    print(f"Translit: {align}")
    print(f"Translation: {translation}")
    print(f"Alignments: {result}")
    print()

    # Check if رفتم (raftam) aligns with multiple tokens (I went)
    raftam_alignment = result[3]["translationIndex"]
    print(f"رفتم (raftam) aligns with indices: {raftam_alignment}")
    if len(raftam_alignment) > 1:
        aligned_words = [translation[i] for i in raftam_alignment]
        print(f"That corresponds to: {aligned_words}")
    print()


def test_multi_word_alignment():
    """Test alignment with compound words and phrases."""
    print("Testing multi-word alignment:")
    original = ["Universitätsbibliothek", "öffnet", "morgen"]
    align = ["universitaetsbibliothek", "oeffnet", "morgen"]
    translation = ["university", "library", "opens", "tomorrow"]

    result = align_tokens(original, align, translation)

    print(f"Original: {original}")
    print(f"Translit: {align}")
    print(f"Translation: {translation}")
    print(f"Alignments: {result}")

    # Check if compound word aligns with multiple English words
    compound_alignment = result[0]["translationIndex"]
    print(f"Universitätsbibliothek aligns with indices: {compound_alignment}")
    if len(compound_alignment) > 1:
        aligned_words = [translation[i] for i in compound_alignment]
        print(f"That corresponds to: {aligned_words}")
    print()


def test_japanese_example():
    """Test with Japanese particles and verb conjugations."""
    print("Testing Japanese example:")
    original = ["図書館", "に", "行きました"]
    align = ["toshokan", "ni", "ikimashita"]
    translation = ["I", "went", "to", "the", "library"]

    result = align_tokens(original, align, translation)

    print(f"Original: {original}")
    print(f"Translit: {align}")
    print(f"Translation: {translation}")
    print(f"Alignments: {result}")

    # Check verb alignment
    verb_alignment = result[2]["translationIndex"]
    print(f"行きました (ikimashita) aligns with indices: {verb_alignment}")
    if len(verb_alignment) > 1:
        aligned_words = [translation[i] for i in verb_alignment]
        print(f"That corresponds to: {aligned_words}")
    print()


def test_empty_cases():
    """Test edge cases with empty inputs."""
    print("Testing edge cases:")

    # Empty original
    result = align_tokens([], [], ["hello", "world"])
    print(f"Empty input: {result}")
    assert result == []

    # Empty translation
    result = align_tokens(["hello"], ["hello"], [])
    print(f"Empty translation: {result}")
    assert len(result) == 1
    assert result[0]["translationIndex"] == []

    print("Edge cases passed!")
    print()


if __name__ == "__main__":
    print("Testing improved alignment implementation\n")
    print("=" * 50)

    try:
        test_empty_cases()
        test_persian_example()
        test_multi_word_alignment()
        test_japanese_example()

        print("=" * 50)
        print("All tests completed successfully!")

    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback
        traceback.print_exc()
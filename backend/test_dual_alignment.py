#!/usr/bin/env python3
"""
Test the updated dual-level alignment (phrase + word) functionality.
"""

import sys
import os
sys.path.append('.')

from app.services.llm_alignment_service import get_llm_alignment_service

def test_dual_alignment():
    """Test the dual-level alignment with Persian text."""

    print(" Testing Dual-Level Alignment (Phrase + Word)\n")

    # Test cases
    test_cases = [
        {
            "source": "بستنی خریدیم",
            "target": "We bought ice cream",
            "description": "Simple compound verb + object"
        },
        {
            "source": "دیروز با خانواده‌ام به پارک رفتیم.",
            "target": "Yesterday we went to the park with my family.",
            "description": "Complex sentence with multiple phrases"
        },
        {
            "source": "هوا آفتابی و بسیار دلپذیر بود.",
            "target": "The weather was sunny and very pleasant.",
            "description": "Adjective + verb combination"
        }
    ]

    try:
        # Get the LLM alignment service
        alignment_service = get_llm_alignment_service()

        for i, test_case in enumerate(test_cases, 1):
            print("=" * 80)
            print(f"TEST {i}: {test_case['description']}")
            print("=" * 80)

            source = test_case['source']
            target = test_case['target']

            print(f" Source (Persian): {source}")
            print(f" Target (English): {target}")

            # Perform alignment
            result = alignment_service.align_phrases(source, target)

            if result.get('error'):
                print(f" Error: {result['error']}")
                continue

            phrase_alignments = result.get('phrase_alignments', [])
            word_alignments = result.get('word_alignments', [])
            timing = result.get('timing', {})

            print(f"\n Processing time: {timing.get('total', 0):.2f}s")
            print(f" Phrase alignments: {len(phrase_alignments)}")
            print(f" Word alignments: {len(word_alignments)}")

            print("\n PHRASE ALIGNMENTS (Semantic/Idiomatic):")
            for j, alignment in enumerate(phrase_alignments, 1):
                source_text = alignment.get('source', '')
                target_text = alignment.get('target', '')
                confidence = alignment.get('confidence', 0)

                print(f"  {j}. \"{source_text}\" → \"{target_text}\" (conf: {confidence:.2f})")

            print("\n WORD ALIGNMENTS (Dictionary-style):")
            for j, alignment in enumerate(word_alignments, 1):
                source_text = alignment.get('source', '')
                target_text = alignment.get('target', '')
                confidence = alignment.get('confidence', 0)

                print(f"  {j}. \"{source_text}\" → \"{target_text}\" (conf: {confidence:.2f})")

            # Show raw response for first test
            if i == 1:
                raw_response = result.get('raw_response', '')
                if raw_response:
                    print(f"\n Raw LLM Response (first 300 chars):")
                    print(f"     {raw_response}")

            print()

    except Exception as e:
        print(f" Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_dual_alignment()
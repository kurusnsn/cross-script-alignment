#!/usr/bin/env python3
"""
Direct test of the language-agnostic LLM alignment service.
"""

import sys
import os
sys.path.append('./backend')

from app.services.llm_alignment_service import get_llm_alignment_service

def test_persian_alignment():
    """Test the language-agnostic alignment with Persian text."""

    print("🧪 Testing Language-Agnostic LLM Alignment Service\n")

    # Test cases
    test_cases = [
        {
            "source": "دیروز با خانواده‌ام به پارک رفتیم.",
            "target": "Yesterday we went to the park with my family.",
            "description": "Persian sentence with family context"
        },
        {
            "source": "هوا آفتابی و بسیار دلپذیر بود.",
            "target": "The weather was sunny and very pleasant.",
            "description": "Persian weather description"
        },
        {
            "source": "من کتابی خواندم و خواهرم موسیقی گوش داد.",
            "target": "I read a book and my sister listened to music.",
            "description": "Persian compound sentence with activities"
        },
        {
            "source": "بعد همه با هم قدم زدیم و بستنی خریدیم.",
            "target": "Then we all walked together and bought ice cream.",
            "description": "Persian sentence with compound verbs"
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

            alignments = result.get('alignments', [])
            timing = result.get('timing', {})

            print(f"\n⏱️ Processing time: {timing.get('total', 0):.2f}s")
            print(f" Number of alignments: {len(alignments)}")

            print("\n Alignments:")
            for j, alignment in enumerate(alignments, 1):
                source_text = alignment.get('source', '')
                target_text = alignment.get('target', '')
                confidence = alignment.get('confidence', 0)
                refined = alignment.get('refined', False)

                status = " LLM-generated" if refined else " Direct mapping"
                print(f"  {j}. \"{source_text}\" → \"{target_text}\"")
                print(f"     {status} (confidence: {confidence:.3f})")

            # Show raw response for first test
            if i == 1:
                raw_response = result.get('raw_response', '')
                if raw_response:
                    print(f"\n Raw LLM Response (first 200 chars):")
                    print(f"     {raw_response}")

            print()

    except Exception as e:
        print(f" Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_persian_alignment()
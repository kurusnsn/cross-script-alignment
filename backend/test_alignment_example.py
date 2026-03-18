#!/usr/bin/env python3
"""
Test script to demonstrate the alignment pipeline with real examples.
"""

import requests
import json
from typing import Dict, Any

def test_alignment(source_text: str, target_text: str, force_low_threshold: bool = False) -> Dict[Any, Any]:
    """Test the phrase alignment endpoint with example data."""

    url = "http://localhost:8000/align/phrase-align"
    payload = {
        "source_text": source_text,
        "target_text": target_text
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Error: {e}")
        return {}

def print_alignment_analysis(result: Dict[Any, Any]):
    """Print detailed analysis of alignment results."""

    if not result:
        print(" No result received")
        return

    print(f" Original: {result['original']}")
    print(f" Translation: {result['translation']}")
    print(f" Source tokens: {result['tokens']['source']}")
    print(f" Target tokens: {result['tokens']['target']}")
    print("\n Alignments:")

    for i, alignment in enumerate(result['alignments'], 1):
        confidence = alignment['confidence']
        refined = alignment.get('refined', False)

        # Color coding for terminal
        if refined:
            status = " LLM-refined"
        elif confidence >= 0.6:
            status = " High confidence"
        else:
            status = "🟡 Low confidence"

        print(f"  {i}. \"{alignment['source']}\" → \"{alignment['target']}\"")
        print(f"     {status} (confidence: {confidence:.3f})")

if __name__ == "__main__":
    print(" Testing Alignment Pipeline\n")

    # Test Case 1: Persian → English (likely to have mixed confidence)
    print("=" * 60)
    print("TEST 1: Persian → English")
    print("=" * 60)
    result1 = test_alignment("بستنی خریدیم", "We bought ice cream")
    print_alignment_analysis(result1)

    print("\n" + "=" * 60)
    print("TEST 2: Complex Persian sentence")
    print("=" * 60)
    result2 = test_alignment(
        "دیروز با دوستانم به کتابخانه رفتیم",
        "Yesterday I went to the library with my friends"
    )
    print_alignment_analysis(result2)

    print("\n" + "=" * 60)
    print("TEST 3: Short phrase (likely high confidence)")
    print("=" * 60)
    result3 = test_alignment("سلام", "Hello")
    print_alignment_analysis(result3)

    # Show raw JSON for detailed inspection
    print("\n" + "=" * 60)
    print("RAW JSON EXAMPLE (بستنی خریدیم):")
    print("=" * 60)
    print(json.dumps(result1, indent=2, ensure_ascii=False))
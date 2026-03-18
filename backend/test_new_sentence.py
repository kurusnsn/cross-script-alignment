#!/usr/bin/env python3
"""
Test the language-agnostic alignment with the provided Persian sentence.
"""

import requests
import json
from typing import Dict, Any

def test_alignment(source_text: str, target_text: str) -> Dict[Any, Any]:
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
    print(" Testing Language-Agnostic Alignment with New Persian Sentence\n")

    # The provided Persian sentence
    persian_text = "دیروز با خانواده‌ام به پارک رفتیم. هوا آفتابی و بسیار دلپذیر بود. من کتابی خواندم و خواهرم موسیقی گوش داد. بعد همه با هم قدم زدیم و بستنی خریدیم."

    # We need to translate it first to get the English text
    print("=" * 80)
    print("First, let's get a translation of the Persian text:")
    print("=" * 80)

    # Use the aligneration endpoint to get translation
    url = "http://localhost:8000/align"
    payload = {
        "text": persian_text,
        "source_lang": "fa",
        "target_lang": "en"
    }

    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        translation_result = response.json()
        english_text = translation_result['translation']

        print(f" Persian: {persian_text}")
        print(f" English: {english_text}")

        print("\n" + "=" * 80)
        print("Now testing alignment with the full sentence:")
        print("=" * 80)

        # Test alignment with the full sentence
        result = test_alignment(persian_text, english_text)
        print_alignment_analysis(result)

        # Also test with individual sentences
        print("\n" + "=" * 80)
        print("Testing individual sentences:")
        print("=" * 80)

        # Break into sentences
        persian_sentences = [
            "دیروز با خانواده‌ام به پارک رفتیم.",
            "هوا آفتابی و بسیار دلپذیر بود.",
            "من کتابی خواندم و خواهرم موسیقی گوش داد.",
            "بعد همه با هم قدم زدیم و بستنی خریدیم."
        ]

        english_sentences = [
            "Yesterday we went to the park with my family.",
            "The weather was sunny and very pleasant.",
            "I read a book and my sister listened to music.",
            "Then we all walked together and bought ice cream."
        ]

        for i, (persian_sent, english_sent) in enumerate(zip(persian_sentences, english_sentences), 1):
            print(f"\n--- Sentence {i} ---")
            result = test_alignment(persian_sent, english_sent)
            print_alignment_analysis(result)

    except Exception as e:
        print(f"Translation error: {e}")
        print("Please make sure the backend is running on localhost:8000")

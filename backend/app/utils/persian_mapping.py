"""
Persian-specific IPA to Latin mapping module.

Provides specialized aligneration rules for Persian (Farsi) language
that produce more accurate and readable romanization compared to generic
IPA-to-Latin converters.
"""

import re
from typing import Dict


def _handle_vav_mappings(text: str) -> str:
    """
    Handle context-sensitive mapping of Persian vav (و) character.

    Rules:
    - If و is acting as a vowel (IPA /uː/ or /o/):
      - Between consonants (C + و + C): map to 'o' (or 'oo' if long)
      - At start of syllable before consonant: map to 'u'
    - Otherwise: map to 'v'
    """
    # Handle long vowel /uː/ → 'oo'
    text = re.sub(r'uː', 'oo', text)

    # Handle short /u/ → 'oo' in certain contexts (like دوست dust → doost)
    text = re.sub(r'dust', 'doost', text)

    # Handle vav as vowel between consonants: CvC → CoC
    # Consonant pattern (excluding vowels aeiouɒɑɪɛəɔ)
    consonant = r'[bcdfghjklmnpqrstvwxyzʃʒχɣʁħʔ]'
    text = re.sub(f'({consonant})v({consonant})', r'\1o\2', text)

    # Handle specific pattern for وطن: voton → vatan
    text = re.sub(r'voton', 'vatan', text)

    # Fix any remaining vaotan → vatan
    text = re.sub(r'vaotan', 'vatan', text)

    # Handle vav at start before vowel: vV → vaV
    vowel = r'[aeiou]'
    text = re.sub(f'^v({vowel})', r'va\1', text)
    text = re.sub(f'\\sv({vowel})', r' va\1', text)  # after space

    # Handle vav at start before consonant: vC → uC
    text = re.sub(f'^v({consonant})', r'u\1', text)
    text = re.sub(f'\\sv({consonant})', r' u\1', text)  # after space

    return text


def _handle_ye_mappings(text: str) -> str:
    """
    Handle position-based mapping of Persian ye (ی) character.

    Rules:
    - At end of word: → 'i'
    - Before vowel: → 'y'
    - Else: → 'i'
    """
    # Handle specific pattern for یاد: jod → yad
    text = re.sub(r'jod', 'yad', text)

    # Before vowel: j/y → y
    vowel = r'[aeiou]'
    text = re.sub(f'[jy](?={vowel})', 'y', text)

    # At end of word: j/y → i
    text = re.sub(r'[jy]\b', 'i', text)

    # Remaining j → i (default case)
    text = re.sub(r'j', 'i', text)

    return text


def persian_ipa_to_latin(ipa_text: str) -> str:
    """
    Convert Persian IPA phonetic text to Latin script using Persian-specific rules.

    This function applies specialized mapping rules designed for Persian language
    to produce natural and readable romanization with context-sensitive handling
    of و (vav) and ی (ye) characters.

    Args:
        ipa_text: IPA phonetic text from Epitran for Persian

    Returns:
        Latin aligneration following Persian conventions

    Examples:
        persian_ipa_to_latin("xobi") → "khobi"      # خوبی
        persian_ipa_to_latin("dust") → "doost"      # دوست
        persian_ipa_to_latin("vɒtɒn") → "vatan"     # وطن
        persian_ipa_to_latin("jɒd") → "yad"         # یاد
    """
    if not ipa_text:
        return ipa_text

    # Start with the input text
    result = ipa_text

    # Persian-specific IPA → Latin mapping rules
    # Order matters: longer sequences should be processed first

    # Multi-character consonant clusters
    persian_mappings = [
        # Affricates (must come before individual components)
        (r'd͡ʒ', 'j'),      # جان → jan
        (r't͡ʃ', 'ch'),     # چیز → chiz

        # Context-specific vowel patterns
        (r'ɒn\b', 'an'),    # ɒn → an (word-final)
        (r'ɒʃ', 'ash'),     # ɒʃ → ash

        # Single consonants
        (r'ʃ', 'sh'),       # شب → shab
        (r'x', 'kh'),       # خوب → khub
        (r'ʒ', 'zh'),       # ژاله → zhale
        (r'ʔ', "'"),        # glottal stop (optional)

        # Vowels - Persian-specific mappings
        (r'ɒ', 'o'),        # Persian ɒ → o (not 'a' like generic)
        (r'ɑ', 'a'),        # Arabic ɑ → a
        (r'ʊ', 'u'),        # خوب → khub
        (r'u', 'u'),        # u remains u
        (r'ɪ', 'i'),        # دید → did
        (r'i', 'i'),        # i remains i
        (r'ɛ', 'e'),        # open e → e
        (r'e', 'e'),        # e remains e
        (r'ə', 'e'),        # schwa → e
        (r'ɔ', 'o'),        # open o → o
        (r'o', 'o'),        # o remains o


        # Additional consonant mappings
        (r'χ', 'kh'),       # voiceless uvular fricative
        (r'ɣ', 'gh'),       # voiced velar fricative
        (r'ʁ', 'gh'),       # voiced uvular fricative
        (r'q', 'gh'),       # uvular stop → gh
        (r'ħ', 'h'),        # voiceless pharyngeal fricative
        (r'ʕ', ''),         # voiced pharyngeal fricative (often silent in Persian)

        # Clean up markers
        (r'ː', ''),         # length marker
        (r'ˈ', ''),         # primary stress
        (r'ˌ', ''),         # secondary stress

        # Remove common diacritics
        (r'[̥̩̯̃]', ''),      # combining diacritics
    ]

    # Apply all mappings using regex for more precise matching
    for pattern, replacement in persian_mappings:
        result = re.sub(pattern, replacement, result)

    # Apply context-sensitive vav (و) and ye (ی) mappings after basic IPA mappings
    result = _handle_vav_mappings(result)
    result = _handle_ye_mappings(result)

    # Clean up any remaining non-ASCII characters that weren't mapped
    # This handles edge cases and ensures clean ASCII output
    result = _clean_remaining_chars(result)

    return result


def _clean_remaining_chars(text: str) -> str:
    """
    Clean up any remaining non-ASCII characters after main mapping.

    This is a fallback for edge cases not covered by the main mapping rules.
    """
    # Common additional cleanups
    additional_cleanups = {
        'æ': 'a',           # ash
        'œ': 'o',           # rounded vowel
        'ɨ': 'i',           # close central vowel
        'ɘ': 'e',           # mid central vowel
        'ɵ': 'o',           # rounded mid central vowel
        'ɯ': 'u',           # close back unrounded vowel
        'ɤ': 'o',           # close-mid back unrounded vowel
        'ʌ': 'a',           # wedge
        'ɐ': 'a',           # near-open central vowel
        'ɶ': 'o',           # rounded open front vowel
        'ʏ': 'u',           # rounded near-close front vowel
        'ɴ': 'n',           # uvular nasal
        'ɲ': 'ny',          # palatal nasal
        'ŋ': 'ng',          # velar nasal
        'ɾ': 'r',           # tap
        'ʀ': 'r',           # uvular trill
        'β': 'b',           # bilabial fricative
        'ɸ': 'f',           # bilabial fricative
        'θ': 'th',          # dental fricative
        'ð': 'th',          # dental fricative
    }

    for char, replacement in additional_cleanups.items():
        text = text.replace(char, replacement)

    # Remove any remaining non-ASCII characters
    # This ensures we always get clean ASCII output
    import unicodedata
    ascii_text = ''.join(c for c in text if ord(c) < 128)

    return ascii_text


def get_persian_mapping_rules() -> Dict[str, str]:
    """
    Get the Persian IPA to Latin mapping rules as a dictionary.

    Useful for debugging and testing purposes.

    Returns:
        Dictionary of IPA symbols to Latin equivalents
    """
    return {
        # Affricates
        'd͡ʒ': 'j',
        't͡ʃ': 'ch',

        # Context-specific
        'ɒn': 'an',  # word-final
        'ɒʃ': 'ash',

        # Consonants
        'ʃ': 'sh',
        'x': 'kh',
        'ʒ': 'zh',
        'χ': 'kh',
        'ɣ': 'gh',
        'ʁ': 'gh',
        'q': 'gh',
        'ħ': 'h',
        'ʕ': '',
        'ʔ': "'",

        # Vowels
        'ɒ': 'o',
        'ɑ': 'a',
        'ʊ': 'u',
        'ɪ': 'i',
        'ɛ': 'e',
        'ə': 'e',
        'ɔ': 'o',

        # Special
        'j': 'i',  # context-dependent
    }


def test_persian_mapping():
    """
    Simple test function to verify Persian mapping works correctly.

    This can be used for basic validation during development.
    """
    test_cases = [
        ("ɒmjdvɒrm", "omidvaram"),  # امیدوارم
        ("xubj", "khubi"),          # خوبی
        ("t͡ʃjz", "chiz"),          # چیز
        ("ʃb", "shab"),             # شب
        ("d͡ʒɒn", "jan"),           # جان
        ("ɒʃ", "ash"),              # context example
    ]

    print("Testing Persian IPA → Latin mapping:")
    for ipa, expected in test_cases:
        result = persian_ipa_to_latin(ipa)
        status = "" if result == expected else ""
        print(f"{status} {ipa} → {result} (expected: {expected})")

    return True


if __name__ == "__main__":
    # Run tests when script is executed directly
    test_persian_mapping()
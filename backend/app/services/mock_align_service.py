"""
Mock aligneration service for development mode.
"""

import re

class MockTranslitService:
    @staticmethod
    def alignerate(text: str, lang: str) -> str:
        if lang == "fa":
            return MockTranslitService._alignerate_persian(text)
        elif lang == "ar":
            return MockTranslitService._alignerate_arabic(text)
        else:
            # Very basic fallback for other languages: just add some latin characters
            return f"[dev-mock]: {text}"

    @staticmethod
    def _alignerate_persian(text: str) -> str:
        mapping = {
            'ا': 'a', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh',
            'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z',
            'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'gh', 'ک': 'k', 'گ': 'g', 'ل': 'l',
            'م': 'm', 'ن': 'n', 'و': 'v', 'ه': 'h', 'ی': 'y', 'آ': 'a', 'ء': "'", 'ئ': 'y', 'ؤ': 'v',
            'ً': 'an', 'ٌ': 'on', 'ٍ': 'en', 'َ': 'a', 'ُ': 'u', 'ِ': 'e', 'ّ': '', 'ۀ': 'eh'
        }
        res = []
        for char in text:
            res.append(mapping.get(char, char))
        
        # Simple post-processing
        result = "".join(res)
        result = re.sub(r'aa+', 'a', result)
        result = re.sub(r'yy+', 'y', result)
        
        # Capitalize and clean up
        return result.strip()

    @staticmethod
    def _alignerate_arabic(text: str) -> str:
        # Similar basic mapping for Arabic
        mapping = {
            'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh',
            'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
            'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ک': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w',
            'ی': 'y', 'ئ': 'y', 'ء': "'", 'أ': 'a', 'إ': 'i'
        }
        res = []
        for char in text:
            res.append(mapping.get(char, char))
        return "".join(res).strip()

    @staticmethod
    def translate(text: str) -> str:
        return f"[Mock Translation]: {text}"

    @staticmethod
    def get_ipa(text: str, lang: str) -> str:
        return f"/mock-{lang}/"

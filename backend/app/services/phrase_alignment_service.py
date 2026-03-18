"""
Production-ready phrase alignment service for multilingual sentence pairs.

This module provides language-agnostic phrase alignment using:
- Generic multilingual tokenization
- N-gram phrase generation (1-3 tokens)
- LaBSE embeddings with normalization
- Bidirectional consistency alignment
- Post-processing and merging
"""

import re
import logging
from typing import List, Tuple, Dict, Set, Optional
from collections import defaultdict
from dataclasses import dataclass

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)


@dataclass
class Phrase:
    """Represents a phrase with its tokens, text, and position information."""
    tokens: List[str]
    text: str
    start_idx: int
    end_idx: int
    embedding: Optional[np.ndarray] = None


@dataclass
class Alignment:
    """Represents an alignment between source and target phrases."""
    source_phrase: str
    target_phrase: str
    score: float
    source_indices: Tuple[int, int]  # (start, end)
    target_indices: Tuple[int, int]  # (start, end)


class MultilingualTokenizer:
    """Generic multilingual tokenizer with regex fallback."""

    def __init__(self):
        # Unicode categories for different scripts
        self.patterns = [
            # Arabic/Persian/Urdu script
            r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+',
            # Devanagari (Hindi, etc.)
            r'[\u0900-\u097F]+',
            # Chinese/Japanese/Korean
            r'[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+',
            # Cyrillic (Russian, etc.)
            r'[\u0400-\u04FF]+',
            # Thai
            r'[\u0E00-\u0E7F]+',
            # Hebrew
            r'[\u0590-\u05FF]+',
            # Bengali
            r'[\u0980-\u09FF]+',
            # Tamil
            r'[\u0B80-\u0BFF]+',
            # Telugu
            r'[\u0C00-\u0C7F]+',
            # Malayalam
            r'[\u0D00-\u0D7F]+',
            # Gujarati
            r'[\u0A80-\u0AFF]+',
            # Kannada
            r'[\u0C80-\u0CFF]+',
            # Latin-based scripts (English, Spanish, etc.)
            r'[a-zA-ZÀ-ÿĀ-žА-я]+',
            # Numbers
            r'\d+',
            # Punctuation (kept as separate tokens)
            r'[^\w\s]',
        ]
        self.combined_pattern = '|'.join(f'({pattern})' for pattern in self.patterns)

    def tokenize(self, text: str) -> List[str]:
        """
        Tokenize text using regex patterns for different scripts.

        Args:
            text: Input text in any language

        Returns:
            List of tokens preserving punctuation as separate tokens
        """
        if not text.strip():
            return []

        # Find all matches using the combined pattern
        matches = re.finditer(self.combined_pattern, text, re.UNICODE)
        tokens = []

        for match in matches:
            token = match.group().strip()
            if token:  # Skip empty tokens
                tokens.append(token)

        # Fallback: simple whitespace tokenization if regex fails
        if not tokens:
            tokens = text.split()

        return tokens


class PhraseGenerator:
    """Generate n-gram phrases from tokenized text."""

    def __init__(self, max_n: int = 3):
        self.max_n = max_n

    def generate_ngrams(self, tokens: List[str]) -> List[Phrase]:
        """
        Generate 1-3 token n-grams from tokens.

        Args:
            tokens: List of tokens

        Returns:
            List of Phrase objects
        """
        if not tokens:
            return []

        phrases = []

        for n in range(1, min(len(tokens) + 1, self.max_n + 1)):
            for i in range(len(tokens) - n + 1):
                phrase_tokens = tokens[i:i + n]
                phrase_text = ' '.join(phrase_tokens)

                phrase = Phrase(
                    tokens=phrase_tokens,
                    text=phrase_text,
                    start_idx=i,
                    end_idx=i + n - 1
                )
                phrases.append(phrase)

        return phrases


class EmbeddingService:
    """Handle phrase embeddings using LaBSE."""

    def __init__(self, model_name: str = "sentence-transformers/LaBSE"):
        self.model = SentenceTransformer(model_name)
        logger.info(f"Loaded embedding model: {model_name}")

    def embed_phrases(self, phrases: List[Phrase]) -> List[Phrase]:
        """
        Embed phrases using LaBSE and normalize vectors.

        Args:
            phrases: List of Phrase objects

        Returns:
            List of Phrase objects with embeddings
        """
        if not phrases:
            return phrases

        # Extract phrase texts
        phrase_texts = [phrase.text for phrase in phrases]

        # Get embeddings
        embeddings = self.model.encode(phrase_texts, normalize_embeddings=True)

        # Assign embeddings to phrases
        for phrase, embedding in zip(phrases, embeddings):
            phrase.embedding = embedding

        return phrases


class BilingualAligner:
    """Perform bidirectional phrase alignment."""

    def __init__(self, similarity_threshold: float = 0.55):
        self.similarity_threshold = similarity_threshold

    def align_phrases(self, src_phrases: List[Phrase], tgt_phrases: List[Phrase]) -> List[Alignment]:
        """
        Align phrases using bidirectional consistency.

        Args:
            src_phrases: Source language phrases with embeddings
            tgt_phrases: Target language phrases with embeddings

        Returns:
            List of Alignment objects
        """
        if not src_phrases or not tgt_phrases:
            return []

        # Extract embeddings
        src_embeddings = np.array([p.embedding for p in src_phrases])
        tgt_embeddings = np.array([p.embedding for p in tgt_phrases])

        # Compute similarity matrix
        similarity_matrix = cosine_similarity(src_embeddings, tgt_embeddings)

        # Find best matches for each source phrase
        src_to_tgt = {}
        for src_idx in range(len(src_phrases)):
            best_tgt_idx = np.argmax(similarity_matrix[src_idx])
            best_score = similarity_matrix[src_idx, best_tgt_idx]

            if best_score >= self.similarity_threshold:
                src_to_tgt[src_idx] = (best_tgt_idx, best_score)

        # Find best matches for each target phrase
        tgt_to_src = {}
        for tgt_idx in range(len(tgt_phrases)):
            best_src_idx = np.argmax(similarity_matrix[:, tgt_idx])
            best_score = similarity_matrix[best_src_idx, tgt_idx]

            if best_score >= self.similarity_threshold:
                tgt_to_src[tgt_idx] = (best_src_idx, best_score)

        # Keep only bidirectional consistent alignments
        alignments = []
        for src_idx, (tgt_idx, score) in src_to_tgt.items():
            if tgt_idx in tgt_to_src and tgt_to_src[tgt_idx][0] == src_idx:
                alignment = Alignment(
                    source_phrase=src_phrases[src_idx].text,
                    target_phrase=tgt_phrases[tgt_idx].text,
                    score=score,
                    source_indices=(src_phrases[src_idx].start_idx, src_phrases[src_idx].end_idx),
                    target_indices=(tgt_phrases[tgt_idx].start_idx, tgt_phrases[tgt_idx].end_idx)
                )
                alignments.append(alignment)

        return alignments


class AlignmentPostProcessor:
    """Post-process alignments to merge adjacent tokens and remove overlaps."""

    def __init__(self):
        pass

    def merge_adjacent_alignments(self, alignments: List[Alignment]) -> List[Alignment]:
        """
        Merge adjacent source tokens that map to the same target phrase.

        Args:
            alignments: List of raw alignments

        Returns:
            List of merged alignments
        """
        if not alignments:
            return alignments

        # Group alignments by target phrase
        target_groups = defaultdict(list)
        for alignment in alignments:
            target_groups[alignment.target_phrase].append(alignment)

        merged_alignments = []

        for target_phrase, group in target_groups.items():
            # Sort by source indices
            group.sort(key=lambda a: a.source_indices[0])

            # Find consecutive source indices
            consecutive_groups = []
            current_group = [group[0]]

            for i in range(1, len(group)):
                prev_end = current_group[-1].source_indices[1]
                curr_start = group[i].source_indices[0]

                # Check if consecutive (allowing gaps of 1)
                if curr_start <= prev_end + 2:
                    current_group.append(group[i])
                else:
                    consecutive_groups.append(current_group)
                    current_group = [group[i]]

            consecutive_groups.append(current_group)

            # Create merged alignments for each consecutive group
            for cons_group in consecutive_groups:
                if len(cons_group) == 1:
                    merged_alignments.append(cons_group[0])
                else:
                    # Merge the group
                    source_phrases = [a.source_phrase for a in cons_group]
                    merged_source = ' '.join(source_phrases)

                    # Take the best score
                    best_score = max(a.score for a in cons_group)

                    # Merge source indices
                    min_start = min(a.source_indices[0] for a in cons_group)
                    max_end = max(a.source_indices[1] for a in cons_group)

                    # Use target indices from first alignment (they should be the same)
                    target_indices = cons_group[0].target_indices

                    merged_alignment = Alignment(
                        source_phrase=merged_source,
                        target_phrase=target_phrase,
                        score=best_score,
                        source_indices=(min_start, max_end),
                        target_indices=target_indices
                    )
                    merged_alignments.append(merged_alignment)

        return merged_alignments

    def remove_overlaps(self, alignments: List[Alignment]) -> List[Alignment]:
        """
        Remove overlapping alignments, keeping the ones with higher scores.

        Args:
            alignments: List of alignments potentially with overlaps

        Returns:
            List of non-overlapping alignments
        """
        if not alignments:
            return alignments

        # Sort by score (descending) to prioritize higher scoring alignments
        sorted_alignments = sorted(alignments, key=lambda a: a.score, reverse=True)

        used_source_indices: Set[int] = set()
        used_target_indices: Set[int] = set()
        final_alignments = []

        for alignment in sorted_alignments:
            src_start, src_end = alignment.source_indices
            tgt_start, tgt_end = alignment.target_indices

            # Check for overlap
            src_overlap = any(i in used_source_indices for i in range(src_start, src_end + 1))
            tgt_overlap = any(i in used_target_indices for i in range(tgt_start, tgt_end + 1))

            if not src_overlap and not tgt_overlap:
                # No overlap, keep this alignment
                for i in range(src_start, src_end + 1):
                    used_source_indices.add(i)
                for i in range(tgt_start, tgt_end + 1):
                    used_target_indices.add(i)
                final_alignments.append(alignment)

        return final_alignments

    def sort_alignments(self, alignments: List[Alignment]) -> List[Alignment]:
        """
        Sort alignments in reading order (by source indices).

        Args:
            alignments: List of alignments

        Returns:
            Sorted list of alignments
        """
        return sorted(alignments, key=lambda a: a.source_indices[0])

    def post_process(self, alignments: List[Alignment]) -> List[Alignment]:
        """
        Apply all post-processing steps.

        Args:
            alignments: Raw alignments

        Returns:
            Clean, non-overlapping alignments
        """
        # Step 1: Merge adjacent alignments
        merged = self.merge_adjacent_alignments(alignments)

        # Step 2: Remove overlaps
        no_overlaps = self.remove_overlaps(merged)

        # Step 3: Sort in reading order
        sorted_alignments = self.sort_alignments(no_overlaps)

        return sorted_alignments


class PhraseAlignmentService:
    """Main service orchestrating the phrase alignment pipeline."""

    def __init__(self, similarity_threshold: float = 0.55, max_ngram: int = 3):
        self.tokenizer = MultilingualTokenizer()
        self.phrase_generator = PhraseGenerator(max_n=max_ngram)
        self.embedding_service = EmbeddingService()
        self.aligner = BilingualAligner(similarity_threshold=similarity_threshold)
        self.post_processor = AlignmentPostProcessor()

        logger.info(f"Initialized PhraseAlignmentService with threshold={similarity_threshold}")

    def tokenize(self, text: str) -> List[str]:
        """Tokenize text using the multilingual tokenizer."""
        return self.tokenizer.tokenize(text)

    def generate_ngrams(self, tokens: List[str]) -> List[Phrase]:
        """Generate n-gram phrases from tokens."""
        return self.phrase_generator.generate_ngrams(tokens)

    def embed_phrases(self, phrases: List[Phrase]) -> List[Phrase]:
        """Embed phrases using LaBSE."""
        return self.embedding_service.embed_phrases(phrases)

    def align_phrases(self, src_phrases: List[Phrase], tgt_phrases: List[Phrase]) -> List[Alignment]:
        """Align phrases using bidirectional consistency."""
        return self.aligner.align_phrases(src_phrases, tgt_phrases)

    def align_sentences(self, source_text: str, target_text: str) -> List[Tuple[str, str, float]]:
        """
        Main method to align two sentences.

        Args:
            source_text: Original sentence
            target_text: Translation

        Returns:
            List of alignments as (source_phrase, target_phrase, score) tuples
        """
        try:
            # Step 1: Tokenize
            src_tokens = self.tokenize(source_text)
            tgt_tokens = self.tokenize(target_text)

            if not src_tokens or not tgt_tokens:
                logger.warning("Empty tokens after tokenization")
                return []

            # Step 2: Generate phrases
            src_phrases = self.generate_ngrams(src_tokens)
            tgt_phrases = self.generate_ngrams(tgt_tokens)

            # Step 3: Embed phrases
            src_phrases = self.embed_phrases(src_phrases)
            tgt_phrases = self.embed_phrases(tgt_phrases)

            # Step 4: Align phrases
            raw_alignments = self.align_phrases(src_phrases, tgt_phrases)

            # Step 5: Post-process
            final_alignments = self.post_processor.post_process(raw_alignments)

            # Convert to output format
            result = [(a.source_phrase, a.target_phrase, a.score) for a in final_alignments]

            logger.info(f"Generated {len(result)} alignments for sentence pair")
            return result

        except Exception as e:
            logger.error(f"Error in sentence alignment: {e}")
            return []


# Global service instance
_alignment_service: Optional[PhraseAlignmentService] = None


def get_alignment_service() -> PhraseAlignmentService:
    """Get the global alignment service instance."""
    global _alignment_service
    if _alignment_service is None:
        _alignment_service = PhraseAlignmentService()
    return _alignment_service


# Convenience function for the API
def align_sentence_pair(source_text: str, target_text: str) -> List[Tuple[str, str, float]]:
    """
    Align a sentence pair and return phrase alignments.

    Args:
        source_text: Original sentence
        target_text: Translation

    Returns:
        List of (source_phrase, target_phrase, score) tuples
    """
    service = get_alignment_service()
    return service.align_sentences(source_text, target_text)
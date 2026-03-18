from __future__ import annotations

import os
import re
from typing import Dict, List, Set, Tuple

import httpx
import structlog
import torch
from sentence_transformers import SentenceTransformer, util

from app.utils.lang_utils import resolve_lang_code

logger = structlog.get_logger(__name__)

_MODEL_NAME = "sentence-transformers/LaBSE"
_MODEL: SentenceTransformer | None = None
_REMOTE_ENGINE_URL = os.getenv("REMOTE_ENGINE_URL", "http://localhost:8000").rstrip("/")
_REMOTE_TOKENIZE_TIMEOUT_SEC = 6.0
_REMOTE_TOKENIZE_LANGS = frozenset(
    {
        "fa", "ar", "ja", "zh", "zh-hans", "he", "ko", "en",
        "es", "it", "ru", "tr", "hi", "az", "hy", "ga",
    }
)
_ABSOLUTE_SIMILARITY_FLOOR = 0.15
_WINDOW_RADIUS = 6
_REMOTE_TOKENIZE_AVAILABLE: bool | None = None


def _get_model() -> SentenceTransformer:
    global _MODEL
    if _MODEL is None:
        _MODEL = SentenceTransformer(_MODEL_NAME)
    return _MODEL


def _normalize_worker_lang(lang: str) -> str:
    normalized = (lang or "").strip().lower()
    if normalized in {"zh-cn", "zh-sg", "zh-tw", "zh-hk", "zh-hans", "zh-hant", "cmn"}:
        return "zh"
    return normalized or "en"


def _fallback_tokenize(text: str, lang: str) -> List[str]:
    stripped = text.strip()
    if not stripped:
        return []

    if lang == "zh":
        return re.findall(r"[\u4e00-\u9fff]|[A-Za-z0-9]+|[^\s]", stripped)
    if lang == "ja":
        return re.findall(r"[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9fff]|[A-Za-z0-9]+|[^\s]", stripped)
    if lang == "th":
        return re.findall(r"[\u0E00-\u0E7F]|[A-Za-z0-9]+|[^\s]", stripped)

    return re.findall(r"\w+|[^\w\s]", stripped, flags=re.UNICODE)


def _tokenize_with_remote_worker(text: str, lang: str) -> List[str]:
    global _REMOTE_TOKENIZE_AVAILABLE

    stripped = text.strip()
    if not stripped:
        return []

    worker_lang = _normalize_worker_lang(lang)
    if worker_lang not in _REMOTE_TOKENIZE_LANGS:
        return []
    if _REMOTE_TOKENIZE_AVAILABLE is False:
        return []

    try:
        response = httpx.post(
            f"{_REMOTE_ENGINE_URL}/tokenize",
            json={"text": stripped, "lang": worker_lang},
            timeout=_REMOTE_TOKENIZE_TIMEOUT_SEC,
        )
        if response.status_code == 404:
            _REMOTE_TOKENIZE_AVAILABLE = False
            logger.info("remote_tokenize_endpoint_unavailable", url=_REMOTE_ENGINE_URL)
            return []
        response.raise_for_status()
        _REMOTE_TOKENIZE_AVAILABLE = True
        payload = response.json()
        tokens = payload.get("tokens", [])
        if isinstance(tokens, list):
            return [str(token).strip() for token in tokens if str(token).strip()]
    except Exception as exc:
        logger.warning(
            "remote_tokenize_failed",
            error=str(exc),
            lang=worker_lang,
            text_len=len(stripped),
        )

    return []


def _tokenize_for_alignment(text: str, lang_hint: str | None = None) -> Tuple[List[str], str]:
    resolved_lang = _normalize_worker_lang(resolve_lang_code(lang_hint, text, fallback="en"))
    remote_tokens = _tokenize_with_remote_worker(text, resolved_lang)
    fallback_tokens = _fallback_tokenize(text, resolved_lang)

    if remote_tokens:
        has_ws = bool(re.search(r"\s", text.strip()))
        if resolved_lang in {"zh", "ja", "th"} and not has_ws:
            if len(remote_tokens) <= max(4, len(fallback_tokens) // 3):
                return fallback_tokens, resolved_lang
        return remote_tokens, resolved_lang

    return fallback_tokens, resolved_lang


def _map_align_index(source_idx: int, source_len: int, align_len: int) -> int:
    if align_len <= 0:
        return source_idx
    if source_len <= 1 or align_len == 1:
        return 0
    scaled = round(source_idx * (align_len - 1) / (source_len - 1))
    return max(0, min(align_len - 1, scaled))


def _generate_ngrams(tokens: List[str], max_n: int = 3) -> List[Tuple[str, List[int]]]:
    """Generate n-grams from tokens with their corresponding indices.

    Returns:
        List of (ngram_text, indices) tuples
    """
    ngrams = []

    # Add individual tokens (unigrams)
    for i, token in enumerate(tokens):
        ngrams.append((token, [i]))

    # Add bigrams and trigrams
    for n in range(2, min(max_n + 1, len(tokens) + 1)):
        for i in range(len(tokens) - n + 1):
            ngram_tokens = tokens[i:i + n]
            ngram_text = " ".join(ngram_tokens)
            indices = list(range(i, i + n))
            ngrams.append((ngram_text, indices))

    return ngrams


def _get_alignment_scores(
    source_embeddings: torch.Tensor,
    target_phrases: List[Tuple[str, List[int]]],
    model: SentenceTransformer
) -> torch.Tensor:
    """Compute alignment scores between source tokens and target phrases."""
    if not target_phrases:
        return torch.zeros((source_embeddings.size(0), 0))

    # Extract phrase texts for embedding
    phrase_texts = [phrase for phrase, _ in target_phrases]

    # Encode target phrases
    target_embeddings = model.encode(
        phrase_texts,
        convert_to_tensor=True,
        show_progress_bar=False,
        normalize_embeddings=True,
    )

    # Compute similarity matrix
    similarity_matrix = util.cos_sim(source_embeddings, target_embeddings)
    return similarity_matrix


def _find_best_alignments(
    similarity_matrix: torch.Tensor,
    target_phrases: List[Tuple[str, List[int]]],
    relative_threshold: float = 0.6,
    window_radius: int = _WINDOW_RADIUS,
    absolute_similarity_floor: float = _ABSOLUTE_SIMILARITY_FLOOR,
) -> List[List[int]]:
    """Find best alignment for each source token using relative thresholding."""
    alignments = []
    source_len = similarity_matrix.size(0)
    target_len = 0
    if target_phrases:
        target_len = max((max(indices) for _, indices in target_phrases if indices), default=-1) + 1

    for row_idx in range(similarity_matrix.size(0)):
        row = similarity_matrix[row_idx]

        if row.size(0) == 0:
            alignments.append([])
            continue

        # Get best score and find candidates within relative threshold
        best_score = torch.max(row).item()
        threshold = max(best_score * relative_threshold, absolute_similarity_floor)
        if source_len <= 1 or target_len <= 1:
            expected_target_pos = 0.0
        else:
            expected_target_pos = row_idx * (target_len - 1) / (source_len - 1)

        # Find all phrases above threshold
        candidates = []
        for col_idx in range(row.size(0)):
            score = row[col_idx].item()
            if score < threshold:
                continue

            _, indices = target_phrases[col_idx]
            if not indices:
                continue

            phrase_center = sum(indices) / len(indices)
            if target_len > 1 and abs(phrase_center - expected_target_pos) > window_radius:
                continue

            candidates.append((score, indices))

        # Fallback: if windowing filtered everything, pick globally-best phrase
        if not candidates and row.size(0) > 0:
            best_idx = int(torch.argmax(row).item())
            _, best_indices = target_phrases[best_idx]
            if best_indices:
                candidates.append((row[best_idx].item(), best_indices))

        if not candidates:
            alignments.append([])
            continue

        # Sort by score and take the best alignment
        candidates.sort(key=lambda x: x[0], reverse=True)
        best_indices = candidates[0][1]

        alignments.append(best_indices)

    return alignments


def _bidirectional_consistency_check(
    source_tokens: List[str],
    target_tokens: List[str],
    forward_alignments: List[List[int]],
    model: SentenceTransformer,
    consistency_weight: float = 0.3
) -> List[List[int]]:
    """Apply bidirectional consistency check to improve alignments."""
    if not target_tokens or not source_tokens:
        return forward_alignments

    # Generate target n-grams
    target_phrases = _generate_ngrams(target_tokens, max_n=2)

    # Encode target tokens
    target_embeddings = model.encode(
        target_tokens,
        convert_to_tensor=True,
        show_progress_bar=False,
        normalize_embeddings=True,
    )

    # Generate source n-grams for backward alignment
    source_phrases = _generate_ngrams(source_tokens, max_n=2)

    # Compute backward alignment scores
    backward_similarity = _get_alignment_scores(target_embeddings, source_phrases, model)
    backward_alignments = _find_best_alignments(backward_similarity, source_phrases)

    # Check consistency and adjust forward alignments
    refined_alignments = []

    for src_idx, target_indices in enumerate(forward_alignments):
        if not target_indices:
            refined_alignments.append(target_indices)
            continue

        # Check if any target token in the alignment points back to this source token
        consistent = False
        for tgt_idx in target_indices:
            if tgt_idx < len(backward_alignments):
                backward_sources = backward_alignments[tgt_idx]
                if src_idx in backward_sources:
                    consistent = True
                    break

        if consistent:
            # Keep the alignment as is
            refined_alignments.append(target_indices)
        else:
            # Reduce confidence by potentially keeping only the best single match
            if len(target_indices) > 1:
                # Keep only the first (best scoring) alignment
                refined_alignments.append([target_indices[0]])
            else:
                refined_alignments.append(target_indices)

    return refined_alignments


_SENTENCE_DELIMITERS = frozenset({".", "!", "?", "。", "！", "？", "؟", "।", "\n"})
_MAX_CHUNK_TOKENS = 30  # Align in chunks of at most this many content tokens


def _split_into_chunks(
    tokens: List[str], max_size: int = _MAX_CHUNK_TOKENS
) -> List[Tuple[int, int]]:
    """Split token list into sentence-based chunks.

    Returns list of (start, end) index pairs.  Sentence-ending punctuation
    tokens are included in the preceding chunk.
    """
    if not tokens:
        return []

    chunks: List[Tuple[int, int]] = []
    chunk_start = 0
    content_count = 0

    for i, tok in enumerate(tokens):
        stripped = tok.strip()
        # Check if token IS a delimiter or ENDS with one (e.g. "noshidam.")
        is_delim = (stripped in _SENTENCE_DELIMITERS or
                    (len(stripped) > 1 and stripped[-1] in _SENTENCE_DELIMITERS))
        if not is_delim:
            content_count += 1

        # Close chunk on sentence delimiter or when we hit max size
        if is_delim or content_count >= max_size:
            chunks.append((chunk_start, i + 1))
            chunk_start = i + 1
            content_count = 0

    # Remaining tokens
    if chunk_start < len(tokens):
        chunks.append((chunk_start, len(tokens)))

    return chunks


def _align_chunk(
    original_tokens: List[str],
    translation_tokens: List[str],
    model: SentenceTransformer,
) -> List[List[int]]:
    """Align a single chunk of tokens. Returns per-original-token translation indices."""
    if not original_tokens or not translation_tokens:
        return [[] for _ in original_tokens]

    original_embeddings = model.encode(
        original_tokens,
        convert_to_tensor=True,
        show_progress_bar=False,
        normalize_embeddings=True,
    )

    translation_phrases = _generate_ngrams(translation_tokens, max_n=3)

    similarity_matrix = _get_alignment_scores(
        original_embeddings, translation_phrases, model
    )

    forward_alignments = _find_best_alignments(
        similarity_matrix, translation_phrases, relative_threshold=0.6
    )

    return _bidirectional_consistency_check(
        original_tokens, translation_tokens, forward_alignments, model
    )


def _split_by_paragraphs(
    tokens: List[str], raw_text: str
) -> List[Tuple[int, int]]:
    """Split tokens into paragraph-based chunks using raw text newlines.

    Splits raw_text by blank lines (or single newlines), tokenises each
    paragraph, and maps back to token index ranges.
    """
    paragraphs = [p.strip() for p in raw_text.strip().split("\n") if p.strip()]
    if len(paragraphs) <= 1:
        return [(0, len(tokens))]

    chunks: List[Tuple[int, int]] = []
    token_idx = 0
    for para in paragraphs:
        para_tokens = para.split()
        para_len = len(para_tokens)
        if para_len == 0:
            continue
        start = token_idx
        end = min(token_idx + para_len, len(tokens))
        chunks.append((start, end))
        token_idx = end

    # Any remaining tokens go into the last chunk
    if token_idx < len(tokens) and chunks:
        last_start, _ = chunks[-1]
        chunks[-1] = (last_start, len(tokens))

    return chunks


def align_tokens(
    original_tokens: List[str],
    align_tokens: List[str],
    translation_tokens: List[str],
    k: int = 2,
    original_text: str = "",
    translation_text: str = "",
) -> List[Dict[str, object]]:
    """Improved multilingual token alignment using n-grams and bidirectional consistency.

    For large inputs the tokens are split into sentence-sized chunks and each
    chunk is aligned independently, which keeps the O(n²) similarity matrix
    small and avoids timeouts.
    """
    # Translit tokens map 1:1 with original by position.
    # If lengths differ (e.g. tokenisation artefacts), just log it —
    # we don't use align_tokens for the actual alignment computation,
    # only to set alignIndex = originalIndex in the output.
    if len(original_tokens) != len(align_tokens):
        logger.warning("token_length_mismatch",
                      original_len=len(original_tokens),
                      align_len=len(align_tokens))

    if not original_tokens:
        return []

    if not translation_tokens:
        return [
            {
                "originalIndex": idx,
                "alignIndex": idx,
                "translationIndex": [],
            }
            for idx in range(len(original_tokens))
        ]

    model = _get_model()

    # Use raw text for paragraph-based splitting when available,
    # otherwise fall back to punctuation-based sentence splitting
    if original_text.strip() and "\n" in original_text:
        orig_chunks = _split_by_paragraphs(original_tokens, original_text)
    else:
        orig_chunks = _split_into_chunks(original_tokens)

    if translation_text.strip() and "\n" in translation_text:
        trans_chunks = _split_by_paragraphs(translation_tokens, translation_text)
    else:
        trans_chunks = _split_into_chunks(translation_tokens)

    # Pair them up sentence-by-sentence.
    # If counts differ, pair what we can 1:1, then merge any remaining
    # translation sentences into the last original chunk.
    n_orig = len(orig_chunks)
    n_trans = len(trans_chunks)

    if n_orig == n_trans:
        paired = list(zip(orig_chunks, trans_chunks))
    elif n_trans > n_orig:
        # More translation sentences — merge extras into the last pair
        paired = list(zip(orig_chunks[:-1], trans_chunks[:n_orig - 1]))
        last_o = orig_chunks[-1]
        last_t_start = trans_chunks[n_orig - 1][0]
        last_t_end = trans_chunks[-1][1]
        paired.append((last_o, (last_t_start, last_t_end)))
    else:
        # More original sentences — merge extras into the last pair
        paired = list(zip(orig_chunks[:n_trans - 1], trans_chunks[:-1]))
        last_o_start = orig_chunks[n_trans - 1][0]
        last_o_end = orig_chunks[-1][1]
        last_t = trans_chunks[-1]
        paired.append(((last_o_start, last_o_end), last_t))

    logger.info("align_chunked",
                total_orig=len(original_tokens),
                total_trans=len(translation_tokens),
                orig_sentences=n_orig,
                trans_sentences=n_trans,
                n_pairs=len(paired))

    # Align each sentence pair independently
    mappings: List[Dict[str, object]] = []
    for (o_start, o_end), (t_start, t_end) in paired:
        chunk_orig = original_tokens[o_start:o_end]
        chunk_trans = translation_tokens[t_start:t_end]

        chunk_alignments = _align_chunk(chunk_orig, chunk_trans, model)

        for local_idx, translation_indices in enumerate(chunk_alignments):
            global_orig_idx = o_start + local_idx
            global_trans_indices = [t_start + ti for ti in translation_indices]
            mappings.append(
                {
                    "originalIndex": global_orig_idx,
                    "alignIndex": _map_align_index(
                        global_orig_idx,
                        len(original_tokens),
                        len(align_tokens),
                    ),
                    "translationIndex": global_trans_indices,
                }
            )

    return mappings


def align_sentence(
    original_text: str,
    align_text: str,
    translation_text: str,
) -> List[Dict[str, object]]:
    """Align a single sentence. Tokenizes internally, aligns, and returns mappings."""
    detected_source_lang = resolve_lang_code(None, original_text, fallback="en")
    source_lang = _normalize_worker_lang(detected_source_lang)

    source_has_spaces = bool(re.search(r"\s", original_text.strip()))
    source_needs_special_segmentation = source_lang in {"zh", "ja"} or not source_has_spaces
    if source_needs_special_segmentation:
        original_tokens, _ = _tokenize_for_alignment(original_text, detected_source_lang)
    else:
        original_tokens = [tok for tok in original_text.split() if tok.strip()]

    align_tokens = [tok for tok in align_text.split() if tok.strip()]
    if not align_tokens:
        align_tokens = _fallback_tokenize(align_text, "en")

    detected_target_lang = resolve_lang_code(None, translation_text, fallback="en")
    target_lang = _normalize_worker_lang(detected_target_lang)
    target_has_spaces = bool(re.search(r"\s", translation_text.strip()))
    target_needs_special_segmentation = target_lang in {"zh", "ja"} or not target_has_spaces
    if target_needs_special_segmentation:
        translation_tokens, _ = _tokenize_for_alignment(translation_text, detected_target_lang)
    else:
        translation_tokens = [tok for tok in translation_text.split() if tok.strip()]

    if not original_tokens or not translation_tokens:
        return [
            {
                "originalIndex": idx,
                "alignIndex": _map_align_index(idx, len(original_tokens), len(align_tokens)),
                "translationIndex": [],
            }
            for idx in range(len(original_tokens))
        ]

    # Prefer SimAlign (itermax) for per-sentence alignment quality.
    # Fallback to local LaBSE chunk aligner if SimAlign returns empty or errors.
    try:
        from app.services.simalign_service import align_word_pairs

        simalign_result = align_word_pairs(
            " ".join(original_tokens),
            " ".join(translation_tokens),
        )
        if simalign_result.alignments:
            by_source: Dict[int, Set[int]] = {}
            for pair in simalign_result.alignments:
                src_idx = int(pair.source_index)
                tgt_idx = int(pair.target_index)
                if 0 <= src_idx < len(original_tokens) and 0 <= tgt_idx < len(translation_tokens):
                    by_source.setdefault(src_idx, set()).add(tgt_idx)

            return [
                {
                    "originalIndex": idx,
                    "alignIndex": _map_align_index(idx, len(original_tokens), len(align_tokens)),
                    "translationIndex": sorted(by_source.get(idx, set())),
                }
                for idx in range(len(original_tokens))
            ]
    except Exception as exc:
        logger.warning("simalign_sentence_fallback", error=str(exc), lang=source_lang)

    model = _get_model()
    alignments = _align_chunk(original_tokens, translation_tokens, model)

    return [
        {
            "originalIndex": idx,
            "alignIndex": _map_align_index(idx, len(original_tokens), len(align_tokens)),
            "translationIndex": translation_indices,
        }
        for idx, translation_indices in enumerate(alignments)
    ]


def align_sentences(
    sentences: List[Dict[str, str]],
) -> List[List[Dict[str, object]]]:
    """Align multiple sentences independently. Returns per-sentence mappings."""
    results = []
    for sentence in sentences:
        mappings = align_sentence(
            sentence.get("original", ""),
            sentence.get("aligneration", ""),
            sentence.get("translation", ""),
        )
        results.append(mappings)
    return results

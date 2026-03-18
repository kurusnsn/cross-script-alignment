#!/usr/bin/env python3
"""
Debug script to force LLM refinement and show internal pipeline details.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.services.simalign_service import get_simalign_service, merge_alignments_with_confidence
from app.services.llm_refinement_service import get_refinement_service
import json

def debug_alignment_pipeline(source_text: str, target_text: str, force_threshold: float = 0.9):
    """
    Debug the alignment pipeline step by step.
    Use force_threshold=0.9 to make most alignments "low confidence" and trigger LLM.
    """

    print(f"DEBUGGING: {source_text} → {target_text}")
    print(f"Using threshold: {force_threshold} (high threshold forces LLM refinement)")
    print("=" * 80)

    # Step 1: Get raw alignments with confidence
    print("STEP 1: SimAlign + Confidence Scoring")
    simalign_service = get_simalign_service()
    confidence_data = simalign_service.align_with_confidence_scores(source_text, target_text)

    alignment_result = confidence_data["alignment_result"]
    confidence_scores = confidence_data["confidence_scores"]
    original_threshold = confidence_data["low_confidence_threshold"]

    print(f"   Original threshold: {original_threshold}")
    print(f"   Raw alignments: {len(alignment_result.alignments)}")

    for i, alignment in enumerate(alignment_result.alignments):
        conf = confidence_scores.get((alignment.source_index, alignment.target_index), 0.0)
        print(f"      {i+1}. [{alignment.source_index}→{alignment.target_index}] "
              f"\"{alignment.source_word}\" → \"{alignment.target_word}\" (conf: {conf:.3f})")

    # Step 2: Merge with confidence
    print(f"\n STEP 2: Phrase Merging")
    alignment_pairs = [(a.source_index, a.target_index) for a in alignment_result.alignments]

    merged_alignments = merge_alignments_with_confidence(
        alignment_result.source_tokens,
        alignment_result.target_tokens,
        alignment_pairs,
        confidence_scores
    )

    print(f"    Merged alignments: {len(merged_alignments)}")
    for i, alignment in enumerate(merged_alignments):
        print(f"      {i+1}. \"{alignment['source']}\" → \"{alignment['target']}\" "
              f"(conf: {alignment['confidence']:.3f})")

    # Step 3: Identify low-confidence using forced threshold
    print(f"\n STEP 3: Low-Confidence Detection (threshold: {force_threshold})")
    low_conf_spans = [
        {"source": alignment["source"], "target": alignment["target"]}
        for alignment in merged_alignments
        if alignment["confidence"] < force_threshold
    ]

    print(f"    Low-confidence spans: {len(low_conf_spans)}")
    for i, span in enumerate(low_conf_spans):
        print(f"      {i+1}. \"{span['source']}\" → \"{span['target']}\"")

    # Step 4: LLM Refinement (if needed)
    refined_alignments = []
    refinement_map = {}

    if low_conf_spans:
        print(f"\n STEP 4: LLM Refinement (GPT-4o-mini)")
        print("    Calling OpenAI for refinement...")

        refinement_service = get_refinement_service()
        refined_alignments = refinement_service.refine_alignments(
            source_text,
            target_text,
            low_conf_spans
        )

        refinement_map = {
            refined["source"]: refined["target"]
            for refined in refined_alignments
        }

        print(f"    LLM returned {len(refined_alignments)} refined alignments:")
        for i, refined in enumerate(refined_alignments):
            print(f"      {i+1}. \"{refined['source']}\" → \"{refined['target']}\"")
    else:
        print(f"\n STEP 4: No LLM Refinement Needed")
        print("    All alignments meet confidence threshold")

    # Step 5: Final result
    print(f"\n STEP 5: Final Result")
    final_alignments = []
    for alignment in merged_alignments:
        source_phrase = alignment["source"]
        original_target = alignment["target"]
        confidence = alignment["confidence"]

        refined_target = refinement_map.get(source_phrase, original_target)
        was_refined = refined_target != original_target

        final_alignments.append({
            "source": source_phrase,
            "target": refined_target,
            "confidence": confidence,
            "refined": was_refined
        })

    print(f"    Final alignments: {len(final_alignments)}")
    for i, alignment in enumerate(final_alignments):
        status = " REFINED" if alignment['refined'] else " ORIGINAL"
        print(f"      {i+1}. \"{alignment['source']}\" → \"{alignment['target']}\" "
              f"{status} (conf: {alignment['confidence']:.3f})")

    return {
        "alignments": final_alignments,
        "debug_info": {
            "raw_alignments": len(alignment_result.alignments),
            "merged_alignments": len(merged_alignments),
            "low_confidence_spans": len(low_conf_spans),
            "llm_refined": len(refined_alignments),
            "threshold_used": force_threshold
        }
    }

if __name__ == "__main__":
    print(" DEBUGGING ALIGNMENT PIPELINE WITH FORCED LLM REFINEMENT\n")

    # Test with high threshold to force LLM refinement
    print(" FORCING LLM REFINEMENT (threshold = 0.9)")
    result = debug_alignment_pipeline(
        "بستنی خریدیم",
        "We bought ice cream",
        force_threshold=0.9
    )

    print("\n" + "=" * 80)
    print(" FINAL JSON OUTPUT:")
    print("=" * 80)
    print(json.dumps(result["alignments"], indent=2, ensure_ascii=False))
    print(f"\n Debug Summary: {result['debug_info']}")
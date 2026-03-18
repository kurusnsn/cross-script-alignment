#!/usr/bin/env python3
"""
Comprehensive alignment benchmark suite.

Tests the performance, accuracy, and functionality of the enhanced alignment system
with collocation grouping, span embedding similarity, and LLM refinement triggers.
"""

import sys
import os
import time
import json
from typing import List, Dict, Tuple, Any
from dataclasses import dataclass

# Add the parent directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.simalign_service import (
    get_simalign_service,
    merge_alignments_with_confidence,
    group_collocations,
    detect_partial_collocations,
    timed
)
import structlog

logger = structlog.get_logger(__name__)


@dataclass
class BenchmarkCase:
    """A single benchmark test case."""
    name: str
    source_text: str
    target_text: str
    expected_phrases: List[Tuple[str, str]]  # (source_phrase, target_phrase) pairs
    expected_collocations: List[str]  # Expected collocation formations
    difficulty: str  # "easy", "medium", "hard"
    language_pair: str = "fa-en"


# Comprehensive test cases covering various scenarios
BENCHMARK_CASES = [
    # Easy cases - Simple collocations
    BenchmarkCase(
        name="ice_cream_basic",
        source_text="بستنی خریدم",
        target_text="I bought ice cream",
        expected_phrases=[("بستنی", "ice cream"), ("خریدم", "bought")],
        expected_collocations=["ice cream"],
        difficulty="easy"
    ),

    BenchmarkCase(
        name="how_are_you",
        source_text="حالت چطوره",
        target_text="How are you",
        expected_phrases=[("حالت چطوره", "How are you")],
        expected_collocations=["how are you"],
        difficulty="easy"
    ),

    BenchmarkCase(
        name="my_family",
        source_text="با خانواده‌ام رفتم",
        target_text="I went with my family",
        expected_phrases=[("با خانواده‌ام", "with my family"), ("رفتم", "went")],
        expected_collocations=["my family"],
        difficulty="medium"
    ),

    # Medium cases - Multiple collocations
    BenchmarkCase(
        name="multiple_collocations",
        source_text="سلام حالت چطوره دیروز بستنی خوردم",
        target_text="Hello how are you yesterday I ate ice cream",
        expected_phrases=[("حالت چطوره", "how are you"), ("بستنی", "ice cream")],
        expected_collocations=["how are you", "ice cream"],
        difficulty="medium"
    ),

    BenchmarkCase(
        name="new_york_city",
        source_text="نیویورک شهر بزرگی است",
        target_text="New York City is a big city",
        expected_phrases=[("نیویورک", "New York City")],
        expected_collocations=["New York City", "big city"],
        difficulty="medium"
    ),

    # Hard cases - Complex phrase structures
    BenchmarkCase(
        name="complex_sentence",
        source_text="دیروز با خانواده‌ام رفتیم و بستنی خوشمزه‌ای خریدیم",
        target_text="Yesterday we went with my family and bought delicious ice cream",
        expected_phrases=[("با خانواده‌ام", "with my family"), ("بستنی خوشمزه‌ای", "delicious ice cream")],
        expected_collocations=["my family", "ice cream"],
        difficulty="hard"
    ),

    BenchmarkCase(
        name="partial_collocation_trigger",
        source_text="حالت چطوره",
        target_text="are you",  # Intentionally incomplete to trigger LLM
        expected_phrases=[("حالت چطوره", "are you")],
        expected_collocations=[],  # Should detect partial match
        difficulty="hard"
    ),

    # Multi-token refinement triggers
    BenchmarkCase(
        name="multi_to_one_trigger",
        source_text="به طور کلی می‌توانم",
        target_text="I can generally",
        expected_phrases=[("به طور کلی", "generally"), ("می‌توانم", "can")],
        expected_collocations=[],
        difficulty="hard"
    ),

    BenchmarkCase(
        name="one_to_multi_trigger",
        source_text="صبحانه",
        target_text="breakfast meal in the morning",
        expected_phrases=[("صبحانه", "breakfast meal in the morning")],
        expected_collocations=[],
        difficulty="hard"
    ),

    # Language-agnostic test cases
    BenchmarkCase(
        name="arabic_test",
        source_text="أهلا وسهلا",
        target_text="Welcome",
        expected_phrases=[("أهلا وسهلا", "Welcome")],
        expected_collocations=[],
        difficulty="medium",
        language_pair="ar-en"
    ),
]


class AlignmentBenchmark:
    """Comprehensive benchmark runner for alignment system."""

    def __init__(self):
        self.results = []
        self.simalign_service = get_simalign_service()

    def run_single_benchmark(self, case: BenchmarkCase) -> Dict[str, Any]:
        """Run a single benchmark case and return detailed results."""
        print(f"\n Running benchmark: {case.name} ({case.difficulty})")
        print(f"   Source: {case.source_text}")
        print(f"   Target: {case.target_text}")

        start_time = time.time()

        try:
            # Step 1: Get confidence-scored alignments
            step1_result = timed(
                f"[{case.name}] SimAlign confidence scoring",
                self.simalign_service.align_with_confidence_scores,
                case.source_text, case.target_text
            )

            alignment_result = step1_result["alignment_result"]
            confidence_scores = step1_result["confidence_scores"]

            # Step 2: Extract alignment pairs
            alignment_pairs = [(a.source_index, a.target_index) for a in alignment_result.alignments]

            # Step 3: Test collocation grouping
            grouped_tokens, index_mapping = timed(
                f"[{case.name}] Collocation grouping",
                group_collocations,
                alignment_result.target_tokens
            )

            # Step 4: Test partial collocation detection
            partial_matches = timed(
                f"[{case.name}] Partial collocation detection",
                detect_partial_collocations,
                alignment_result.target_tokens
            )

            # Step 5: Full merge with all enhancements
            merged_alignments = timed(
                f"[{case.name}] Enhanced merge with confidence",
                merge_alignments_with_confidence,
                alignment_result.source_tokens,
                alignment_result.target_tokens,
                alignment_pairs,
                confidence_scores
            )

            total_time = time.time() - start_time

            # Analyze results
            collocations_found = [token for token in grouped_tokens if " " in token]
            llm_triggered_count = len([a for a in merged_alignments if a.get("_needs_llm_refinement", False)])

            result = {
                "case_name": case.name,
                "difficulty": case.difficulty,
                "total_time_ms": total_time * 1000,
                "source_tokens": alignment_result.source_tokens,
                "target_tokens": alignment_result.target_tokens,
                "grouped_tokens": grouped_tokens,
                "collocations_found": collocations_found,
                "partial_matches": len(partial_matches),
                "merged_alignments": merged_alignments,
                "llm_triggered_count": llm_triggered_count,
                "success": True,
                "error": None
            }

            # Check if expected collocations were found
            expected_found = 0
            for expected in case.expected_collocations:
                if any(expected.lower() in found.lower() for found in collocations_found):
                    expected_found += 1

            result["collocation_accuracy"] = (
                expected_found / len(case.expected_collocations)
                if case.expected_collocations else 1.0
            )

            # Print results
            print(f"    Completed in {total_time*1000:.1f}ms")
            print(f"    Collocations: {len(collocations_found)}/{len(case.expected_collocations)} expected")
            print(f"    Merged alignments: {len(merged_alignments)}")
            print(f"    LLM triggers: {llm_triggered_count}")

            if collocations_found:
                print(f"    Found collocations: {collocations_found}")

            for alignment in merged_alignments:
                confidence_str = f"({alignment['confidence']:.2f})"
                refinement_flag = " [LLM]" if alignment.get("_needs_llm_refinement", False) else ""
                print(f"      {alignment['source']} → {alignment['target']} {confidence_str}{refinement_flag}")

            return result

        except Exception as e:
            error_time = time.time() - start_time
            print(f"    Failed after {error_time*1000:.1f}ms: {str(e)}")

            return {
                "case_name": case.name,
                "difficulty": case.difficulty,
                "total_time_ms": error_time * 1000,
                "success": False,
                "error": str(e),
                "collocations_found": [],
                "merged_alignments": [],
                "llm_triggered_count": 0,
                "collocation_accuracy": 0.0
            }

    def run_all_benchmarks(self) -> Dict[str, Any]:
        """Run all benchmark cases and return comprehensive results."""
        print(" Starting comprehensive alignment benchmark suite...")
        print(f" Running {len(BENCHMARK_CASES)} test cases")

        overall_start = time.time()

        for case in BENCHMARK_CASES:
            result = self.run_single_benchmark(case)
            self.results.append(result)

        overall_time = time.time() - overall_start

        # Calculate summary statistics
        successful_cases = [r for r in self.results if r["success"]]
        failed_cases = [r for r in self.results if not r["success"]]

        avg_time = sum(r["total_time_ms"] for r in successful_cases) / len(successful_cases) if successful_cases else 0
        avg_collocation_accuracy = sum(r["collocation_accuracy"] for r in successful_cases) / len(successful_cases) if successful_cases else 0
        total_llm_triggers = sum(r["llm_triggered_count"] for r in self.results)

        # Difficulty breakdown
        difficulty_stats = {}
        for difficulty in ["easy", "medium", "hard"]:
            cases = [r for r in self.results if r["difficulty"] == difficulty]
            if cases:
                difficulty_stats[difficulty] = {
                    "total": len(cases),
                    "success": len([c for c in cases if c["success"]]),
                    "avg_time_ms": sum(c["total_time_ms"] for c in cases if c["success"]) / len([c for c in cases if c["success"]]) if any(c["success"] for c in cases) else 0,
                    "avg_accuracy": sum(c["collocation_accuracy"] for c in cases if c["success"]) / len([c for c in cases if c["success"]]) if any(c["success"] for c in cases) else 0
                }

        summary = {
            "total_cases": len(BENCHMARK_CASES),
            "successful_cases": len(successful_cases),
            "failed_cases": len(failed_cases),
            "success_rate": len(successful_cases) / len(BENCHMARK_CASES),
            "overall_time_ms": overall_time * 1000,
            "avg_case_time_ms": avg_time,
            "avg_collocation_accuracy": avg_collocation_accuracy,
            "total_llm_triggers": total_llm_triggers,
            "difficulty_breakdown": difficulty_stats,
            "detailed_results": self.results
        }

        return summary

    def print_summary(self, summary: Dict[str, Any]):
        """Print a comprehensive summary of benchmark results."""
        print("\n" + "="*80)
        print(" BENCHMARK SUMMARY")
        print("="*80)

        print(f" Overall Results:")
        print(f"   Cases: {summary['successful_cases']}/{summary['total_cases']} successful ({summary['success_rate']*100:.1f}%)")
        print(f"   Total time: {summary['overall_time_ms']:.0f}ms")
        print(f"   Average per case: {summary['avg_case_time_ms']:.1f}ms")
        print(f"   Collocation accuracy: {summary['avg_collocation_accuracy']*100:.1f}%")
        print(f"   LLM refinement triggers: {summary['total_llm_triggers']}")

        print(f"\n️ Difficulty Breakdown:")
        for difficulty, stats in summary["difficulty_breakdown"].items():
            print(f"   {difficulty.title()}: {stats['success']}/{stats['total']} ({stats['success']/stats['total']*100:.1f}%) - "
                  f"{stats['avg_time_ms']:.1f}ms avg - {stats['avg_accuracy']*100:.1f}% accuracy")

        if summary["failed_cases"] > 0:
            print(f"\n Failed Cases:")
            for result in summary["detailed_results"]:
                if not result["success"]:
                    print(f"   {result['case_name']}: {result['error']}")

        print(f"\n Performance Analysis:")
        fast_cases = [r for r in summary["detailed_results"] if r["success"] and r["total_time_ms"] < 1000]
        slow_cases = [r for r in summary["detailed_results"] if r["success"] and r["total_time_ms"] > 2000]

        print(f"   Fast cases (<1s): {len(fast_cases)}")
        print(f"   Slow cases (>2s): {len(slow_cases)}")

        if slow_cases:
            print(f"   Slowest cases:")
            slow_cases.sort(key=lambda x: x["total_time_ms"], reverse=True)
            for case in slow_cases[:3]:
                print(f"      {case['case_name']}: {case['total_time_ms']:.0f}ms")


def main():
    """Run the comprehensive benchmark suite."""
    benchmark = AlignmentBenchmark()

    try:
        summary = benchmark.run_all_benchmarks()
        benchmark.print_summary(summary)

        # Save detailed results to file
        output_file = "/tmp/claude/alignment_benchmark_results.json"
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(summary, f, indent=2, ensure_ascii=False)

        print(f"\n Detailed results saved to: {output_file}")

        # Return appropriate exit code
        if summary["success_rate"] >= 0.9:  # 90% success rate threshold
            print(" Benchmark PASSED - Alignment system performing well!")
            return 0
        else:
            print(" Benchmark FAILED - Some alignment issues detected.")
            return 1

    except Exception as e:
        print(f" Benchmark suite failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
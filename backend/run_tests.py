#!/usr/bin/env python3
"""
Test runner script for the aligneration backend.
"""

import sys
import subprocess
import os
from pathlib import Path


def run_tests():
    """Run pytest with appropriate configuration."""

    # Set up environment
    os.environ.setdefault("PYTHONPATH", str(Path(__file__).parent))

    # Base pytest arguments
    pytest_args = [
        sys.executable, "-m", "pytest",
        "-v",
        "--tb=short",
        "--color=yes",
        "tests/"
    ]

    # Check command line arguments
    if len(sys.argv) > 1:
        test_type = sys.argv[1].lower()

        if test_type == "unit":
            # Run only unit tests
            pytest_args.extend(["-m", "unit"])
            print(" Running unit tests only...")

        elif test_type == "integration":
            # Run only integration tests
            pytest_args.extend(["-m", "integration"])
            print(" Running integration tests only...")

        elif test_type == "llm":
            # Run LLM tests (requires API key)
            pytest_args.extend(["-m", "llm"])
            print(" Running LLM tests (requires OpenAI API key)...")

        elif test_type == "fast":
            # Run all tests except slow ones
            pytest_args.extend(["-m", "not slow"])
            print(" Running fast tests only...")

        elif test_type == "coverage":
            # Run with coverage
            pytest_args.extend([
                "--cov=app",
                "--cov-report=html",
                "--cov-report=term-missing"
            ])
            print(" Running tests with coverage...")

        elif test_type == "specific":
            # Run specific test file
            if len(sys.argv) > 2:
                test_file = sys.argv[2]
                pytest_args = [
                    "python", "-m", "pytest",
                    "-v",
                    "--tb=short",
                    "--color=yes",
                    f"tests/{test_file}"
                ]
                print(f" Running specific test: {test_file}")
            else:
                print(" Please specify test file: python run_tests.py specific test_llm_alignment_service.py")
                return 1

        else:
            print(f" Unknown test type: {test_type}")
            print("Available options: unit, integration, llm, fast, coverage, specific")
            return 1
    else:
        # Run all tests
        print(" Running all tests...")

    # Run pytest
    try:
        result = subprocess.run(pytest_args, cwd=Path(__file__).parent)
        return result.returncode
    except KeyboardInterrupt:
        print("\n Tests interrupted by user")
        return 1
    except Exception as e:
        print(f" Error running tests: {e}")
        return 1


def print_help():
    """Print help information."""
    help_text = """
 Test Runner for Transliteration Backend

Usage:
    python run_tests.py [option]

Options:
    (no args)    Run all tests
    unit         Run unit tests only
    integration  Run integration tests only
    llm          Run LLM tests (requires OpenAI API key)
    fast         Run fast tests (exclude slow tests)
    coverage     Run tests with coverage report
    specific     Run specific test file
                 Usage: python run_tests.py specific test_file.py

Examples:
    python run_tests.py                                    # All tests
    python run_tests.py unit                               # Unit tests only
    python run_tests.py specific test_llm_alignment_service.py  # Specific file
    python run_tests.py coverage                           # With coverage

Test Markers:
    @pytest.mark.unit         - Unit tests (fast, no external dependencies)
    @pytest.mark.integration  - Integration tests (may use real services)
    @pytest.mark.llm          - Tests requiring LLM API calls
    @pytest.mark.slow         - Slow running tests

Environment Variables:
    OPENAI_API_KEY           - Required for LLM tests
    PYTHONPATH               - Automatically set to backend directory
    """
    print(help_text)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ["-h", "--help", "help"]:
        print_help()
        sys.exit(0)

    exit_code = run_tests()
    sys.exit(exit_code)
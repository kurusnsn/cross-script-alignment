#!/usr/bin/env python3
"""
Comprehensive test runner for the entire aligneration project.
Runs both backend pytest tests and frontend Playwright tests.
"""

import sys
import subprocess
import os
import time
import signal
from pathlib import Path
from typing import Optional, List


class TestRunner:
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.backend_dir = self.project_root / "backend"
        self.processes: List[subprocess.Popen] = []

    def run_command(self, cmd: List[str], cwd: Optional[Path] = None, env: Optional[dict] = None) -> int:
        """Run a command and return exit code."""
        try:
            process = subprocess.Popen(
                cmd,
                cwd=cwd or self.project_root,
                env=env or os.environ.copy(),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True
            )
            self.processes.append(process)

            # Stream output
            for line in process.stdout:
                print(line.rstrip())

            process.wait()
            return process.returncode

        except KeyboardInterrupt:
            print("\n Test interrupted by user")
            self.cleanup_processes()
            return 1
        except Exception as e:
            print(f" Error running command: {e}")
            return 1

    def cleanup_processes(self):
        """Clean up any running processes."""
        for process in self.processes:
            if process.poll() is None:
                try:
                    process.terminate()
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()

    def check_dependencies(self) -> bool:
        """Check if required dependencies are installed."""
        print(" Checking dependencies...")

        # Check Python dependencies
        try:
            import pytest
            import requests
            print(" Python dependencies available")
        except ImportError as e:
            print(f" Missing Python dependency: {e}")
            print("Run: pip install -r backend/requirements.txt")
            return False

        # Check Node.js dependencies
        if not (self.project_root / "node_modules").exists():
            print(" Node.js dependencies not installed")
            print("Run: npm install")
            return False

        print(" Node.js dependencies available")
        return True

    def start_services(self) -> bool:
        """Start backend and frontend services for e2e tests."""
        print(" Starting services for e2e tests...")

        # Start backend
        backend_cmd = [
            sys.executable, "-m", "uvicorn",
            "app.main:app",
            "--host", "0.0.0.0",
            "--port", "8000",
            "--reload"
        ]

        print(" Starting backend on port 8000...")
        backend_process = subprocess.Popen(
            backend_cmd,
            cwd=self.backend_dir,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        self.processes.append(backend_process)

        # Start frontend
        frontend_cmd = ["npm", "run", "dev"]
        print(" Starting frontend on port 3000...")
        frontend_process = subprocess.Popen(
            frontend_cmd,
            cwd=self.project_root,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        self.processes.append(frontend_process)

        # Wait for services to start
        print("⏳ Waiting for services to start...")
        time.sleep(10)

        # Check if services are running
        try:
            import requests
            backend_response = requests.get("http://localhost:8000/docs", timeout=5)
            if backend_response.status_code != 200:
                print(" Backend not responding")
                return False

            frontend_response = requests.get("http://localhost:3000", timeout=5)
            if frontend_response.status_code != 200:
                print(" Frontend not responding")
                return False

            print(" Services started successfully")
            return True

        except Exception as e:
            print(f" Services failed to start: {e}")
            return False

    def run_backend_tests(self, test_type: str = "all") -> int:
        """Run backend pytest tests."""
        print(f"🧪 Running backend tests ({test_type})...")

        cmd = [sys.executable, "run_tests.py"]

        if test_type != "all":
            cmd.append(test_type)

        return self.run_command(cmd, cwd=self.backend_dir)

    def run_frontend_tests(self, test_type: str = "all") -> int:
        """Run frontend Playwright tests."""
        print(f" Running frontend tests ({test_type})...")

        if test_type == "api":
            # Run only API tests
            cmd = ["npx", "playwright", "test", "api-alignment.spec.ts"]
        elif test_type == "ui":
            # Run only UI tests
            cmd = ["npx", "playwright", "test", "llm-alignment-ui.spec.ts", "alignment.spec.ts"]
        else:
            # Run all e2e tests
            cmd = ["npx", "playwright", "test"]

        return self.run_command(cmd)

    def run_all_tests(self, include_e2e: bool = True) -> int:
        """Run the complete test suite."""
        print(" Running complete test suite...")

        failed_tests = []

        # 1. Run backend unit tests
        print("\n" + "="*60)
        print("STEP 1: Backend Unit Tests")
        print("="*60)
        if self.run_backend_tests("unit") != 0:
            failed_tests.append("Backend Unit Tests")

        # 2. Run backend integration tests (if API key available)
        if os.getenv('OPENAI_API_KEY'):
            print("\n" + "="*60)
            print("STEP 2: Backend Integration Tests")
            print("="*60)
            if self.run_backend_tests("integration") != 0:
                failed_tests.append("Backend Integration Tests")
        else:
            print("\n️  Skipping integration tests (no OPENAI_API_KEY)")

        # 3. Run E2E tests if requested
        if include_e2e:
            # Start services
            if self.start_services():
                print("\n" + "="*60)
                print("STEP 3: End-to-End Tests")
                print("="*60)

                # Run API tests
                if self.run_frontend_tests("api") != 0:
                    failed_tests.append("E2E API Tests")

                # Run UI tests
                if self.run_frontend_tests("ui") != 0:
                    failed_tests.append("E2E UI Tests")

                self.cleanup_processes()
            else:
                failed_tests.append("Service Startup")

        # Summary
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)

        if failed_tests:
            print(" Failed test suites:")
            for test in failed_tests:
                print(f"   - {test}")
            return 1
        else:
            print(" All tests passed!")
            return 0

    def generate_coverage_report(self) -> int:
        """Generate comprehensive coverage report."""
        print(" Generating coverage report...")

        # Backend coverage
        backend_cmd = [sys.executable, "run_tests.py", "coverage"]
        backend_result = self.run_command(backend_cmd, cwd=self.backend_dir)

        if backend_result == 0:
            print(" Coverage report generated in backend/htmlcov/")
            print("   Open backend/htmlcov/index.html to view")

        return backend_result

    def print_help(self):
        """Print help information."""
        help_text = """
🧪 Comprehensive Test Runner for Transliteration Project

Usage:
    python run_all_tests.py [command] [options]

Commands:
    all                 Run complete test suite (default)
    backend             Run backend tests only
    frontend            Run frontend tests only
    unit                Run unit tests only
    integration         Run integration tests only
    e2e                 Run e2e tests only
    coverage            Generate coverage report
    check               Check dependencies only

Options:
    --no-e2e           Skip end-to-end tests
    --help, -h         Show this help

Examples:
    python run_all_tests.py                    # Full test suite
    python run_all_tests.py backend            # Backend only
    python run_all_tests.py unit               # Unit tests only
    python run_all_tests.py --no-e2e           # Skip e2e tests
    python run_all_tests.py coverage           # Generate coverage

Environment Variables:
    OPENAI_API_KEY     Required for LLM integration tests
    CI                 Set to enable CI mode
        """
        print(help_text)


def main():
    runner = TestRunner()

    if len(sys.argv) > 1 and sys.argv[1] in ["-h", "--help", "help"]:
        runner.print_help()
        return 0

    # Parse arguments
    command = sys.argv[1] if len(sys.argv) > 1 else "all"
    include_e2e = "--no-e2e" not in sys.argv

    try:
        # Check dependencies first
        if not runner.check_dependencies():
            return 1

        if command == "check":
            print(" All dependencies available")
            return 0
        elif command == "backend":
            return runner.run_backend_tests()
        elif command == "frontend":
            return runner.run_frontend_tests()
        elif command == "unit":
            return runner.run_backend_tests("unit")
        elif command == "integration":
            return runner.run_backend_tests("integration")
        elif command == "e2e":
            if runner.start_services():
                result = runner.run_frontend_tests()
                runner.cleanup_processes()
                return result
            return 1
        elif command == "coverage":
            return runner.generate_coverage_report()
        elif command == "all":
            return runner.run_all_tests(include_e2e)
        else:
            print(f" Unknown command: {command}")
            runner.print_help()
            return 1

    except KeyboardInterrupt:
        print("\n Test run interrupted")
        runner.cleanup_processes()
        return 1
    except Exception as e:
        print(f" Unexpected error: {e}")
        runner.cleanup_processes()
        return 1
    finally:
        runner.cleanup_processes()


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
#!/usr/bin/env python3
"""
Full Pipeline Test for CrossScriptAlignment Backend on Hetzner

Tests the complete aligneration workflow:
1. Transliteration - Persian/Farsi text to aligneration + translation  
2. Phrase alignment - Word-to-word and phrase alignment
3. History storage - Save alignerations (requires auth)
4. Folder management - Create and manage folders (requires auth)
5. Health checks

Usage:
    python test_full_pipeline.py                    # Test against Hetzner
    python test_full_pipeline.py --local            # Test against localhost:8000
    python test_full_pipeline.py --url http://...   # Test against custom URL
"""

import argparse
import json
import requests
import sys
from datetime import datetime
from typing import Optional

# Colors for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_header(text: str):
    print(f"\n{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.CYAN}{'='*60}{Colors.END}\n")

def print_success(text: str):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")

def print_error(text: str):
    print(f"{Colors.RED}❌ {text}{Colors.END}")

def print_warning(text: str):
    print(f"{Colors.YELLOW}⚠️  {text}{Colors.END}")

def print_info(text: str):
    print(f"{Colors.BLUE}ℹ️  {text}{Colors.END}")


class TranslitPipelineTest:
    def __init__(self, base_url: str, auth_token: Optional[str] = None):
        self.base_url = base_url.rstrip('/')
        self.auth_token = auth_token
        self.headers = {'Content-Type': 'application/json'}
        if auth_token:
            self.headers['Authorization'] = f'Bearer {auth_token}'
        
        self.passed = 0
        self.failed = 0
        self.skipped = 0
    
    def _request(self, method: str, endpoint: str, data: dict = None) -> tuple:
        """Make HTTP request and return (success, response_data)"""
        url = f"{self.base_url}{endpoint}"
        try:
            if method == 'GET':
                resp = requests.get(url, headers=self.headers, timeout=30)
            elif method == 'POST':
                resp = requests.post(url, headers=self.headers, json=data, timeout=30)
            elif method == 'PATCH':
                resp = requests.patch(url, headers=self.headers, json=data, timeout=30)
            else:
                return False, f"Unsupported method: {method}"
            
            if resp.ok:
                try:
                    return True, resp.json()
                except:
                    return True, resp.text
            else:
                return False, f"HTTP {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            return False, str(e)
    
    def test_health_check(self):
        """Test backend health endpoint"""
        print_info("Testing health endpoint...")
        success, data = self._request('GET', '/healthz')
        
        if success and data.get('status') == 'ok':
            print_success(f"Health check passed: {data}")
            self.passed += 1
            return True
        else:
            print_error(f"Health check failed: {data}")
            self.failed += 1
            return False
    
    def test_alignerate_farsi(self, text: str, description: str = ""):
        """Test aligneration of Farsi text"""
        print_info(f"Testing aligneration: {description or text[:30]}...")
        
        success, data = self._request('POST', '/align', {
            'text': text,
            'source_lang': 'fa',
            'target_lang': 'en'
        })
        
        if success:
            print_success("Transliteration successful!")
            print(f"   {Colors.BOLD}Original:{Colors.END}        {data.get('original', 'N/A')}")
            print(f"   {Colors.BOLD}Transliteration:{Colors.END} {data.get('aligneration', 'N/A')}")
            print(f"   {Colors.BOLD}Translation:{Colors.END}     {data.get('translation', 'N/A')}")
            print(f"   {Colors.BOLD}IPA:{Colors.END}             {data.get('ipa', 'N/A')}")
            
            if data.get('original_tokens'):
                print(f"   {Colors.BOLD}Tokens:{Colors.END}          {len(data['original_tokens'])} source tokens")
            
            self.passed += 1
            return True, data
        else:
            print_error(f"Transliteration failed: {data}")
            self.failed += 1
            return False, None
    
    def test_phrase_alignment(self, source: str, target: str):
        """Test phrase alignment"""
        print_info(f"Testing phrase alignment: '{source[:20]}...' → '{target[:20]}...'")
        
        success, data = self._request('POST', '/align/phrase-align', {
            'source_text': source,
            'target_text': target
        })
        
        if success:
            alignments = data.get('alignments', [])
            print_success(f"Phrase alignment returned {len(alignments)} alignments")
            
            for a in alignments[:5]:  # Show first 5
                conf = a.get('confidence', 0) * 100
                refined = " [LLM]" if a.get('refined') else ""
                print(f"   {a['source']} → {a['target']} ({conf:.1f}%){refined}")
            
            if len(alignments) > 5:
                print(f"   ... and {len(alignments) - 5} more")
            
            timing = data.get('timing', {})
            print(f"   {Colors.BOLD}Timing:{Colors.END} SimAlign={timing.get('simalign', 0):.2f}s, LLM={timing.get('llm_refinement', 0):.2f}s, Total={timing.get('total', 0):.2f}s")
            
            self.passed += 1
            return True
        else:
            print_error(f"Phrase alignment failed: {data}")
            self.failed += 1
            return False
    
    def test_llm_phrase_alignment(self, source: str, target: str):
        """Test LLM-only phrase alignment"""
        print_info(f"Testing LLM phrase alignment...")
        
        success, data = self._request('POST', '/align/llm-phrase-align', {
            'source_text': source,
            'target_text': target
        })
        
        if success:
            alignments = data.get('alignments', [])
            print_success(f"LLM phrase alignment returned {len(alignments)} alignments")
            
            for a in alignments[:5]:
                print(f"   {a.get('source', '?')} → {a.get('target', '?')}")
            
            timing = data.get('timing', {})
            print(f"   {Colors.BOLD}Timing:{Colors.END} LLM={timing.get('llm_processing', 0):.2f}s, Total={timing.get('total', 0):.2f}s")
            
            self.passed += 1
            return True
        else:
            print_error(f"LLM phrase alignment failed: {data}")
            self.failed += 1
            return False
    
    def test_word_alignment(self, source: str, target: str):
        """Test word-level alignment"""
        print_info(f"Testing word alignment...")
        
        success, data = self._request('POST', '/align/word-align', {
            'source_text': source,
            'target_text': target,
            'include_confidence': True
        })
        
        if success:
            print_success(f"Word alignment completed")
            print(f"   {Colors.BOLD}Source tokens:{Colors.END} {data.get('source_tokens', [])}")
            print(f"   {Colors.BOLD}Target tokens:{Colors.END} {data.get('target_tokens', [])}")
            print(f"   {Colors.BOLD}Method:{Colors.END} {data.get('method', 'N/A')}")
            
            self.passed += 1
            return True
        else:
            print_error(f"Word alignment failed: {data}")
            self.failed += 1
            return False
    
    def test_history_operations(self):
        """Test history save/retrieve (requires auth)"""
        print_info("Testing history operations...")
        
        # Try to save to history
        success, data = self._request('POST', '/history', {
            'original': 'تست',
            'aligneration': 'test',
            'translation': 'test',
            'ipa': '/test/',
            'alignment_data': {'test': True}
        })
        
        if success:
            print_success(f"History item saved with ID: {data.get('id')}")
            self.passed += 1
            return True
        else:
            if '401' in str(data) or 'auth' in str(data).lower():
                print_warning("History operations require authentication (expected without login)")
                self.skipped += 1
            else:
                print_error(f"History save failed: {data}")
                self.failed += 1
            return False
    
    def test_folder_operations(self):
        """Test folder create/list (requires auth)"""
        print_info("Testing folder operations...")
        
        folder_name = f"Test Folder {datetime.now().strftime('%H%M%S')}"
        
        # Try to create folder
        success, data = self._request('POST', '/history/folders', {
            'name': folder_name
        })
        
        if success:
            print_success(f"Folder '{folder_name}' created with ID: {data.get('id')}")
            
            # List folders
            success2, folders = self._request('GET', '/history/folders')
            if success2:
                print_success(f"Listed {len(folders)} folders")
            
            self.passed += 1
            return True
        else:
            if '401' in str(data) or 'auth' in str(data).lower():
                print_warning("Folder operations require authentication (expected without login)")
                self.skipped += 1
            else:
                print_error(f"Folder creation failed: {data}")
                self.failed += 1
            return False
    
    def run_all_tests(self):
        """Run the complete test suite"""
        print_header("🔤 CrossScriptAlignment Full Pipeline Test")
        print(f"Target: {self.base_url}")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Test 1: Health Check
        print_header("1. Health Check")
        if not self.test_health_check():
            print_error("Backend is not healthy, aborting tests")
            return False
        
        # Test 2: Transliteration - Simple
        print_header("2. Farsi Transliteration Tests")
        
        test_sentences = [
            ("سلام، حالت چطوره؟", "Simple greeting"),
            ("امروز هوا خیلی خوب است", "Weather description"),
            ("من دیروز به بازار رفتم و میوه و سبزیجات تازه خریدم", "Longer narrative"),
            ("کتاب خواندن را دوست دارم", "Compound verb example"),
        ]
        
        for text, desc in test_sentences:
            self.test_alignerate_farsi(text, desc)
            print()
        
        # Test 3: Phrase Alignment
        print_header("3. Phrase Alignment Tests")
        
        alignment_tests = [
            ("من بستنی خریدم", "I bought ice cream"),
            ("ما با خانواده به پارک رفتیم", "We went to the park with family"),
            ("او هر روز کتاب می‌خواند", "He reads books every day"),
        ]
        
        for source, target in alignment_tests:
            self.test_phrase_alignment(source, target)
            print()
        
        # Test 4: LLM Phrase Alignment
        print_header("4. LLM Phrase Alignment")
        self.test_llm_phrase_alignment(
            "ما با خانواده به پارک رفتیم",
            "We went to the park with family"
        )
        
        # Test 5: Word Alignment
        print_header("5. Word Alignment")
        self.test_word_alignment("کتاب خواندم", "I read a book")
        
        # Test 6: History Operations (requires auth)
        print_header("6. History Operations")
        self.test_history_operations()
        
        # Test 7: Folder Operations (requires auth)
        print_header("7. Folder Operations")
        self.test_folder_operations()
        
        # Summary
        print_header("📊 Test Summary")
        total = self.passed + self.failed + self.skipped
        print(f"   {Colors.GREEN}Passed:{Colors.END}  {self.passed}")
        print(f"   {Colors.RED}Failed:{Colors.END}  {self.failed}")
        print(f"   {Colors.YELLOW}Skipped:{Colors.END} {self.skipped}")
        print(f"   {Colors.BOLD}Total:{Colors.END}   {total}")
        print()
        
        if self.failed == 0:
            print_success("All core tests passed! 🎉")
            return True
        else:
            print_error(f"{self.failed} test(s) failed")
            return False


def main():
    parser = argparse.ArgumentParser(description='Test CrossScriptAlignment backend pipeline')
    parser.add_argument('--url', type=str, default='https://api.alignai.com',
                        help='Backend URL (default: api.alignai.com)')
    parser.add_argument('--local', action='store_true',
                        help='Use localhost:8000')
    parser.add_argument('--token', type=str, default=None,
                        help='Auth token for history/folder operations')
    
    args = parser.parse_args()
    
    url = 'http://localhost:8000' if args.local else args.url
    
    tester = TranslitPipelineTest(url, args.token)
    success = tester.run_all_tests()
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()

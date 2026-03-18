import pytest
import asyncio
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
import json

# Import your FastAPI app
# from app.main import app  # Adjust import based on your app structure
from app.routers.quiz import router
from app.models.quiz import (
    QuizNextResponse, QuizAnswerRequest, QuizAnswerResponse,
    UserWord, QuizStatsResponse
)

# Create a test app with just the quiz router
from fastapi import FastAPI

test_app = FastAPI()
test_app.include_router(router)

client = TestClient(test_app)


# Mock data
MOCK_USER_WORDS = [
    UserWord(
        id=1,
        user_id="test_user",
        word="犬",
        translation="dog",
        language_code="ja",
        audio_url=None,
        added_at="2023-01-01T00:00:00"
    ),
    UserWord(
        id=2,
        user_id="test_user",
        word="猫",
        translation="cat",
        language_code="ja",
        audio_url=None,
        added_at="2023-01-01T00:00:00"
    ),
    UserWord(
        id=3,
        user_id="test_user",
        word="家",
        translation="house",
        language_code="ja",
        audio_url=None,
        added_at="2023-01-01T00:00:00"
    ),
    UserWord(
        id=4,
        user_id="test_user",
        word="水",
        translation="water",
        language_code="ja",
        audio_url=None,
        added_at="2023-01-01T00:00:00"
    ),
]


class TestQuizNext:
    """Test the GET /quiz/next endpoint"""

    @patch('app.routers.quiz.get_random_quiz_word')
    @patch('app.routers.quiz.get_distractor_words')
    def test_get_quiz_question_success(self, mock_get_distractors, mock_get_random_word):
        """Test successful quiz question generation"""
        # Setup mocks
        mock_get_random_word.return_value = asyncio.Future()
        mock_get_random_word.return_value.set_result(MOCK_USER_WORDS[0])

        mock_get_distractors.return_value = asyncio.Future()
        mock_get_distractors.return_value.set_result(MOCK_USER_WORDS[1:4])

        # Make request
        response = client.get("/quiz/next?user_id=test_user&lang=ja&type=mcq")

        # Assertions
        assert response.status_code == 200
        data = response.json()

        assert "question" in data
        assert "options" in data
        assert "answer" in data
        assert "word_id" in data
        assert "language_code" in data

        assert data["question"] == "What does '犬' mean?"
        assert data["answer"] == "dog"
        assert data["word_id"] == 1
        assert data["language_code"] == "ja"
        assert len(data["options"]) == 4
        assert "dog" in data["options"]  # Correct answer should be in options

    @patch('app.routers.quiz.get_random_quiz_word')
    def test_get_quiz_question_no_words(self, mock_get_random_word):
        """Test quiz question when no words available"""
        # Setup mock to return None (no words)
        mock_get_random_word.return_value = asyncio.Future()
        mock_get_random_word.return_value.set_result(None)

        # Also mock sync function
        with patch('app.routers.quiz.sync_starred_words_to_user_words') as mock_sync:
            mock_sync.return_value = asyncio.Future()
            mock_sync.return_value.set_result(0)  # No words synced

            response = client.get("/quiz/next?user_id=test_user&lang=ja&type=mcq")

            assert response.status_code == 404
            data = response.json()
            assert "No words found" in data["detail"]

    def test_get_quiz_question_missing_user_id(self):
        """Test quiz question with missing user_id"""
        response = client.get("/quiz/next?lang=ja&type=mcq")

        assert response.status_code == 400
        data = response.json()
        assert "user_id is required" in data["error"]

    @patch('app.routers.quiz.get_random_quiz_word')
    @patch('app.routers.quiz.get_distractor_words')
    def test_get_quiz_question_with_language_filter(self, mock_get_distractors, mock_get_random_word):
        """Test quiz question with language filter"""
        mock_get_random_word.return_value = asyncio.Future()
        mock_get_random_word.return_value.set_result(MOCK_USER_WORDS[0])

        mock_get_distractors.return_value = asyncio.Future()
        mock_get_distractors.return_value.set_result(MOCK_USER_WORDS[1:4])

        response = client.get("/quiz/next?user_id=test_user&lang=ja&type=mcq")

        assert response.status_code == 200
        # Verify that the mock was called with the language filter
        mock_get_random_word.assert_called_with("test_user", "ja")

    def test_get_quiz_question_unsupported_type(self):
        """Test quiz question with unsupported quiz type"""
        with patch('app.routers.quiz.get_random_quiz_word') as mock_get_random_word:
            mock_get_random_word.return_value = asyncio.Future()
            mock_get_random_word.return_value.set_result(MOCK_USER_WORDS[0])

            response = client.get("/quiz/next?user_id=test_user&type=fill")

            assert response.status_code == 400
            data = response.json()
            assert "not yet implemented" in data["detail"]

    @patch('app.routers.quiz.get_random_quiz_word')
    @patch('app.routers.quiz.get_distractor_words')
    def test_quiz_options_are_shuffled(self, mock_get_distractors, mock_get_random_word):
        """Test that quiz options are properly shuffled"""
        mock_get_random_word.return_value = asyncio.Future()
        mock_get_random_word.return_value.set_result(MOCK_USER_WORDS[0])

        mock_get_distractors.return_value = asyncio.Future()
        mock_get_distractors.return_value.set_result(MOCK_USER_WORDS[1:4])

        response = client.get("/quiz/next?user_id=test_user&lang=ja&type=mcq")

        assert response.status_code == 200
        data = response.json()

        # The correct answer should be somewhere in the options, but not necessarily first
        assert data["answer"] in data["options"]
        assert len(set(data["options"])) == 4  # All options should be unique


class TestQuizAnswer:
    """Test the POST /quiz/answer endpoint"""

    @patch('app.routers.quiz.record_quiz_answer_db')
    def test_submit_correct_answer(self, mock_record_answer):
        """Test submitting a correct answer"""
        mock_record_answer.return_value = asyncio.Future()
        mock_record_answer.return_value.set_result(123)  # Mock result ID

        answer_data = {
            "user_id": "test_user",
            "word_id": 1,
            "correct": True,
            "selected_option": "dog"
        }

        response = client.post("/quiz/answer", json=answer_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["result_id"] == 123
        assert "Correct!" in data["message"]

        # Verify the mock was called with correct parameters
        mock_record_answer.assert_called_once_with("test_user", 1, True)

    @patch('app.routers.quiz.record_quiz_answer_db')
    def test_submit_incorrect_answer(self, mock_record_answer):
        """Test submitting an incorrect answer"""
        mock_record_answer.return_value = asyncio.Future()
        mock_record_answer.return_value.set_result(124)

        answer_data = {
            "user_id": "test_user",
            "word_id": 1,
            "correct": False,
            "selected_option": "cat"
        }

        response = client.post("/quiz/answer", json=answer_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["result_id"] == 124
        assert "Try again" in data["message"]

    def test_submit_answer_missing_fields(self):
        """Test submitting answer with missing required fields"""
        # Missing word_id
        answer_data = {
            "user_id": "test_user",
            "correct": True
        }

        response = client.post("/quiz/answer", json=answer_data)

        assert response.status_code == 400
        data = response.json()
        assert "required" in data["error"]

    def test_submit_answer_invalid_data_types(self):
        """Test submitting answer with invalid data types"""
        answer_data = {
            "user_id": "test_user",
            "word_id": "not_a_number",
            "correct": "not_a_boolean"
        }

        response = client.post("/quiz/answer", json=answer_data)

        assert response.status_code == 422  # Pydantic validation error


class TestQuizStats:
    """Test the GET /quiz/stats endpoint"""

    def test_get_quiz_stats_success(self):
        """Test successful quiz stats retrieval"""
        response = client.get("/quiz/stats?user_id=test_user")

        assert response.status_code == 200
        data = response.json()

        assert "total_questions" in data
        assert "correct_answers" in data
        assert "accuracy" in data
        assert "recent_accuracy" in data
        assert "words_learned" in data

        # Values should be numbers
        assert isinstance(data["total_questions"], int)
        assert isinstance(data["correct_answers"], int)
        assert isinstance(data["accuracy"], (int, float))

    def test_get_quiz_stats_missing_user_id(self):
        """Test quiz stats with missing user_id"""
        response = client.get("/quiz/stats")

        assert response.status_code == 400
        data = response.json()
        assert "user_id is required" in data["error"]


class TestSyncWords:
    """Test the POST /quiz/sync-words endpoint"""

    @patch('app.routers.quiz.sync_starred_words_to_user_words')
    def test_sync_words_success(self, mock_sync):
        """Test successful word synchronization"""
        mock_sync.return_value = asyncio.Future()
        mock_sync.return_value.set_result(5)  # 5 words synced

        sync_data = {"user_id": "test_user"}

        response = client.post("/quiz/sync-words", json=sync_data)

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert data["synced_count"] == 5
        assert "Successfully synced 5 words" in data["message"]

    def test_sync_words_missing_user_id(self):
        """Test sync words with missing user_id"""
        response = client.post("/quiz/sync-words", json={})

        assert response.status_code == 400
        data = response.json()
        assert "user_id is required" in data["error"]


class TestQuizIntegration:
    """Integration tests for quiz workflow"""

    @patch('app.routers.quiz.get_random_quiz_word')
    @patch('app.routers.quiz.get_distractor_words')
    @patch('app.routers.quiz.record_quiz_answer_db')
    def test_complete_quiz_flow(self, mock_record, mock_distractors, mock_random_word):
        """Test complete quiz flow: get question -> submit answer"""
        # Setup mocks for question generation
        mock_random_word.return_value = asyncio.Future()
        mock_random_word.return_value.set_result(MOCK_USER_WORDS[0])

        mock_distractors.return_value = asyncio.Future()
        mock_distractors.return_value.set_result(MOCK_USER_WORDS[1:4])

        # 1. Get a quiz question
        response = client.get("/quiz/next?user_id=test_user&lang=ja&type=mcq")
        assert response.status_code == 200
        question_data = response.json()

        # 2. Submit an answer
        mock_record.return_value = asyncio.Future()
        mock_record.return_value.set_result(123)

        answer_data = {
            "user_id": "test_user",
            "word_id": question_data["word_id"],
            "correct": True,
            "selected_option": question_data["answer"]
        }

        response = client.post("/quiz/answer", json=answer_data)
        assert response.status_code == 200
        answer_response = response.json()

        assert answer_response["success"] is True
        assert "Correct!" in answer_response["message"]

    def test_cors_preflight_requests(self):
        """Test CORS preflight requests are handled"""
        # Test OPTIONS request for /quiz/next
        response = client.options("/quiz/next")
        assert response.status_code == 200

        # Test OPTIONS request for /quiz/answer
        response = client.options("/quiz/answer")
        assert response.status_code == 200


# Test fixtures and utilities
@pytest.fixture
def mock_database():
    """Fixture to mock database operations"""
    with patch('app.routers.quiz.get_user_words') as mock_words, \
         patch('app.routers.quiz.get_random_quiz_word') as mock_random, \
         patch('app.routers.quiz.record_quiz_answer_db') as mock_record:

        mock_words.return_value = asyncio.Future()
        mock_words.return_value.set_result(MOCK_USER_WORDS)

        mock_random.return_value = asyncio.Future()
        mock_random.return_value.set_result(MOCK_USER_WORDS[0])

        mock_record.return_value = asyncio.Future()
        mock_record.return_value.set_result(123)

        yield {
            'words': mock_words,
            'random': mock_random,
            'record': mock_record
        }


def test_quiz_data_validation():
    """Test that quiz data structures are properly validated"""
    # Test QuizNextResponse validation
    valid_quiz_data = {
        "question": "What does '犬' mean?",
        "options": ["dog", "cat", "house", "water"],
        "answer": "dog",
        "word_id": 1,
        "language_code": "ja"
    }

    quiz_response = QuizNextResponse(**valid_quiz_data)
    assert quiz_response.question == "What does '犬' mean?"
    assert len(quiz_response.options) == 4
    assert quiz_response.answer == "dog"

    # Test QuizAnswerRequest validation
    valid_answer_data = {
        "user_id": "test_user",
        "word_id": 1,
        "correct": True
    }

    answer_request = QuizAnswerRequest(**valid_answer_data)
    assert answer_request.user_id == "test_user"
    assert answer_request.word_id == 1
    assert answer_request.correct is True


if __name__ == "__main__":
    pytest.main([__file__])
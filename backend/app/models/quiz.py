from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class QuizNextRequest(BaseModel):
    user_id: str = Field(..., description="User ID for quiz generation")
    lang: Optional[str] = Field(None, description="Language code filter (e.g., 'ja', 'ar', 'ru')")
    type: str = Field(default="mcq", description="Quiz type (mcq, fill, match)")


class QuizNextResponse(BaseModel):
    question: str = Field(..., description="The quiz question")
    options: Optional[List[str]] = Field(None, description="Multiple choice options (MCQ only)")
    answer: str = Field(..., description="Correct answer")
    audio_url: Optional[str] = Field(None, description="Audio URL for pronunciation")
    word_id: int = Field(..., description="ID of the word being quizzed")
    language_code: str = Field(..., description="Language code of the question")
    # Fill mode
    blanked_text: Optional[str] = Field(None, description="Source word to alignerate (fill mode)")
    hint: Optional[str] = Field(None, description="Hint for fill mode (IPA or first letter)")
    # Match mode
    left_column: Optional[List[dict]] = Field(None, description="Left column items [{id, text}] (match mode)")
    right_column: Optional[List[dict]] = Field(None, description="Right column items [{id, text}] shuffled (match mode)")


class QuizAnswerRequest(BaseModel):
    user_id: str = Field(..., description="User ID submitting the answer")
    word_id: int = Field(..., description="ID of the word that was quizzed")
    correct: bool = Field(..., description="Whether the answer was correct")
    selected_option: Optional[str] = Field(None, description="The option selected by user")


class QuizAnswerResponse(BaseModel):
    success: bool = Field(..., description="Whether the answer was recorded successfully")
    result_id: int = Field(..., description="ID of the quiz result record")
    message: str = Field(..., description="Success or error message")


class QuizStatsResponse(BaseModel):
    total_questions: int = Field(..., description="Total questions answered")
    correct_answers: int = Field(..., description="Total correct answers")
    accuracy: float = Field(..., description="Overall accuracy percentage")
    recent_accuracy: float = Field(..., description="Recent accuracy (last 7 days)")
    words_learned: int = Field(..., description="Number of words in user's vocabulary")


class UserWord(BaseModel):
    id: int
    user_id: str
    word: str
    translation: str
    language_code: str
    audio_url: Optional[str] = None
    added_at: datetime


class QuizResult(BaseModel):
    id: int
    user_id: str
    word_id: int
    correct: bool
    answered_at: datetime


class SyncWordsRequest(BaseModel):
    user_id: str = Field(..., description="User ID to sync words for")


class SyncWordsResponse(BaseModel):
    success: bool = Field(..., description="Whether sync was successful")
    synced_count: int = Field(..., description="Number of words synced")
    message: str = Field(..., description="Success or error message")
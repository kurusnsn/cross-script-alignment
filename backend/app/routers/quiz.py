from fastapi import APIRouter, HTTPException, Response, Depends
import random
import structlog
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.quiz import (
    QuizNextRequest, QuizNextResponse, QuizAnswerRequest, QuizAnswerResponse,
    QuizStatsResponse, SyncWordsRequest, SyncWordsResponse, UserWord
)
from app.db.session import get_db
from app.db.persistence_models import VocabularyItem, QuizResult, HistoryItem, User
from app.services.tts_service import get_or_generate_tts
from app.services.auth_service import get_current_user

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/quiz", tags=["quiz"])


async def get_user_words(db: Session, user_id: int, language_code: str = None) -> List[VocabularyItem]:
    """Get user's words from database"""
    query = db.query(VocabularyItem).filter(VocabularyItem.user_id == user_id)
    if language_code:
        query = query.filter(VocabularyItem.language_code == language_code)
    return query.all()


async def get_random_quiz_word(db: Session, user_id: int, language_codes: List[str] = None) -> VocabularyItem:
    """Get random word for quiz"""
    query = db.query(VocabularyItem).filter(VocabularyItem.user_id == user_id)
    if language_codes:
        query = query.filter(VocabularyItem.language_code.in_(language_codes))
    
    count = query.count()
    if count == 0:
        return None
    
    random_index = random.randint(0, count - 1)
    return query.offset(random_index).first()


async def get_distractor_words(db: Session, user_id: int, exclude_word_id: int, language_code: str, limit: int = 3) -> List[VocabularyItem]:
    """Get distractor words for MCQ options"""
    # Get words from same language but different from the target word
    query = db.query(VocabularyItem).filter(
        VocabularyItem.user_id == user_id,
        VocabularyItem.language_code == language_code,
        VocabularyItem.id != exclude_word_id
    )
    
    count = query.count()
    if count <= limit:
        return query.all()
    
    # Simple random selection of distractors
    words = query.all()
    return random.sample(words, limit)


async def record_quiz_answer_db(db: Session, user_id: int, word_id: int, correct: bool) -> int:
    """Record quiz answer in database"""
    result = QuizResult(
        user_id=user_id,
        word_id=word_id,
        correct=correct
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result.id


async def sync_history_to_vocabulary(db: Session, user_id: int) -> int:
    """Sync items from history_items to vocabulary_items as a baseline if vocabulary is empty"""
    # This is a helper to ensure users have something to quiz if they haven't manually added words
    history_items = db.query(HistoryItem).filter(HistoryItem.user_id == user_id).all()
    
    synced_count = 0
    for item in history_items:
        # Check if already exists in vocabulary
        exists = db.query(VocabularyItem).filter(
            VocabularyItem.user_id == user_id,
            VocabularyItem.word == item.original
        ).first()
        
        if not exists:
            # Try to infer language code from history item metadata if available, otherwise default
            # For this MVP, we'll assume it's stored in result_json if present
            lang = "auto"
            if item.result_json and isinstance(item.result_json, dict):
                lang = item.result_json.get("language", "auto")
            
            vocab_item = VocabularyItem(
                user_id=user_id,
                word=item.original,
                aligneration=item.aligneration,
                translation=item.translation,
                language_code=lang
            )
            db.add(vocab_item)
            synced_count += 1
    
    if synced_count > 0:
        db.commit()
    return synced_count


async def get_random_quiz_words(db: Session, user_id: int, language_codes: List[str] = None, limit: int = 4) -> List[VocabularyItem]:
    """Get multiple random words for quiz (used by match mode)"""
    query = db.query(VocabularyItem).filter(VocabularyItem.user_id == user_id)
    if language_codes:
        query = query.filter(VocabularyItem.language_code.in_(language_codes))

    all_words = query.all()
    if not all_words:
        return []
    return random.sample(all_words, min(limit, len(all_words)))


@router.options("/next", summary="Handle CORS preflight for quiz next endpoint")
def quiz_next_options():
    return Response(status_code=200)


@router.get("/next", response_model=QuizNextResponse, summary="Get next quiz question")
async def get_next_quiz_question(
    lang: str = None,
    type: str = "mcq",
    folder: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate next quiz question for the authenticated user.

    - **lang**: Language code filter (e.g., 'ja,ar') - comma separated for multiple
    - **type**: Quiz type (mcq, fill, match)
    - **folder**: Optional folder filter (currently informational)
    """
    user_id = current_user.id
    try:
        logger.info("Generating quiz question", user_id=user_id, lang=lang, type=type)

        lang_codes = lang.split(",") if lang else None

        # Get random word from user's vocabulary
        quiz_word = await get_random_quiz_word(db, user_id, lang_codes)

        if not quiz_word:
            # Try to sync from history first as a fallback
            synced_count = await sync_history_to_vocabulary(db, user_id)
            logger.info("Synced history to vocabulary", count=synced_count, user_id=user_id)

            # Try again after sync
            quiz_word = await get_random_quiz_word(db, user_id, lang_codes)

            if not quiz_word:
                raise HTTPException(
                    status_code=404,
                    detail=f"No words found for quiz. Please save some words from your alignerations first."
                )

        # Generate MCQ options
        if type == "mcq":
            # Get distractor words (wrong answers)
            distractors = await get_distractor_words(
                db, user_id, quiz_word.id, quiz_word.language_code, 3
            )

            # If not enough distractors, generate some generic ones
            distractor_translations = [d.translation for d in distractors]
            while len(distractor_translations) < 3:
                # Add some common generic distractors
                generic_distractors = ["cat", "house", "tree", "water", "book", "food", "time", "day", "hello", "goodbye"]
                choice = random.choice(generic_distractors)
                if choice not in distractor_translations and choice != quiz_word.translation:
                    distractor_translations.append(choice)

            # Combine correct answer with distractors
            all_options = [quiz_word.translation] + distractor_translations[:3]
            random.shuffle(all_options)

            question = f"What does '{quiz_word.word}' mean?"

            # Generate or retrieve TTS audio for non-English text
            # Use try-except for TTS to avoid failing the whole request
            tts_url = None
            try:
                tts_url = await get_or_generate_tts(
                    db=db,
                    text=quiz_word.word,
                    lang=quiz_word.language_code or "auto"
                )
            except Exception as e:
                logger.warning("TTS generation failed during quiz", error=str(e))

            return QuizNextResponse(
                question=question,
                options=all_options,
                answer=quiz_word.translation,
                audio_url=tts_url,
                word_id=quiz_word.id,
                language_code=quiz_word.language_code or "auto"
            )

        elif type == "fill":
            hint = quiz_word.ipa if quiz_word.ipa else (quiz_word.aligneration[0] if quiz_word.aligneration else "")
            return QuizNextResponse(
                question=f"Type the aligneration of '{quiz_word.word}'",
                answer=quiz_word.aligneration,
                blanked_text=quiz_word.word,
                hint=hint,
                word_id=quiz_word.id,
                language_code=quiz_word.language_code or "auto"
            )

        elif type == "match":
            # Need at least 2 words; fall back to fill if vocabulary is too small
            match_words = await get_random_quiz_words(db, user_id, lang_codes, limit=4)
            if len(match_words) < 2:
                hint = quiz_word.ipa if quiz_word.ipa else (quiz_word.aligneration[0] if quiz_word.aligneration else "")
                return QuizNextResponse(
                    question=f"Type the aligneration of '{quiz_word.word}'",
                    answer=quiz_word.aligneration,
                    blanked_text=quiz_word.word,
                    hint=hint,
                    word_id=quiz_word.id,
                    language_code=quiz_word.language_code or "auto"
                )

            left_column = [{"id": i, "text": w.word} for i, w in enumerate(match_words)]
            right_items = [{"id": i, "text": w.aligneration} for i, w in enumerate(match_words)]
            random.shuffle(right_items)

            return QuizNextResponse(
                question="Match each word with its aligneration",
                answer="correct",
                left_column=left_column,
                right_column=right_items,
                word_id=match_words[0].id,
                language_code=match_words[0].language_code or "auto"
            )

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown quiz type '{type}'. Valid types: mcq, fill, match"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Error generating quiz question", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to generate quiz question")


@router.options("/answer", summary="Handle CORS preflight for quiz answer endpoint")
def quiz_answer_options():
    return Response(status_code=200)


@router.post("/answer", response_model=QuizAnswerResponse, summary="Submit quiz answer")
async def submit_quiz_answer(
    request: QuizAnswerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submit and record a quiz answer for the authenticated user.

    - **word_id**: ID of the word that was quizzed
    - **correct**: Whether the answer was correct
    - **selected_option**: The option selected by the user (optional)
    """
    user_id = current_user.id
    try:
        logger.info(
            "Recording quiz answer",
            user_id=user_id,
            word_id=request.word_id,
            correct=request.correct
        )

        # Record the answer in the database
        result_id = await record_quiz_answer_db(
            db,
            user_id,
            request.word_id,
            request.correct
        )

        message = "Answer recorded successfully"
        if request.correct:
            message += " - Correct!"
        else:
            message += " - Try again next time!"

        return QuizAnswerResponse(
            success=True,
            result_id=result_id,
            message=message
        )

    except Exception as e:
        logger.error("Error recording quiz answer", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to record quiz answer")


@router.get("/stats", response_model=QuizStatsResponse, summary="Get quiz statistics")
async def get_quiz_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get quiz statistics for the authenticated user"""
    user_id = current_user.id
    try:
        total_questions = db.query(QuizResult).filter(QuizResult.user_id == user_id).count()
        correct_answers = db.query(QuizResult).filter(QuizResult.user_id == user_id, QuizResult.correct == True).count()
        
        accuracy = (correct_answers / total_questions * 100) if total_questions > 0 else 0.0
        
        # Simple recent accuracy (last 20 questions)
        recent_questions = db.query(QuizResult).filter(QuizResult.user_id == user_id).order_by(QuizResult.answered_at.desc()).limit(20).all()
        recent_correct = sum(1 for q in recent_questions if q.correct)
        recent_accuracy = (recent_correct / len(recent_questions) * 100) if recent_questions else 0.0
        
        words_learned = db.query(VocabularyItem).filter(VocabularyItem.user_id == user_id).count()

        return QuizStatsResponse(
            total_questions=total_questions,
            correct_answers=correct_answers,
            accuracy=accuracy,
            recent_accuracy=recent_accuracy,
            words_learned=words_learned
        )
    except Exception as e:
        logger.error("Error fetching quiz stats", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to fetch quiz statistics")


@router.post("/sync-words", response_model=SyncWordsResponse, summary="Sync history items to quiz vocabulary")
async def sync_words(
    request: SyncWordsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sync authenticated user's history items to their quiz vocabulary"""
    user_id = current_user.id
    try:
        synced_count = await sync_history_to_vocabulary(db, user_id)

        return SyncWordsResponse(
            success=True,
            synced_count=synced_count,
            message=f"Successfully synced {synced_count} words to quiz vocabulary"
        )
    except Exception as e:
        logger.error("Error syncing words", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to sync words")

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import calendar
import structlog

from app.db.session import get_db
from app.db.persistence_models import HistoryItem, QuizResult, VocabularyItem, User
from app.services.auth_service import get_current_user

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/progress", tags=["progress"])

@router.get("/stats")
async def get_progress_stats(
    lang: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    try:
        # Basic stats
        words_query = db.query(VocabularyItem).filter(VocabularyItem.user_id == user_id)
        if lang:
            words_query = words_query.filter(VocabularyItem.language_code == lang)
        total_words = words_query.count()

        # Quiz counts — optionally filtered by language via join
        quiz_base = db.query(QuizResult).filter(QuizResult.user_id == user_id)
        if lang:
            quiz_base = quiz_base.join(VocabularyItem, QuizResult.word_id == VocabularyItem.id).filter(
                VocabularyItem.language_code == lang
            )
        total_questions = quiz_base.count()
        correct_answers = quiz_base.filter(QuizResult.correct == True).count()
        average_accuracy = (correct_answers / total_questions * 100) if total_questions > 0 else 0.0

        # Total languages is always global (shows all languages user has worked with)
        languages = db.query(VocabularyItem.language_code).filter(VocabularyItem.user_id == user_id).distinct().all()
        total_languages = len(languages)

        # Weekly Activity - single aggregated query instead of N+1
        today = datetime.now().date()
        week_start = today - timedelta(days=6)

        # Aggregated query for history items
        history_counts = db.query(
            func.date(HistoryItem.created_at).label('day'),
            func.count(HistoryItem.id).label('count')
        ).filter(
            HistoryItem.user_id == user_id,
            func.date(HistoryItem.created_at) >= week_start
        ).group_by(func.date(HistoryItem.created_at)).all()

        # Aggregated query for quiz results (lang-filtered)
        quiz_week_query = db.query(
            func.date(QuizResult.answered_at).label('day'),
            func.count(QuizResult.id).label('count')
        ).filter(
            QuizResult.user_id == user_id,
            func.date(QuizResult.answered_at) >= week_start
        )
        if lang:
            quiz_week_query = quiz_week_query.join(
                VocabularyItem, QuizResult.word_id == VocabularyItem.id
            ).filter(VocabularyItem.language_code == lang)
        quiz_counts = quiz_week_query.group_by(func.date(QuizResult.answered_at)).all()

        # Convert to lookup dicts
        history_by_day = {row.day: row.count for row in history_counts}
        quiz_by_day = {row.day: row.count for row in quiz_counts}

        weekly_activity = []
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            day_name = day.strftime("%a")
            weekly_activity.append({
                "day": day_name,
                "alignerations": history_by_day.get(day, 0),
                "quizzes": quiz_by_day.get(day, 0),
                "voiceChat": 0
            })

        # Monthly Trend — real data for last 6 months
        monthly_trend = []
        for i in range(5, -1, -1):
            m_year = today.year
            m_month = today.month - i
            while m_month <= 0:
                m_month += 12
                m_year -= 1
            month_q = db.query(QuizResult).filter(
                QuizResult.user_id == user_id,
                extract('year', QuizResult.answered_at) == m_year,
                extract('month', QuizResult.answered_at) == m_month,
            )
            if lang:
                month_q = month_q.join(
                    VocabularyItem, QuizResult.word_id == VocabularyItem.id
                ).filter(VocabularyItem.language_code == lang)
            m_total = month_q.count()
            m_correct = month_q.filter(QuizResult.correct == True).count()
            acc = round((m_correct / m_total * 100), 1) if m_total > 0 else 0.0
            monthly_trend.append({"month": calendar.month_abbr[m_month], "accuracy": acc})
        
        # Language Distribution
        lang_stats = db.query(
            VocabularyItem.language_code, 
            func.count(VocabularyItem.id)
        ).filter(VocabularyItem.user_id == user_id).group_by(VocabularyItem.language_code).all()
        
        colors = ["#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ef4444"]
        language_distribution = []
        total_vocab = sum(count for lang, count in lang_stats) if lang_stats else 0
        
        for i, (lang, count) in enumerate(lang_stats):
            language_distribution.append({
                "name": (lang or "auto").upper(),
                "value": round((count / total_vocab * 100), 1) if total_vocab > 0 else 0,
                "color": colors[i % len(colors)]
            })
            
        # Streak calculation - bounded to max 365 days for performance
        # Use combined query to find all activity dates at once
        max_streak_days = 365
        streak_start = today - timedelta(days=max_streak_days)
        
        history_dates = set(row[0] for row in db.query(
            func.date(HistoryItem.created_at)
        ).filter(
            HistoryItem.user_id == user_id,
            func.date(HistoryItem.created_at) >= streak_start
        ).distinct().all())
        
        quiz_dates = set(row[0] for row in db.query(
            func.date(QuizResult.answered_at)
        ).filter(
            QuizResult.user_id == user_id,
            func.date(QuizResult.answered_at) >= streak_start
        ).distinct().all())
        
        all_activity_dates = history_dates | quiz_dates
        
        current_streak = 0
        check_day = today
        while check_day >= streak_start:
            if check_day in all_activity_dates:
                current_streak += 1
                check_day -= timedelta(days=1)
            else:
                break

        return {
            "totalWords": total_words,
            "averageAccuracy": round(average_accuracy, 1),
            "currentStreak": current_streak,
            "totalLanguages": total_languages,
            "totalQuestions": total_questions,
            "correctAnswers": correct_answers,
            "weeklyActivity": weekly_activity,
            "monthlyTrend": monthly_trend,
            "languageDistribution": language_distribution
        }
    except Exception as e:
        logger.error("Error fetching progress stats", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/achievements")
async def get_achievements(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    try:
        total_words = db.query(VocabularyItem).filter(VocabularyItem.user_id == user_id).count()
        total_quizzes = db.query(QuizResult).filter(QuizResult.user_id == user_id).count()
        total_languages = db.query(VocabularyItem.language_code).filter(
            VocabularyItem.user_id == user_id
        ).distinct().count()

        achievements = [
            {
                "title": "First Steps",
                "description": "Save your first 5 words to your vocabulary",
                "earned": total_words >= 5,
                "date": "2024-03-20" if total_words >= 5 else None,
                "icon": "🌱",
                "progress": min(total_words, 5),
                "total": 5
            },
            {
                "title": "Polyglot Apprentice",
                "description": "Transliterate in 3 different languages",
                "earned": total_languages >= 3,
                "icon": "🌍",
                "progress": min(total_languages, 3),
                "total": 3
            },
            {
                "title": "Quiz Master",
                "description": "Complete 50 quiz questions",
                "earned": total_quizzes >= 50,
                "icon": "🎓",
                "progress": min(total_quizzes, 50),
                "total": 50
            }
        ]
        return {"achievements": achievements}
    except Exception as e:
        logger.error("Error fetching achievements", error=str(e))
        raise HTTPException(status_code=500, detail="Internal server error")

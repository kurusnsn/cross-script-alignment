import { NextRequest, NextResponse } from 'next/server';
import { getRandomQuizWord, getDistractorWords, syncStarredWordsToUserWords, getUserWordCount } from '@/lib/quizHandlers';
import { getAuthenticatedUser, unauthorizedResponse } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Validate authentication
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const userId = String(user.id); // Use authenticated user ID
    const lang = searchParams.get('lang');
    const folder = searchParams.get('folder') || undefined;
    const type = searchParams.get('type') || 'mcq';
    const mode = searchParams.get('mode') || 'original_to_translation';

    // Check word count first to implement edge cases
    let wordCount = await getUserWordCount(userId, lang || undefined, folder);

    if (wordCount === 0) {
      if (folder) {
        return NextResponse.json(
          { error: 'No words found in this folder. Choose another folder or add words.' },
          { status: 404 }
        );
      }
      // Try to sync starred words first
      let syncedCount = 0;
      try {
        syncedCount = await syncStarredWordsToUserWords(userId);
      } catch (syncError) {
        console.warn('Starred-word sync skipped:', syncError);
        syncedCount = 0;
      }

      // Recount after sync
      wordCount = await getUserWordCount(userId, lang || undefined, folder);

      if (wordCount === 0) {
        return NextResponse.json(
          { error: 'No words found for quiz. Please star some words first.' },
          { status: 404 }
        );
      }
    }

    // Edge case: Only 1 word available
    if (wordCount === 1) {
      return NextResponse.json(
        { error: folder
          ? 'You need at least 2 saved words in this folder to quiz. Add more words or choose another folder.'
          : 'You need at least 2 saved words to quiz. Add more to unlock quizzes!'
        },
        { status: 400 }
      );
    }

    // Get random word from user's vocabulary
    const quizWord = await getRandomQuizWord(userId, lang || undefined, folder);

    if (!quizWord) {
      return NextResponse.json(
        { error: 'Failed to generate quiz question' },
        { status: 500 }
      );
    }

    // Generate MCQ options
    if (type === 'mcq') {
      // Determine number of options based on word count
      let targetDistractors: number;
      if (wordCount === 2) {
        targetDistractors = 1; // 2-option quiz (true/false style)
      } else if (wordCount === 3) {
        targetDistractors = 2; // 3-option quiz
      } else {
        targetDistractors = 3; // Normal 4-option quiz
      }

      // Get distractor words (wrong answers)
      const distractors = await getDistractorWords(
        userId,
        quizWord.id,
        quizWord.language_code,
        folder,
        targetDistractors
      );

      // If not enough distractors from user's words, use generic ones
      const distractorTranslations = distractors.map(d => d.translation);
      const genericDistractors = ["cat", "house", "tree", "water", "book", "food", "time", "day", "person", "place"];

      while (distractorTranslations.length < targetDistractors) {
        for (const generic of genericDistractors) {
          if (!distractorTranslations.includes(generic) && generic !== quizWord.translation) {
            distractorTranslations.push(generic);
            if (distractorTranslations.length >= targetDistractors) break;
          }
        }
        break; // Prevent infinite loop
      }

      // Combine correct answer with distractors
      const allOptions = [quizWord.translation, ...distractorTranslations.slice(0, targetDistractors)];

      // Shuffle the options
      for (let i = allOptions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allOptions[i], allOptions[j]] = [allOptions[j], allOptions[i]];
      }

      // Generate question and answer based on mode
      let question: string;
      let answer: string;
      let questionOptions: string[];

      switch (mode) {
        case 'original_to_translation':
          question = `What does '${quizWord.original}' mean?`;
          answer = quizWord.translation;
          questionOptions = allOptions;
          break;

        case 'aligneration_to_translation':
          if (!quizWord.aligneration) {
            // Fallback to original if no aligneration
            question = `What does '${quizWord.original}' mean?`;
          } else {
            question = `What does '${quizWord.aligneration}' mean?`;
          }
          answer = quizWord.translation;
          questionOptions = allOptions;
          break;

        case 'translation_to_original':
          question = `How do you write '${quizWord.translation}' in ${quizWord.language_code}?`;
          answer = quizWord.original;
          // For this mode, we need original words as options
          const originalDistractors = distractors.map(d => d.original);
          const allOriginalOptions = [quizWord.original, ...originalDistractors.slice(0, targetDistractors)];

          // Shuffle the original options
          for (let i = allOriginalOptions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allOriginalOptions[i], allOriginalOptions[j]] = [allOriginalOptions[j], allOriginalOptions[i]];
          }
          questionOptions = allOriginalOptions;
          break;

        case 'listening_to_translation':
          question = `What does this audio mean?`;
          answer = quizWord.translation;
          questionOptions = allOptions;
          break;

        default:
          question = `What does '${quizWord.original}' mean?`;
          answer = quizWord.translation;
          questionOptions = allOptions;
      }

      return NextResponse.json({
        question,
        options: questionOptions,
        answer,
        audio_url: quizWord.audio_url,
        word_id: quizWord.id,
        language_code: quizWord.language_code,
        word_count: wordCount,
        mode: mode // Include mode for frontend
      });

    } else if (type === 'fill') {
      // Fill-in-the-blank quiz
      const aligneration = quizWord.aligneration || quizWord.original;

      // Create blanked version of aligneration
      // Strategy: blank out ~30-50% of the text, focusing on complete words
      const words = aligneration.split(/\s+/);
      const numWords = words.length;
      const numBlanks = Math.max(1, Math.ceil(numWords * 0.4)); // Blank 40% of words

      // Randomly select which words to blank
      const blankIndices = new Set<number>();
      while (blankIndices.size < Math.min(numBlanks, numWords)) {
        blankIndices.add(Math.floor(Math.random() * numWords));
      }

      // Create blanked text
      const blankedWords = words.map((word, index) => {
        if (blankIndices.has(index)) {
          return '_'.repeat(word.length);
        }
        return word;
      });

      const blankedText = blankedWords.join(' ');
      const blankedWordsList = Array.from(blankIndices).map(i => words[i]);

      return NextResponse.json({
        question: `Fill in the blanks for: ${quizWord.original}`,
        blanked_text: blankedText,
        answer: aligneration,
        blanked_words: blankedWordsList,
        hint: `Translation: ${quizWord.translation}`,
        audio_url: quizWord.audio_url,
        word_id: quizWord.id,
        language_code: quizWord.language_code,
        type: 'fill'
      });

    } else if (type === 'match') {
      // Matching quiz - get multiple words
      const numPairs = Math.min(6, wordCount); // Up to 6 pairs

      // Get random words including the current one
      const distractors = await getDistractorWords(
        userId,
        quizWord.id,
        quizWord.language_code,
        folder,
        numPairs - 1
      );

      const allWords = [quizWord, ...distractors];

      // Create pairs of original and aligneration/translation
      const leftColumn = allWords.map(w => ({
        id: w.id,
        text: w.original
      }));

      const rightColumn = allWords.map(w => ({
        id: w.id,
        text: w.aligneration || w.translation
      }));

      // Shuffle right column
      for (let i = rightColumn.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rightColumn[i], rightColumn[j]] = [rightColumn[j], rightColumn[i]];
      }

      return NextResponse.json({
        question: 'Match the words with their alignerations',
        left_column: leftColumn,
        right_column: rightColumn,
        answer: 'correct',
        word_id: quizWord.id,
        language_code: quizWord.language_code,
        type: 'match'
      });

    } else {
      return NextResponse.json(
        { error: `Quiz type '${type}' not yet implemented` },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error generating quiz question:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz question' },
      { status: 500 }
    );
  }
}

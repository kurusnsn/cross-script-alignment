-- Migration: Enable PostgreSQL RLS and owner-scoped policies for user data tables
-- Created: 2026-03-01
--
-- Notes:
-- - This migration is PostgreSQL-native (no Supabase auth.uid()/authenticated role).
-- - RLS decisions use a transaction-local setting: app.current_user_id.
-- - Backend must set this setting per request/session before querying protected tables.
-- - `users` is intentionally excluded to avoid breaking login/register lookup flows.

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '');
$$;

DO $$
DECLARE
  tbl text;
BEGIN
  -- Standard owner policies for tables with a user_id column
  FOR tbl IN
    SELECT unnest(ARRAY[
      'translations',
      'user_words',
      'quiz_results',
      'folders',
      'history_items',
      'vocabulary_items'
    ])
  LOOP
    IF to_regclass(format('public.%s', tbl)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = tbl || '_select_own'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (' ||
        'app.current_user_id() IS NOT NULL AND %I.user_id::text = app.current_user_id()' ||
        ')',
        tbl || '_select_own',
        tbl,
        tbl
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = tbl || '_insert_own'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (' ||
        'app.current_user_id() IS NOT NULL AND %I.user_id::text = app.current_user_id()' ||
        ')',
        tbl || '_insert_own',
        tbl,
        tbl
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = tbl || '_update_own'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE ' ||
        'USING (app.current_user_id() IS NOT NULL AND %I.user_id::text = app.current_user_id()) ' ||
        'WITH CHECK (app.current_user_id() IS NOT NULL AND %I.user_id::text = app.current_user_id())',
        tbl || '_update_own',
        tbl,
        tbl,
        tbl
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = tbl || '_delete_own'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE USING (' ||
        'app.current_user_id() IS NOT NULL AND %I.user_id::text = app.current_user_id()' ||
        ')',
        tbl || '_delete_own',
        tbl,
        tbl
      );
    END IF;
  END LOOP;

  -- translation_words ownership is derived from parent translation
  IF to_regclass('public.translation_words') IS NOT NULL
     AND to_regclass('public.translations') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.translation_words ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE public.translation_words FORCE ROW LEVEL SECURITY';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'translation_words'
        AND policyname = 'translation_words_select_own'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY translation_words_select_own
        ON public.translation_words
        FOR SELECT
        USING (
          app.current_user_id() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.translations t
            WHERE t.id = translation_words.translation_id
              AND t.user_id::text = app.current_user_id()
          )
        )
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'translation_words'
        AND policyname = 'translation_words_insert_own'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY translation_words_insert_own
        ON public.translation_words
        FOR INSERT
        WITH CHECK (
          app.current_user_id() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.translations t
            WHERE t.id = translation_words.translation_id
              AND t.user_id::text = app.current_user_id()
          )
        )
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'translation_words'
        AND policyname = 'translation_words_update_own'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY translation_words_update_own
        ON public.translation_words
        FOR UPDATE
        USING (
          app.current_user_id() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.translations t
            WHERE t.id = translation_words.translation_id
              AND t.user_id::text = app.current_user_id()
          )
        )
        WITH CHECK (
          app.current_user_id() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.translations t
            WHERE t.id = translation_words.translation_id
              AND t.user_id::text = app.current_user_id()
          )
        )
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'translation_words'
        AND policyname = 'translation_words_delete_own'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY translation_words_delete_own
        ON public.translation_words
        FOR DELETE
        USING (
          app.current_user_id() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.translations t
            WHERE t.id = translation_words.translation_id
              AND t.user_id::text = app.current_user_id()
          )
        )
      $policy$;
    END IF;
  END IF;
END $$;

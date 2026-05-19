
CREATE OR REPLACE FUNCTION public.refresh_match_sheet_score(p_sheet_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sheet RECORD;
  v_match RECORD;
  v_cache_home int;
  v_cache_away int;
BEGIN
  SELECT id, home_team, away_team, date, home_score, away_score
  INTO v_sheet
  FROM match_sheets
  WHERE id = p_sheet_id;

  IF v_sheet IS NULL THEN
    RAISE EXCEPTION 'Feuille de match introuvable';
  END IF;

  IF v_sheet.home_score IS NOT NULL AND v_sheet.away_score IS NOT NULL THEN
    RETURN jsonb_build_object('already_set', true, 'home_score', v_sheet.home_score, 'away_score', v_sheet.away_score);
  END IF;

  IF v_sheet.home_team IS NULL OR v_sheet.away_team IS NULL THEN
    RAISE EXCEPTION 'Équipes non définies';
  END IF;

  -- 1) Try championship_matches table first
  SELECT home_score, away_score
  INTO v_match
  FROM championship_matches
  WHERE played = true
    AND home_score IS NOT NULL
    AND away_score IS NOT NULL
    AND date = v_sheet.date
    AND (
      (UPPER(home_team) = UPPER(v_sheet.home_team) AND UPPER(away_team) = UPPER(v_sheet.away_team))
      OR (home_team ILIKE '%' || v_sheet.home_team || '%' AND away_team ILIKE '%' || v_sheet.away_team || '%')
    )
  LIMIT 1;

  IF v_match IS NOT NULL THEN
    UPDATE match_sheets
    SET home_score = v_match.home_score, away_score = v_match.away_score
    WHERE id = p_sheet_id;
    RETURN jsonb_build_object('found', true, 'home_score', v_match.home_score, 'away_score', v_match.away_score);
  END IF;

  -- 2) Fallback: search championships.fff_live_cache->results->matchs
  SELECT (m->>'home_score')::int, (m->>'away_score')::int
  INTO v_cache_home, v_cache_away
  FROM championships c,
       LATERAL jsonb_array_elements(COALESCE(c.fff_live_cache->'results','[]'::jsonb)) AS r,
       LATERAL jsonb_array_elements(COALESCE(r->'matchs','[]'::jsonb)) AS m
  WHERE m->>'home_score' IS NOT NULL
    AND m->>'away_score' IS NOT NULL
    AND LEFT(COALESCE(m->>'date',''), 10) = v_sheet.date
    AND (
      UPPER(COALESCE(m->'home'->>'short_name', m->'home'->>'name','')) = UPPER(v_sheet.home_team)
      OR UPPER(COALESCE(m->'home'->>'short_name', m->'home'->>'name','')) ILIKE '%' || UPPER(v_sheet.home_team) || '%'
      OR UPPER(v_sheet.home_team) ILIKE '%' || UPPER(COALESCE(m->'home'->>'short_name', m->'home'->>'name','')) || '%'
    )
    AND (
      UPPER(COALESCE(m->'away'->>'short_name', m->'away'->>'name','')) = UPPER(v_sheet.away_team)
      OR UPPER(COALESCE(m->'away'->>'short_name', m->'away'->>'name','')) ILIKE '%' || UPPER(v_sheet.away_team) || '%'
      OR UPPER(v_sheet.away_team) ILIKE '%' || UPPER(COALESCE(m->'away'->>'short_name', m->'away'->>'name','')) || '%'
    )
  LIMIT 1;

  IF v_cache_home IS NOT NULL AND v_cache_away IS NOT NULL THEN
    UPDATE match_sheets
    SET home_score = v_cache_home, away_score = v_cache_away
    WHERE id = p_sheet_id;
    RETURN jsonb_build_object('found', true, 'home_score', v_cache_home, 'away_score', v_cache_away);
  END IF;

  RETURN jsonb_build_object('found', false);
END;
$function$;

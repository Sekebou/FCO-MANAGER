CREATE OR REPLACE FUNCTION public.refresh_match_sheet_score(p_sheet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sheet RECORD;
  v_match RECORD;
BEGIN
  -- Get the match sheet
  SELECT id, home_team, away_team, date, home_score, away_score
  INTO v_sheet
  FROM match_sheets
  WHERE id = p_sheet_id;

  IF v_sheet IS NULL THEN
    RAISE EXCEPTION 'Feuille de match introuvable';
  END IF;

  -- Already has a score → no-op
  IF v_sheet.home_score IS NOT NULL AND v_sheet.away_score IS NOT NULL THEN
    RETURN jsonb_build_object('already_set', true, 'home_score', v_sheet.home_score, 'away_score', v_sheet.away_score);
  END IF;

  IF v_sheet.home_team IS NULL OR v_sheet.away_team IS NULL THEN
    RAISE EXCEPTION 'Équipes non définies';
  END IF;

  -- Find matching championship match
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

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  UPDATE match_sheets
  SET home_score = v_match.home_score, away_score = v_match.away_score
  WHERE id = p_sheet_id;

  RETURN jsonb_build_object('found', true, 'home_score', v_match.home_score, 'away_score', v_match.away_score);
END;
$$;
UPDATE match_sheets
SET convocations = (convocations - '2cd712e3-baf3-44e8-8271-eca7ff1811ff') || '{"c9d619e3-69d2-4082-84cc-1c5bbd988478": {"number": 13, "status": "convoque"}}'::jsonb
WHERE id = '063532c8-39c6-43e1-8814-cab907aaa362';
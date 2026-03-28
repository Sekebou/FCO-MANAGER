UPDATE events
SET convocations = (convocations - '2cd712e3-baf3-44e8-8271-eca7ff1811ff') || '{"c9d619e3-69d2-4082-84cc-1c5bbd988478": {"number": 13, "status": "convoque"}}'::jsonb
WHERE id = '1516891b-488f-475c-9bfe-a4859a512bcf';
WITH template_max AS (
  SELECT sf.template_id, COALESCE(SUM(sf.max_points), 0)::numeric AS max_pts
  FROM public.scoring_fields sf
  GROUP BY sf.template_id
),
raw_per_score AS (
  SELECT sd.score_id, COALESCE(SUM(sd.points), 0)::numeric AS raw_pts
  FROM public.score_details sd
  GROUP BY sd.score_id
),
new_totals AS (
  SELECT
    s.id,
    GREATEST(
      0,
      ROUND(((COALESCE(r.raw_pts, 0) / tm.max_pts) * 100 - COALESCE(s.deductions, 0))::numeric, 2)
    ) AS new_total
  FROM public.scores s
  JOIN template_max tm ON tm.template_id = s.template_id
  LEFT JOIN raw_per_score r ON r.score_id = s.id
  WHERE tm.max_pts > 0
)
UPDATE public.scores s
SET total_score = nt.new_total
FROM new_totals nt
WHERE nt.id = s.id;
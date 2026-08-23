ALTER TABLE "contract"
  ADD COLUMN "response_deadline" TIMESTAMP(3),
  ADD COLUMN "place_of_performance" JSONB;

UPDATE "contract"
SET "response_deadline" = ("sam_data" ->> 'responseDeadLine')::timestamptz
WHERE "sam_data" ->> 'responseDeadLine' ~ '^\d{4}-\d{2}-\d{2}';

UPDATE "contract"
SET "response_deadline" = ("sam_data" ->> 'responseDeadline')::timestamptz
WHERE "response_deadline" IS NULL
  AND "sam_data" ->> 'responseDeadline' ~ '^\d{4}-\d{2}-\d{2}';

UPDATE "contract"
SET "place_of_performance" = "sam_data" -> 'placeOfPerformance'
WHERE jsonb_typeof("sam_data" -> 'placeOfPerformance') = 'object'
  AND "sam_data" -> 'placeOfPerformance' <> '{}'::jsonb;

CREATE INDEX "contract_response_deadline_idx" ON "contract"("response_deadline");

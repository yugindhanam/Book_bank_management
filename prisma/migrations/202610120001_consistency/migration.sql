ALTER TABLE "Settlement" DROP CONSTRAINT "positive_settlement";
ALTER TABLE "Settlement" ADD CONSTRAINT "positive_settlement" CHECK (
  "amount" > 0 AND (NOT "waived" OR ("reason" IS NOT NULL AND length(trim("reason")) > 0))
);

-- Deferred checks let issue/return update both sides in either order, but reject
-- any commit leaving a copy's status inconsistent with its active loan.
CREATE FUNCTION check_copy_circulation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  target_id text;
  current_status "CopyStatus";
  active_count integer;
BEGIN
  IF TG_TABLE_NAME = 'BookCopy' THEN
    target_id := COALESCE(NEW.id, OLD.id);
  ELSE
    target_id := COALESCE(NEW."copyId", OLD."copyId");
  END IF;
  SELECT status INTO current_status FROM "BookCopy" WHERE id = target_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO active_count FROM "Loan" WHERE "copyId" = target_id AND "returnedAt" IS NULL;
  IF (current_status = 'ISSUED') <> (active_count = 1) THEN
    RAISE EXCEPTION 'Copy status must match its active loan' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER copy_circulation_consistency
  AFTER INSERT OR UPDATE ON "BookCopy" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_copy_circulation();
CREATE CONSTRAINT TRIGGER loan_circulation_consistency
  AFTER INSERT OR UPDATE OR DELETE ON "Loan" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_copy_circulation();

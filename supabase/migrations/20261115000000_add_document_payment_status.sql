-- Keep each document's Paid / Unpaid status in the cloud database.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'Unpaid';

-- Existing receipts represent payments already received.
UPDATE public.documents
SET payment_status = 'Paid'
WHERE document_type = 'receipt'
  AND payment_status = 'Unpaid';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'documents_payment_status_check'
      AND conrelid = 'public.documents'::regclass
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_payment_status_check
      CHECK (payment_status IN ('Paid', 'Unpaid'));
  END IF;
END $$;

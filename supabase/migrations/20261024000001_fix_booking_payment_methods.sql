-- Migration: 20261024000001_fix_booking_payment_methods.sql
-- Description: Safely normalize payment_method values and enforce canonical CHECK constraint
-- Supported canonical values: ('UPI', 'Cash', 'Card', 'Net Banking', 'Wallet', 'Other')

DO $$
DECLARE
  v_invalid_count INTEGER;
  v_invalid_samples TEXT;
BEGIN
  RAISE NOTICE 'Starting migration 20261024000001_fix_booking_payment_methods...';

  -- Step 1: Safely normalize verified legacy / variant payment_method values
  -- Only exact, verified transformations are applied.

  -- UPI variants
  UPDATE public.bookings
  SET payment_method = 'UPI'
  WHERE payment_method IS NOT NULL
    AND LOWER(TRIM(payment_method)) IN ('upi', 'phonepe', 'gpay', 'google pay', 'paytm upi', 'bhim', 'direct', 'direct booking', 'instant', 'online');

  -- Cash / Counter variants
  UPDATE public.bookings
  SET payment_method = 'Cash'
  WHERE payment_method IS NOT NULL
    AND LOWER(TRIM(payment_method)) IN ('cash', 'counter', 'pay at counter', 'pay at entry gate', 'pay at entry gate / counter');

  -- Card variants
  UPDATE public.bookings
  SET payment_method = 'Card'
  WHERE payment_method IS NOT NULL
    AND LOWER(TRIM(payment_method)) IN ('card', 'pos', 'debit card', 'credit card', 'credit', 'debit');

  -- Net Banking variants
  UPDATE public.bookings
  SET payment_method = 'Net Banking'
  WHERE payment_method IS NOT NULL
    AND LOWER(TRIM(payment_method)) IN ('net banking', 'netbanking', 'net_banking', 'internet banking', 'nb');

  -- Wallet variants
  UPDATE public.bookings
  SET payment_method = 'Wallet'
  WHERE payment_method IS NOT NULL
    AND LOWER(TRIM(payment_method)) IN ('wallet', 'paytm wallet', 'paytm', 'ppi');

  -- Other variants
  UPDATE public.bookings
  SET payment_method = 'Other'
  WHERE payment_method IS NOT NULL
    AND LOWER(TRIM(payment_method)) IN ('other', 'cheque', 'offline');

  -- Step 2: Validate all records satisfy canonical values
  SELECT COUNT(*), COALESCE(string_agg(DISTINCT payment_method, ', '), 'none')
  INTO v_invalid_count, v_invalid_samples
  FROM public.bookings
  WHERE payment_method IS NULL
     OR payment_method NOT IN ('UPI', 'Cash', 'Card', 'Net Banking', 'Wallet', 'Other');

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Migration aborted! Found % booking rows with invalid or unrecognized payment_method values: [%]. No data was deleted. Resolve these values manually before applying the constraint.',
      v_invalid_count, v_invalid_samples;
  END IF;

  RAISE NOTICE 'All % existing rows satisfy canonical payment_method requirements.', (SELECT COUNT(*) FROM public.bookings);

  -- Step 3: Safely replace check constraint
  ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

  ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_payment_method_check
    CHECK (payment_method IN ('UPI', 'Cash', 'Card', 'Net Banking', 'Wallet', 'Other'));

  RAISE NOTICE 'Constraint bookings_payment_method_check successfully applied.';
END $$;

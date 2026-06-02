-- Privacy hardening: do not retain driver bank details in the app database.
UPDATE "driver_profiles"
SET "bank_account_number" = NULL,
    "bank_clabe" = NULL
WHERE "bank_account_number" IS NOT NULL
   OR "bank_clabe" IS NOT NULL;
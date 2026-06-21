# Zip Codes Import Script

This script imports zip codes from the CSV file into your Supabase database.

## Prerequisites

1. Make sure you have run the migration to create the `zip_codes` table:
   ```bash
   # The migration file is: supabase/migrations/20251122000000_create_zip_codes_table.sql
   ```

2. Add your Supabase Service Role Key to your `.env` file:
   ```
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"
   ```
   
   **Note**: 
   - The script will automatically use `VITE_SUPABASE_URL` from your existing `.env` file
   - You only need to add the `SUPABASE_SERVICE_ROLE_KEY` 
   - Find it in your Supabase dashboard: **Settings → API → Service Role Key**
   - This is different from the Publishable Key (it has elevated permissions for bulk imports)

## Running the Import

```bash
npm run import-zip-codes
```

Or directly:
```bash
node scripts/import-zip-codes.js
```

## What it does

- Reads the CSV file from `src/data/zip_codes_usa.csv`
- Parses all 33,782 zip codes
- Imports them into the `zip_codes` table in Supabase in batches of 1000
- Uses `upsert` to handle duplicates (won't fail if run multiple times)

## Notes

- The script will show progress as it imports batches
- If there are errors, they will be logged but the script will continue
- The import may take a few minutes depending on your connection speed


/**
 * Script to generate combined migration SQL for applying to any Supabase project
 * Dynamically reads ALL migration files from supabase/migrations/
 * 
 * Usage: node scripts/apply-migrations.js
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIGRATIONS_DIR = join(__dirname, '../supabase/migrations');
const OUTPUT_FILE = join(__dirname, '../supabase/combined-migration.sql');

function getMigrationFiles() {
  try {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort by timestamp (filename starts with timestamp)
    
    return files;
  } catch (error) {
    console.error('❌ Error reading migrations directory:', error.message);
    process.exit(1);
  }
}

function generateCombinedMigration() {
  const migrationFiles = getMigrationFiles();
  
  console.log('📝 Generating combined migration script...\n');
  console.log(`📂 Found ${migrationFiles.length} migration files:\n`);
  
  migrationFiles.forEach((file, index) => {
    console.log(`   ${index + 1}. ${file}`);
  });
  
  let combinedSQL = '-- Combined Migration Script\n';
  combinedSQL += '-- Generated automatically - Run this in Supabase SQL Editor\n';
  combinedSQL += `-- Generated at: ${new Date().toISOString()}\n`;
  combinedSQL += `-- Total migrations: ${migrationFiles.length}\n\n`;
  
  for (const file of migrationFiles) {
    const filePath = join(MIGRATIONS_DIR, file);
    const sql = readFileSync(filePath, 'utf-8');
    
    combinedSQL += `-- ========================================\n`;
    combinedSQL += `-- Migration: ${file}\n`;
    combinedSQL += `-- ========================================\n\n`;
    combinedSQL += sql;
    combinedSQL += '\n\n';
  }
  
  writeFileSync(OUTPUT_FILE, combinedSQL);
  
  console.log('\n✅ Created combined migration file:');
  console.log(`   ${OUTPUT_FILE}\n`);
  console.log('📋 Next steps:');
  console.log('   1. Open your Supabase dashboard SQL Editor');
  console.log('   2. Copy contents from: supabase/combined-migration.sql');
  console.log('   3. Paste and run in SQL Editor\n');
  
  return migrationFiles.length;
}

generateCombinedMigration();

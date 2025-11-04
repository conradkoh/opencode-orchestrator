#!/usr/bin/env node
/**
 * Script to clear chat-related tables in Convex
 *
 * Clears the following tables:
 * - chatChunks
 * - chatMessages
 * - chatSessions
 *
 * Usage:
 *   node scripts/clear-chat-tables.ts
 *
 * This script provides instructions for clearing tables via Convex Dashboard.
 */

const tables = ['chatChunks', 'chatMessages', 'chatSessions'];

console.log('🚀 Chat Tables Cleanup Script\n');
console.log('⚠️  WARNING: This will delete all data from the following tables:');
tables.forEach((table) => console.log(`   - ${table}`));
console.log('\nThis action cannot be undone!\n');

console.log('📋 Instructions to clear tables:\n');
console.log('Option 1 - Via Convex Dashboard (Recommended):');
console.log('1. Go to https://dashboard.convex.dev');
console.log('2. Select your project and deployment');
console.log('3. Go to "Data" tab');
console.log('4. For each table listed above:');
console.log('   - Click on the table name');
console.log('   - Select all rows');
console.log('   - Click "Delete" button\n');

console.log('Option 2 - Via Convex CLI:');
console.log('Run these commands in order:\n');
tables.forEach((table) => {
  console.log(`  # Clear ${table}`);
  console.log(`  # (You'll need to manually delete rows via dashboard)\n`);
});

console.log('✅ After clearing all tables, you can proceed with the schema migration');
console.log('   Run: git status to see the pending changes\n');

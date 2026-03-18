#!/usr/bin/env node
/**
 * Pre-Deploy Validation Script
 * Run this before deploying to catch broken games
 *
 * Usage: node validate-games.js
 */

const fs = require('fs');
const path = require('path');

const GAMES_DIR = path.join(__dirname, '../games');
const REQUIRED_FILES = ['index.html', 'game.js'];
const SHARED_FILES = [
  'games/shared/game-design-utils.js',
  'games/shared/game-2d-utils.js',
  'games/shared/pwa-register.js',
  'games/shared/design-system.css'
];

const results = {
  passed: [],
  failed: [],
  warnings: []
};

function validateGame(gamePath, gameName) {
  const issues = [];

  // Check required files exist
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(gamePath, file);
    if (!fs.existsSync(filePath)) {
      issues.push(`Missing ${file}`);
    }
  }

  // Check game.js for common errors
  const gameJsPath = path.join(gamePath, 'game.js');
  if (fs.existsSync(gameJsPath)) {
    const content = fs.readFileSync(gameJsPath, 'utf8');

    // Check for undefined imports
    const importMatches = content.match(/import\s+{([^}]+)}\s+from\s+['"]([^'"]+)['"];?/g) || [];
    for (const imp of importMatches) {
      const moduleMatch = imp.match(/from\s+['"]([^'"]+)['"];?/);
      if (moduleMatch) {
        const modulePath = moduleMatch[1];
        // Check if shared module exists
        if (modulePath.includes('shared/')) {
          const fullPath = path.join(__dirname, '..', modulePath.replace('.js', '') + '.js');
          if (!fs.existsSync(fullPath)) {
            issues.push(`Import not found: ${modulePath}`);
          }
        }
      }
    }

    // Check for syntax errors (basic)
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      issues.push(`Brace mismatch: ${openBraces} open, ${closeBraces} close`);
    }

    // Check for common mistakes
    if (content.includes('playSound(\'king\')')) {
      issues.push(`Invalid sound: 'king' (use 'levelup' instead)`);
    }

    // Check for missing event listener cleanup
    if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
      // This is just a warning, not an error
    }
  }

  // Check index.html
  const indexPath = path.join(gamePath, 'index.html');
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf8');

    // Check for required meta tags
    if (!content.includes('viewport')) {
      issues.push('Missing viewport meta tag');
    }

    // Check for game.js import
    if (!content.includes('game.js')) {
      issues.push('Missing game.js script import');
    }

    // Check for cache busting
    if (!content.includes('?v=')) {
      results.warnings.push(`${gameName}: Missing cache busting (?v=)`);
    }
  }

  return issues;
}

function main() {
  console.log('🔍 Validating Games Hub...\n');

  // Check shared files exist
  console.log('Checking shared files...');
  for (const file of SHARED_FILES) {
    const fullPath = path.join(__dirname, '..', file);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Shared file missing: ${file}`);
      process.exit(1);
    }
  }
  console.log('✅ All shared files present\n');

  // Get all game directories
  const games = fs.readdirSync(GAMES_DIR)
    .filter(f => fs.statSync(path.join(GAMES_DIR, f)).isDirectory())
    .filter(f => !f.startsWith('.') && f !== 'shared');

  console.log(`Found ${games.length} games to validate\n`);

  // Validate each game
  for (const game of games) {
    const gamePath = path.join(GAMES_DIR, game);
    const issues = validateGame(gamePath, game);

    if (issues.length === 0) {
      results.passed.push(game);
      console.log(`✅ ${game}`);
    } else {
      results.failed.push({ game, issues });
      console.log(`❌ ${game}:`);
      issues.forEach(issue => console.log(`   - ${issue}`));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(`✅ Passed: ${results.passed.length}/${games.length}`);
  console.log(`❌ Failed: ${results.failed.length}/${games.length}`);
  console.log(`⚠️ Warnings: ${results.warnings.length}`);

  if (results.failed.length > 0) {
    console.log('\nFailed games:');
    results.failed.forEach(({ game, issues }) => {
      console.log(`  ${game}: ${issues.length} issues`);
    });
    process.exit(1);
  }

  if (results.warnings.length > 0) {
    console.log('\nWarnings:');
    results.warnings.forEach(w => console.log(`  ${w}`));
  }

  console.log('\n✅ All games validated successfully!');
  process.exit(0);
}

main();

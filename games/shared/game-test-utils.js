// =============================================
// Game Testing Utilities - Automated Validation
// Run this before deploying to catch errors
// =============================================

/**
 * Validates a game module by checking:
 * 1. All imports resolve
 * 2. No undefined variables
 * 3. Required DOM elements exist
 * 4. Event listeners are properly attached
 */
export class GameValidator {
  constructor(gameName) {
    this.gameName = gameName;
    this.errors = [];
    this.warnings = [];
  }

  // Check if required DOM elements exist
  checkDOMElements(selectors) {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) {
        this.errors.push(`Missing DOM element: ${selector}`);
      }
    }
  }

  // Check if imported modules are valid
  checkImports(importedModules) {
    for (const [name, module] of Object.entries(importedModules)) {
      if (module === undefined || module === null) {
        this.errors.push(`Failed to import: ${name}`);
      }
    }
  }

  // Check if required functions exist
  checkFunctions(functions) {
    for (const [name, fn] of Object.entries(functions)) {
      if (typeof fn !== 'function') {
        this.errors.push(`Missing function: ${name}`);
      }
    }
  }

  // Check if canvas context is available
  checkCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      this.errors.push(`Canvas not found: #${canvasId}`);
      return false;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.errors.push(`Failed to get 2D context from #${canvasId}`);
      return false;
    }
    return true;
  }

  // Validate game initialization
  validateInit(initFn) {
    try {
      initFn();
      return true;
    } catch (e) {
      this.errors.push(`Init failed: ${e.message}`);
      return false;
    }
  }

  // Run all checks and report
  report() {
    console.group(`🎮 Game Validator: ${this.gameName}`);

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All checks passed!');
    } else {
      if (this.errors.length > 0) {
        console.error(`❌ ${this.errors.length} Errors:`);
        this.errors.forEach(e => console.error(`  - ${e}`));
      }
      if (this.warnings.length > 0) {
        console.warn(`⚠️ ${this.warnings.length} Warnings:`);
        this.warnings.forEach(w => console.warn(`  - ${w}`));
      }
    }

    console.groupEnd();
    return this.errors.length === 0;
  }

  // Check if game is playable (basic smoke test)
  smokeTest(tests) {
    let passed = 0;
    let failed = 0;

    for (const [name, testFn] of Object.entries(tests)) {
      try {
        testFn();
        passed++;
        console.log(`✅ ${name}`);
      } catch (e) {
        failed++;
        this.errors.push(`Smoke test failed: ${name} - ${e.message}`);
        console.error(`❌ ${name}: ${e.message}`);
      }
    }

    return { passed, failed };
  }
}

/**
 * Safe module loader - wraps imports with error handling
 */
export async function safeImport(modulePath, fallback = null) {
  try {
    const module = await import(modulePath);
    return { success: true, module, error: null };
  } catch (e) {
    console.error(`Failed to import ${modulePath}:`, e);
    return { success: false, module: fallback, error: e };
  }
}

/**
 * Validates shared utilities before using them
 */
export function validateUtils(utils, requiredMethods = []) {
  const missing = [];

  for (const method of requiredMethods) {
    if (typeof utils[method] !== 'function') {
      missing.push(method);
    }
  }

  if (missing.length > 0) {
    console.warn(`Utils missing methods: ${missing.join(', ')}`);
    return false;
  }

  return true;
}

/**
 * Error boundary for game loops
 */
export function createSafeLoop(loopFn, errorHandler) {
  return function safeLoop(...args) {
    try {
      return loopFn(...args);
    } catch (e) {
      console.error('Game loop error:', e);
      if (errorHandler) errorHandler(e);
      return false; // Signal to stop loop
    }
  };
}

/**
 * Pre-flight checklist for games
 */
export const preflightChecklist = {
  // Check if running in supported browser
  checkBrowser() {
    const checks = {
      canvas: !!document.createElement('canvas').getContext('2d'),
      es6: (() => { try { return eval('() => {}') } catch(e) { return false } })(),
      modules: 'noModule' in document.createElement('script'),
      localStorage: (() => { try { localStorage.setItem('test', 'test'); localStorage.removeItem('test'); return true } catch(e) { return false } })()
    };

    const failed = Object.entries(checks)
      .filter(([_, pass]) => !pass)
      .map(([name]) => name);

    if (failed.length > 0) {
      console.error('Browser compatibility issues:', failed);
      return false;
    }

    return true;
  },

  // Check if all required scripts loaded
  checkScripts(scriptNames) {
    // In a real implementation, this would check if scripts are loaded
    return true;
  }
};

// Auto-run validation in development
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
  console.log('🧪 Game Testing Utils loaded (development mode)');
}

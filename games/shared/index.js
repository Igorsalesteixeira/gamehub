/**
 * Game Hub - Shared Modules Index
 *
 * Ponto central de exportação para todos os módulos compartilhados.
 * Use este arquivo para importar qualquer utilitário do Game Hub.
 *
 * @module shared
 * @example
 * import { GameTimer, GameLoop, InputManager } from '../shared/index.js';
 */

// ============================================
// Versionamento
// ============================================
export {
  GLOBAL_VERSION,
  BUILD_DATE,
  FULL_VERSION,
  versionedUrl,
  getVersionInfo,
  logVersion
} from './version.js';

// ============================================
// Core - Estatísticas, Storage, Eventos
// ============================================
export {
  GameStats,
  GameStorage,
  EventEmitter
} from './game-core.js';

// ============================================
// Timer
// ============================================
export {
  GameTimer,
  createCountdown,
  formatTime
} from './timer.js';

// ============================================
// Game Loop
// ============================================
export {
  GameLoop,
  createLoop,
  createAnimation
} from './game-loop.js';

// ============================================
// Input Manager
// ============================================
export {
  InputManager,
  createDirectionalInput
} from './input-manager.js';

// ============================================
// Multiplayer
// ============================================
export {
  MultiplayerManager,
  createMultiplayer,
  isRealtimeAvailable
} from './multiplayer-manager.js';

// ============================================
// Autenticação
// ============================================
export {
  waitForAuth,
  requireAuth,
  getCurrentUser,
  getCurrentSession,
  isAuthenticated,
  hasRole,
  isAdmin,
  getUserMetadata,
  updateUserMetadata,
  logout,
  onAuthChange,
  authGuard,
  useAuth
} from './auth-guard.js';

// ============================================
// Utilitários 2D (se existir)
// ============================================
export {
  // Canvas helpers
  createCanvas,
  resizeCanvas,
  clearCanvas,
  drawGrid,
  // Colisão
  checkRectCollision,
  checkCircleCollision,
  checkPointInRect,
  // Vetores
  Vector2,
  addVectors,
  subVectors,
  scaleVector,
  normalizeVector,
  distance,
  lerp
} from './game-2d-utils.js';

// ============================================
// Design System (se existir)
// ============================================
export {
  // Cores
  COLORS,
  // Animações
  animate,
  easeInOut,
  easeOut,
  easeIn,
  // Partículas
  ParticleSystem,
  createConfetti,
  createSparkles
} from './game-design-utils.js';

// ============================================
// Test Utils (se existir)
// ============================================
export {
  // Test helpers
  createMockGame,
  simulateClick,
  simulateKeyPress,
  wait,
  // Assertions
  assertEquals,
  assertTrue,
  assertFalse
} from './game-test-utils.js';

// ============================================
// PWA (se existir)
// ============================================
export {
  registerServiceWorker,
  unregisterServiceWorker,
  checkForUpdates
} from './pwa-register.js';

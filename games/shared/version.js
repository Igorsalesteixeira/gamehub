/**
 * Módulo de Versionamento Global
 *
 * Centraliza o controle de versão para cache-busting de todos os jogos.
 * Altere GLOBAL_VERSION para invalidar caches em toda a aplicação.
 *
 * @module version
 */

/**
 * Versão global do aplicativo.
 * Incremente este valor para forçar atualização de cache em todos os jogos.
 * @type {string}
 */
export const GLOBAL_VERSION = '25';

/**
 * Data de build da aplicação em formato ISO 8601.
 * Útil para debugging e rastreamento de deployments.
 * @type {string}
 */
export const BUILD_DATE = new Date().toISOString();

/**
 * Versão completa formatada para exibição.
 * @type {string}
 */
export const FULL_VERSION = `${GLOBAL_VERSION} (${BUILD_DATE})`;

/**
 * Gera uma URL com query string de versão para cache-busting.
 *
 * @param {string} url - URL base (ex: '/games/puzzle/game.js')
 * @returns {string} URL com parâmetro de versão (ex: '/games/puzzle/game.js?v=25')
 *
 * @example
 * const scriptUrl = versionedUrl('/games/chess/game.js');
 * // Result: '/games/chess/game.js?v=25'
 */
export function versionedUrl(url) {
  if (!url || typeof url !== 'string') {
    console.warn('[version] URL inválida fornecida:', url);
    return url;
  }

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${GLOBAL_VERSION}`;
}

/**
 * Retorna um objeto com informações de versão para logging.
 *
 * @returns {Object} Informações de versão
 * @returns {string} returns.version - Versão global
 * @returns {string} returns.buildDate - Data de build
 * @returns {string} returns.userAgent - User agent do navegador
 */
export function getVersionInfo() {
  return {
    version: GLOBAL_VERSION,
    buildDate: BUILD_DATE,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language
  };
}

/**
 * Loga informações de versão no console.
 * Útil para debugging em produção.
 */
export function logVersion() {
  console.log(
    `%c[Game Hub] v${GLOBAL_VERSION} | Build: ${BUILD_DATE}`,
    'color: #4CAF50; font-weight: bold; font-size: 12px;'
  );
}

/**
 * @fileoverview Sistema de verificação de estado para jogos do Game Hub.
 * Permite registrar regras de validação e verificar o estado do jogo.
 */

/**
 * Resultado da verificação de uma regra individual.
 * @typedef {Object} RuleResult
 * @property {string} rule - Nome da regra verificada
 * @property {boolean} valid - Se a regra passou ou falhou
 */

/**
 * Erro lançado quando uma verificação strict falha.
 */
export class VerificationError extends Error {
  /**
   * @param {string} ruleName - Nome da regra que falhou
   * @param {Object} state - Estado do jogo no momento da falha
   */
  constructor(ruleName, state) {
    super(`Verification failed for rule: ${ruleName}`);
    this.name = 'VerificationError';
    this.ruleName = ruleName;
    this.state = state;
  }
}

/**
 * Classe para verificação de estado de jogos.
 * Permite registrar regras de validação e executar verificações
 * contra o estado atual do jogo.
 */
export class GameVerifier {
  /**
   * Cria uma nova instância do verificador.
   * @param {string} gameId - Identificador único do jogo
   */
  constructor(gameId) {
    /** @type {string} */
    this.gameId = gameId;

    /** @type {Map<string, Function>} */
    this.rules = new Map();
  }

  /**
   * Adiciona uma nova regra de validação.
   * @param {string} name - Nome identificador da regra
   * @param {Function} validator - Função que recebe o estado e retorna boolean
   * @returns {GameVerifier} - Retorna a instância para encadeamento
   * @throws {TypeError} Se o validator não for uma função
   */
  addRule(name, validator) {
    if (typeof validator !== 'function') {
      throw new TypeError('Validator must be a function');
    }
    this.rules.set(name, validator);
    return this;
  }

  /**
   * Remove uma regra previamente registrada.
   * @param {string} name - Nome da regra a remover
   * @returns {boolean} - True se a regra foi removida, false se não existia
   */
  removeRule(name) {
    return this.rules.delete(name);
  }

  /**
   * Verifica se uma regra específica está registrada.
   * @param {string} name - Nome da regra
   * @returns {boolean} - True se a regra existe
   */
  hasRule(name) {
    return this.rules.has(name);
  }

  /**
   * Executa todas as regras registradas contra o estado fornecido.
   * @param {Object} state - Estado atual do jogo
   * @returns {RuleResult[]} - Array com resultados de cada regra
   */
  verify(state) {
    const results = [];

    for (const [name, validator] of this.rules) {
      try {
        const valid = validator(state);
        results.push({ rule: name, valid: Boolean(valid) });
      } catch (error) {
        results.push({ rule: name, valid: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Executa todas as regras e lança erro se alguma falhar.
   * @param {Object} state - Estado atual do jogo
   * @returns {RuleResult[]} - Array com resultados (todas as regras passaram)
   * @throws {VerificationError} - Se alguma regra falhar
   */
  verifyStrict(state) {
    const results = this.verify(state);
    const failed = results.find(r => !r.valid);

    if (failed) {
      throw new VerificationError(failed.rule, state);
    }

    return results;
  }

  /**
   * Retorna o número de regras registradas.
   * @returns {number} - Quantidade de regras
   */
  getRuleCount() {
    return this.rules.size;
  }

  /**
   * Retorna os nomes de todas as regras registradas.
   * @returns {string[]} - Array com nomes das regras
   */
  getRuleNames() {
    return Array.from(this.rules.keys());
  }

  /**
   * Limpa todas as regras registradas.
   */
  clearRules() {
    this.rules.clear();
  }
}

/**
 * Cria um verificador pré-configurado com regras comuns.
 * Útil para jogos que seguem padrões similares.
 * @param {string} gameId - Identificador do jogo
 * @returns {GameVerifier} - Verificador configurado
 */
export function createCommonVerifier(gameId) {
  return new GameVerifier(gameId);
}

export default GameVerifier;

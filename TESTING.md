# 🎮 Games Hub - Automated Testing

## Testes Automatizados

Este projeto inclui testes automatizados para garantir que todos os jogos funcionem corretamente.

### 🚀 Como Rodar os Testes

```bash
# Instalar dependências
npm install

# Instalar navegadores do Playwright
npx playwright install

# Rodar validação estática
npm run validate

# Rodar testes automatizados
npm run test

# Rodar tudo (validação + testes) - use antes de commitar
npm run predeploy
```

### 🧪 Tipos de Testes

1. **Validação Estática** (`npm run validate`)
   - Verifica se arquivos necessários existem
   - Checa imports válidos
   - Verifica erros de sintaxe básicos
   - Valida meta tags e estrutura HTML

2. **Testes Automatizados** (`npm run test`)
   - Abre cada jogo em navegador real (Chrome/Firefox)
   - Verifica se não há erros de JavaScript
   - Testa se botões de iniciar funcionam
   - Tira screenshots se houver falhas

### 🔧 Configuração do CI/CD

Os testes rodam automaticamente em:
- Todo push para `main` ou `develop`
- Todo Pull Request

### 📝 Pre-commit Hook

Antes de cada commit, o sistema roda:
```
npm run validate
```

Se falhar, o commit é bloqueado.

### 🐛 Debug

```bash
# Rodar em modo UI (visual)
npm run test:ui

# Rodar com debugger
npm run test:debug

# Ver relatório HTML
npx playwright show-report
```

### 📁 Estrutura

```
games/
├── shared/
│   ├── game-design-utils.js    # Utilitários de game design
│   ├── game-2d-utils.js        # Utilitários 2D (particles, etc)
│   └── game-test-utils.js      # Utilitários de teste
├── snake/
├── tetris/
└── ... (43 jogos)

scripts/
└── validate-games.js           # Validação estática

tests/
└── games.spec.js               # Testes Playwright

.github/workflows/
└── test.yml                    # CI/CD GitHub Actions
```

### ⚠️ Boas Práticas

1. **Sempre rode `npm run predeploy` antes de commitar**
2. **Teste em 1 jogo por vez quando fizer mudanças grandes**
3. **Incremente a versão `?v=N` quando alterar arquivos**
4. **Não commit código quebrado** - os testes vão bloquear

### 🆘 Erros Comuns

| Erro | Solução |
|------|---------|
| "Import not found" | Verifique se o caminho do import está correto |
| "Canvas not found" | Verifique se o elemento canvas existe no HTML |
| "Game loop error" | Verifique erros de sintaxe no JavaScript |
| "Button not clickable" | Verifique se o botão tem o ID correto |

### 📊 Reports

Os relatórios de teste são salvos em:
- `playwright-report/` - Relatório HTML
- `test-results/` - Screenshots e vídeos de falhas

---

**Nota:** Os testes automatizados garantem que nenhum jogo quebre em produção. Sempre execute antes de deploy!

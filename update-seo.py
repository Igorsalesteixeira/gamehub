"""
update-seo.py — Atualiza automaticamente SEO do Games Hub
Executa: python update-seo.py

Le a pasta games/ para detectar todos os jogos e atualiza:
  1. sitemap.xml — adiciona URLs de jogos novos
  2. index.html — meta description, keywords, OG tags, dados estruturados
  3. Mostra resumo do que mudou

Fonte de verdade: pasta games/ (cada subpasta com index.html = 1 jogo)
"""

import os
import re
import json
import sys
from pathlib import Path
from datetime import datetime

# Fix encoding for Windows console
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "https://gameshub.com.br"
ROOT = Path(__file__).parent

# Mapeamento: pasta -> (nome exibicao, genero, emoji, keywords)
GAME_META = {
    "solitaire":   ("Paciencia (Solitaire)", "Cartas", "🃏", "paciencia online, solitaire"),
    "snake":       ("Cobrinha (Snake)", "Arcade", "🐍", "cobrinha online, snake game"),
    "checkers":    ("Dama (Checkers)", "Tabuleiro", "⚫", "dama online, checkers"),
    "memory":      ("Jogo da Memoria", "Puzzle", "🧠", "jogo da memoria online"),
    "blackjack":   ("Blackjack", "Cartas", "🃏", "blackjack online"),
    "freecell":    ("Freecell", "Cartas", "🂡", "freecell online"),
    "tictactoe":   ("Jogo da Velha", "Tabuleiro", "❌", "jogo da velha online"),
    "reversi":     ("Reversi", "Tabuleiro", "⚪", "reversi online, othello"),
    "minesweeper": ("Campo Minado", "Puzzle", "💣", "campo minado online, minesweeper"),
    "termo":       ("Termo", "Palavras", "📝", "termo online, wordle portugues"),
    "hangman":     ("Forca", "Palavras", "🔤", "jogo da forca online"),
    "game2048":    ("2048", "Puzzle", "🔢", "2048 online"),
    "sudoku":      ("Sudoku", "Puzzle", "🔢", "sudoku online"),
    "puzzle15":    ("Puzzle 15", "Puzzle", "🧩", "puzzle 15 online"),
    "tetris":      ("Tetris", "Arcade", "🧱", "tetris online"),
    "flappybird":  ("Flappy Bird", "Arcade", "🐦", "flappy bird online"),
    "pong":        ("Pong", "Arcade", "🏓", "pong online"),
    "spider-solitaire": ("Spider Solitaire", "Cartas", "🕷️", "spider solitaire online"),
}

def detect_games():
    """Detecta jogos existentes na pasta games/"""
    games_dir = ROOT / "games"
    games = []
    for d in sorted(games_dir.iterdir()):
        if d.is_dir() and (d / "index.html").exists():
            folder = d.name
            if folder in GAME_META:
                name, genre, emoji, kw = GAME_META[folder]
            else:
                # Jogo novo sem mapeamento — usa nome da pasta
                name = folder.replace("-", " ").replace("_", " ").title()
                genre = "Jogo"
                emoji = "🎮"
                kw = f"{name.lower()} online"
                print(f"  [AVISO] Jogo '{folder}' nao tem mapeamento em GAME_META. Adicione manualmente!")
            games.append({
                "folder": folder,
                "name": name,
                "genre": genre,
                "emoji": emoji,
                "keywords": kw,
                "url": f"{BASE_URL}/games/{folder}/index.html"
            })
    return games


def update_sitemap(games):
    """Regenera sitemap.xml com todos os jogos"""
    sitemap_path = ROOT / "sitemap.xml"

    urls = [
        (f"{BASE_URL}/", "weekly", "1.0"),
    ]
    for g in games:
        urls.append((g["url"], "monthly", "0.9"))

    # Paginas extras
    extras = [
        ("doacao.html", "monthly", "0.5"),
        ("ranking.html", "daily", "0.7"),
        ("report-bug.html", "monthly", "0.4"),
        ("sobre.html", "monthly", "0.4"),
        ("privacidade.html", "monthly", "0.3"),
    ]
    for page, freq, pri in extras:
        urls.append((f"{BASE_URL}/{page}", freq, pri))

    xml_lines = ['<?xml version="1.0" encoding="UTF-8"?>',
                 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, freq, pri in urls:
        xml_lines.append(f'  <url>')
        xml_lines.append(f'    <loc>{loc}</loc>')
        xml_lines.append(f'    <changefreq>{freq}</changefreq>')
        xml_lines.append(f'    <priority>{pri}</priority>')
        xml_lines.append(f'  </url>')
    xml_lines.append('</urlset>')
    xml_lines.append('')

    new_content = '\n'.join(xml_lines)
    old_content = sitemap_path.read_text(encoding='utf-8') if sitemap_path.exists() else ''

    if new_content != old_content:
        sitemap_path.write_text(new_content, encoding='utf-8')
        print(f"  [ATUALIZADO] sitemap.xml ({len(games)} jogos + 4 paginas)")
        return True
    else:
        print(f"  [OK] sitemap.xml (sem mudancas)")
        return False


def update_index_meta(games):
    """Atualiza meta tags e dados estruturados no index.html"""
    index_path = ROOT / "index.html"
    content = index_path.read_text(encoding='utf-8')
    changed = False
    n = len(games)

    # Lista de nomes curtos para descricoes
    short_names = [g["name"].split(" (")[0] for g in games]

    # 1. Atualizar <title>
    new_title = f"Games Hub - {n} Jogos Online Gratis | {', '.join(short_names[:3])} e mais"
    old_title_match = re.search(r'<title>(.*?)</title>', content)
    if old_title_match and old_title_match.group(1) != new_title:
        content = content.replace(old_title_match.group(0), f'<title>{new_title}</title>')
        changed = True
        print(f"  [ATUALIZADO] <title>")

    # 2. Atualizar meta description
    all_names = ', '.join(short_names)
    new_desc = f"Jogue {n} jogos online gratis: {all_names}. Sem download, direto no navegador!"
    old_desc_match = re.search(r'<meta name="description" content="(.*?)"', content)
    if old_desc_match and old_desc_match.group(1) != new_desc:
        content = content.replace(old_desc_match.group(0), f'<meta name="description" content="{new_desc}"')
        changed = True
        print(f"  [ATUALIZADO] meta description")

    # 3. Atualizar keywords
    all_kw = ", ".join([g["keywords"] for g in games])
    new_kw = f"jogos online, jogos gratis, {all_kw}, jogos no navegador, game hub"
    old_kw_match = re.search(r'<meta name="keywords" content="(.*?)"', content)
    if old_kw_match and old_kw_match.group(1) != new_kw:
        content = content.replace(old_kw_match.group(0), f'<meta name="keywords" content="{new_kw}"')
        changed = True
        print(f"  [ATUALIZADO] meta keywords")

    # 4. Atualizar OG title e description
    og_title = f"Games Hub - {n} Jogos Online Gratis"
    top_names = ', '.join(short_names[:7])
    og_desc = f"Jogue {n} jogos gratis no navegador: {top_names} e muito mais. Ranking semanal e estatisticas!"

    old_og_title = re.search(r'<meta property="og:title" content="(.*?)"', content)
    if old_og_title and old_og_title.group(1) != og_title:
        content = content.replace(old_og_title.group(0), f'<meta property="og:title" content="{og_title}"')
        changed = True
        print(f"  [ATUALIZADO] og:title")

    old_og_desc = re.search(r'<meta property="og:description" content="(.*?)"', content)
    if old_og_desc and old_og_desc.group(1) != og_desc:
        content = content.replace(old_og_desc.group(0), f'<meta property="og:description" content="{og_desc}"')
        changed = True
        print(f"  [ATUALIZADO] og:description")

    # 5. Atualizar Twitter title e description
    old_tw_title = re.search(r'<meta name="twitter:title" content="(.*?)"', content)
    if old_tw_title and old_tw_title.group(1) != og_title:
        content = content.replace(old_tw_title.group(0), f'<meta name="twitter:title" content="{og_title}"')
        changed = True
        print(f"  [ATUALIZADO] twitter:title")

    tw_desc = f"Jogue {n} jogos gratis no navegador: {top_names} e muito mais!"
    old_tw_desc = re.search(r'<meta name="twitter:description" content="(.*?)"', content)
    if old_tw_desc and old_tw_desc.group(1) != tw_desc:
        content = content.replace(old_tw_desc.group(0), f'<meta name="twitter:description" content="{tw_desc}"')
        changed = True
        print(f"  [ATUALIZADO] twitter:description")

    # 6. Atualizar WebSite structured data description
    ws_desc = f"Plataforma gratuita com {n} jogos online: {', '.join(short_names[:5])} e mais. Jogue direto no navegador!"
    old_ws_match = re.search(r'"@type":\s*"WebSite".*?"description":\s*"(.*?)"', content, re.DOTALL)
    if old_ws_match and old_ws_match.group(1) != ws_desc:
        content = content.replace(old_ws_match.group(1), ws_desc)
        changed = True
        print(f"  [ATUALIZADO] WebSite structured data")

    # 7. Regenerar ItemList structured data
    items = []
    for i, g in enumerate(games, 1):
        items.append({
            "@type": "ListItem",
            "position": i,
            "item": {
                "@type": "VideoGame",
                "name": g["name"],
                "url": g["url"],
                "genre": g["genre"],
                "operatingSystem": "Web Browser",
                "applicationCategory": "Game",
                "offers": {"@type": "Offer", "price": "0", "priceCurrency": "BRL"}
            }
        })

    item_list = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Jogos disponíveis no Games Hub",
        "numberOfItems": n,
        "itemListElement": items
    }

    new_json = json.dumps(item_list, ensure_ascii=False, indent=2)

    # Replace existing ItemList block
    pattern = r'<script type="application/ld\+json">\s*\{[^<]*"@type":\s*"ItemList"[^<]*\}\s*</script>'
    match = re.search(pattern, content, re.DOTALL)

    new_block = f'<script type="application/ld+json">\n  {new_json}\n  </script>'

    if match:
        content = content[:match.start()] + new_block + content[match.end():]
        changed = True
        print(f"  [ATUALIZADO] ItemList structured data ({n} jogos)")

    if changed:
        index_path.write_text(content, encoding='utf-8')
        print(f"  [SALVO] index.html")
    else:
        print(f"  [OK] index.html (sem mudancas)")

    return changed


def main():
    print("=" * 50)
    print("  Games Hub — Atualizacao SEO Automatica")
    print("=" * 50)
    print()

    # Detectar jogos
    games = detect_games()
    print(f"Jogos detectados: {len(games)}")
    for g in games:
        print(f"  {g['emoji']} {g['name']} ({g['folder']})")
    print()

    # Atualizar arquivos
    print("Atualizando sitemap.xml...")
    update_sitemap(games)
    print()

    print("Atualizando index.html...")
    update_index_meta(games)
    print()

    print("=" * 50)
    print("  Concluido! Lembre-se de:")
    print("  - Adicionar o jogo novo na sidebar.js")
    print("  - Adicionar o card na secao games-grid do index.html")
    print("  - Adicionar a aba no ranking.html")
    print("  - Gerar nova og-image.png (abra generate-og-image.html)")
    print("=" * 50)


if __name__ == "__main__":
    main()

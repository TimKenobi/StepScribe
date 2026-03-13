"""
Export Service — Generate a professionally formatted recovery journal book as PDF.
Includes: cover, dedication, table of contents, introduction (about me / faith),
heroes, journal entries (with mood, conversations, photos), AI insights, statistics.
"""
import os
from datetime import datetime
from html import escape

from app.config import settings


# ─────────────────── Individual Section Builders ───────────────────

def _cover_page(title: str, author: str, year: str) -> str:
    return f"""
    <div class="cover">
        <div class="cover-border">
            <div class="cover-ornament">&#10087;</div>
            <h1>{escape(title)}</h1>
            <div class="cover-subtitle">A Recovery Journal</div>
            <div class="cover-rule"></div>
            <div class="author">{escape(author)}</div>
            <div class="year">{escape(year)}</div>
        </div>
    </div>
    <div class="page-break"></div>
    """


def _dedication_page(dedication: str) -> str:
    if not dedication:
        return ""
    return f"""
    <div class="dedication">
        <div class="dedication-ornament">&#10053;</div>
        <p>{escape(dedication)}</p>
    </div>
    <div class="page-break"></div>
    """


def _table_of_contents(entries: list[dict], has_intro: bool, has_heroes: bool,
                        has_memories: bool, has_stats: bool) -> str:
    items = []
    chapter = 1

    if has_intro:
        items.append('<div class="toc-item"><span class="toc-title">Introduction</span></div>')

    if has_heroes:
        items.append('<div class="toc-item"><span class="toc-title">My Recovery Heroes</span></div>')

    for e in entries:
        title = escape(e.get("title", "Untitled"))
        date = escape(e.get("date", ""))
        items.append(
            f'<div class="toc-item">'
            f'<span class="toc-chapter">{chapter}.</span>'
            f'<span class="toc-title">{title}</span>'
            f'<span class="toc-date">{date}</span>'
            f'</div>'
        )
        chapter += 1

    if has_memories:
        items.append('<div class="toc-item"><span class="toc-title">Insights &amp; Reflections</span></div>')
    if has_stats:
        items.append('<div class="toc-item"><span class="toc-title">Journey at a Glance</span></div>')

    items_html = "\n".join(items)
    return f"""
    <div class="toc">
        <h2 class="section-title">Contents</h2>
        <div class="toc-list">
            {items_html}
        </div>
    </div>
    <div class="page-break"></div>
    """


def _introduction_page(about_me: str, faith_label: str, faith_description: str) -> str:
    if not about_me and not faith_label:
        return ""

    about_block = ""
    if about_me:
        paragraphs = about_me.strip().split("\n")
        about_paras = "".join(f"<p>{escape(p)}</p>" for p in paragraphs if p.strip())
        about_block = f"""
        <div class="intro-section">
            <h3>About Me</h3>
            {about_paras}
        </div>
        """

    faith_block = ""
    if faith_label:
        faith_block = f"""
        <div class="intro-section">
            <h3>My Faith Tradition</h3>
            <p class="faith-label">{escape(faith_label)}</p>
            <p class="faith-desc">{escape(faith_description)}</p>
        </div>
        """

    return f"""
    <div class="introduction">
        <h2 class="section-title">Introduction</h2>
        {about_block}
        {faith_block}
    </div>
    <div class="page-break"></div>
    """


def _heroes_page(heroes: list[dict]) -> str:
    if not heroes:
        return ""

    hero_items = []
    for h in heroes:
        name = escape(h.get("name", ""))
        desc = escape(h.get("description", ""))
        hero_items.append(f"""
        <div class="hero-card">
            <div class="hero-name">{name}</div>
            <div class="hero-desc">{desc}</div>
        </div>
        """)

    return f"""
    <div class="heroes-section">
        <h2 class="section-title">My Recovery Heroes</h2>
        <p class="heroes-intro">The saints, thinkers, and guides who walk this path with me.</p>
        <div class="heroes-grid">
            {"".join(hero_items)}
        </div>
    </div>
    <div class="page-break"></div>
    """


def _entry_to_html(entry: dict, chapter_num: int) -> str:
    """Convert a single journal entry to a styled HTML chapter."""
    date_str = escape(entry.get("date", ""))
    title = escape(entry.get("title", "Untitled"))
    content_html = entry.get("content_html", "")
    prompt = entry.get("prompt_used", "")
    mood_label = entry.get("mood_label", "")
    mood_desc = entry.get("mood_description", "")
    mood_note = entry.get("mood_note", "")
    energy = entry.get("energy_level", 0)
    conversations = entry.get("conversations", [])
    attachments = entry.get("attachments", [])

    # ── Mood block ──
    mood_block = ""
    if mood_label:
        energy_bar = ""
        if energy:
            filled = "&#9679; " * energy
            empty = "&#9675; " * (10 - energy)
            energy_bar = f'<div class="mood-energy">Energy: {filled}{empty}</div>'
        note_block = f'<div class="mood-note">{escape(mood_note)}</div>' if mood_note else ""
        mood_block = f"""
        <div class="mood">
            <div class="mood-header">
                <span class="mood-weather">{escape(mood_label)}</span>
                <span class="mood-sep">&mdash;</span>
                <span class="mood-desc">{escape(mood_desc)}</span>
            </div>
            {energy_bar}
            {note_block}
        </div>
        """

    # ── Prompt block ──
    prompt_block = ""
    if prompt:
        prompt_block = f"""
        <div class="prompt">
            <span class="prompt-label">Prompt:</span> {escape(prompt)}
        </div>
        """

    # ── Photos block ──
    photos_block = ""
    if attachments:
        photos = []
        for att in attachments:
            caption = escape(att.get("caption", ""))
            data_uri = att.get("data_uri", "")
            cap_html = f'<div class="photo-caption">{caption}</div>' if caption else ""
            photos.append(f"""
            <div class="photo-item">
                <img src="{data_uri}" class="photo-img" alt="{caption}" />
                {cap_html}
            </div>
            """)
        photos_block = f"""
        <div class="photos-gallery">
            {"".join(photos)}
        </div>
        """

    # ── Conversations block ──
    conv_block = ""
    if conversations:
        all_msgs = []
        for msg_list in conversations:
            for msg in msg_list:
                role = msg.get("role", "user")
                content = escape(msg.get("content", ""))
                role_label = "You" if role == "user" else "Guide"
                role_class = "msg-user" if role == "user" else "msg-ai"
                all_msgs.append(
                    f'<div class="conv-msg {role_class}">'
                    f'<span class="msg-role">{role_label}:</span> {content}'
                    f'</div>'
                )
        if all_msgs:
            conv_block = f"""
            <div class="conversation">
                <div class="conv-header">Conversation</div>
                {"".join(all_msgs)}
            </div>
            """

    return f"""
    <div class="entry">
        <div class="chapter-num">Chapter {chapter_num}</div>
        <div class="entry-date">{date_str}</div>
        <h2 class="entry-title">{title}</h2>
        {mood_block}
        {prompt_block}
        <div class="entry-body">{content_html}</div>
        {photos_block}
        {conv_block}
    </div>
    <div class="page-break"></div>
    """


def _memories_page(memories: list[dict]) -> str:
    if not memories:
        return ""

    # Group by category
    categories: dict[str, list] = {}
    for m in memories:
        cat = m.get("category", "insight")
        categories.setdefault(cat, []).append(m)

    category_labels = {
        "struggle": "Struggles",
        "strength": "Strengths",
        "pattern": "Patterns",
        "relationship": "Relationships",
        "trigger": "Triggers",
        "insight": "Insights",
        "preference": "Preferences",
        "milestone": "Milestones",
    }

    sections = []
    for cat, items in categories.items():
        label = category_labels.get(cat, cat.title())
        mem_items = []
        for m in items:
            content = escape(m.get("content", ""))
            date = escape(m.get("created_at", ""))
            mem_items.append(f"""
            <div class="memory-item">
                <div class="memory-content">{content}</div>
                <div class="memory-date">{date}</div>
            </div>
            """)
        sections.append(f"""
        <div class="memory-category">
            <h3 class="memory-cat-title">{escape(label)}</h3>
            {"".join(mem_items)}
        </div>
        """)

    return f"""
    <div class="memories-section">
        <h2 class="section-title">Insights &amp; Reflections</h2>
        <p class="memories-intro">What the journey has revealed — patterns, strengths, and truths extracted along the way.</p>
        {"".join(sections)}
    </div>
    <div class="page-break"></div>
    """


def _statistics_page(statistics: dict) -> str:
    if not statistics:
        return ""

    total = statistics.get("total_entries", 0)
    words = statistics.get("total_words", 0)
    date_range = escape(statistics.get("date_range", ""))
    total_memories = statistics.get("total_memories", 0)
    moods = statistics.get("most_common_moods", [])

    mood_rows = ""
    for label, count in moods:
        mood_rows += f"""
        <div class="stat-mood-row">
            <span class="stat-mood-label">{escape(label)}</span>
            <span class="stat-mood-bar" style="width: {min(count * 30, 300)}px"></span>
            <span class="stat-mood-count">{count}</span>
        </div>
        """

    return f"""
    <div class="statistics-section">
        <h2 class="section-title">Journey at a Glance</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">{total}</div>
                <div class="stat-label">Journal Entries</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{words:,}</div>
                <div class="stat-label">Words Written</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{total_memories}</div>
                <div class="stat-label">Insights Gathered</div>
            </div>
        </div>
        <div class="stats-range">
            <strong>Period:</strong> {date_range}
        </div>
        {"<div class='stats-moods'><h3>Most Frequent Inner Weather</h3>" + mood_rows + "</div>" if mood_rows else ""}
    </div>
    <div class="page-break"></div>
    """


def _colophon() -> str:
    return f"""
    <div class="colophon">
        <div class="colophon-ornament">&#10087;</div>
        <p>Created with <strong>StepScribe</strong></p>
        <p class="colophon-tagline">AI-Powered Recovery Journaling — One Step at a Time</p>
        <p class="colophon-date">{datetime.now().strftime("%B %Y")}</p>
    </div>
    """


# ─────────────────── Main Builder ───────────────────

def build_journal_book_html(
    entries: list[dict],
    title: str | None = None,
    author: str | None = None,
    year: str | None = None,
    dedication: str = "",
    about_me: str = "",
    faith_label: str = "",
    faith_description: str = "",
    heroes: list[dict] | None = None,
    memories: list[dict] | None = None,
    statistics: dict | None = None,
) -> str:
    """Build the full HTML for a comprehensive journal book."""
    book_title = title or settings.journal_book_title
    book_author = author or settings.journal_book_author or "Anonymous"
    book_year = year or str(datetime.now().year)
    heroes = heroes or []
    memories = memories or []
    statistics = statistics or {}

    has_intro = bool(about_me or faith_label)
    has_heroes = bool(heroes)
    has_memories = bool(memories)
    has_stats = bool(statistics)

    # Build sections
    cover = _cover_page(book_title, book_author, book_year)
    ded = _dedication_page(dedication)
    toc = _table_of_contents(entries, has_intro, has_heroes, has_memories, has_stats)
    intro = _introduction_page(about_me, faith_label, faith_description)
    heroes_html = _heroes_page(heroes)

    entries_html = ""
    for i, e in enumerate(entries, 1):
        entries_html += _entry_to_html(e, i)

    memories_html = _memories_page(memories)
    stats_html = _statistics_page(statistics)
    colophon = _colophon()

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    /* ── Page Setup ── */
    @page {{
        size: 6in 9in;
        margin: 0.75in 0.85in;
        @bottom-center {{
            content: counter(page);
            font-size: 8pt;
            color: #aaa;
            font-family: 'Georgia', serif;
        }}
    }}
    @page :first {{
        @bottom-center {{ content: none; }}
    }}

    body {{
        font-family: 'Georgia', 'Times New Roman', serif;
        font-size: 11pt;
        line-height: 1.65;
        color: #1a1a1a;
        margin: 0;
        padding: 0;
    }}

    /* ── Cover ── */
    .cover {{
        text-align: center;
        padding-top: 2in;
        page-break-after: always;
    }}
    .cover-border {{
        border: 2px double #333;
        padding: 2em 1.5em;
        margin: 0 0.5in;
    }}
    .cover-ornament {{
        font-size: 24pt;
        color: #666;
        margin-bottom: 0.5em;
    }}
    .cover h1 {{
        font-size: 26pt;
        font-weight: normal;
        letter-spacing: 2px;
        margin: 0 0 0.15em 0;
        color: #1a1a1a;
    }}
    .cover-subtitle {{
        font-size: 11pt;
        font-style: italic;
        color: #666;
        letter-spacing: 1px;
        margin-bottom: 1em;
    }}
    .cover-rule {{
        width: 2in;
        height: 1px;
        background: #999;
        margin: 1em auto;
    }}
    .cover .author {{
        font-size: 13pt;
        color: #444;
        margin-bottom: 0.25em;
    }}
    .cover .year {{
        font-size: 11pt;
        color: #888;
    }}

    /* ── Dedication ── */
    .dedication {{
        text-align: center;
        padding-top: 2.5in;
        font-style: italic;
        font-size: 12pt;
        color: #444;
        line-height: 1.8;
    }}
    .dedication-ornament {{
        font-size: 16pt;
        color: #999;
        margin-bottom: 1em;
    }}

    /* ── Table of Contents ── */
    .toc {{
        padding-top: 0.5in;
    }}
    .section-title {{
        font-size: 18pt;
        font-weight: normal;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        border-bottom: 1px solid #ccc;
        padding-bottom: 0.3em;
        margin-bottom: 1em;
        color: #333;
    }}
    .toc-list {{
        margin-top: 1em;
    }}
    .toc-item {{
        display: flex;
        align-items: baseline;
        padding: 0.3em 0;
        border-bottom: 1px dotted #ddd;
        font-size: 10.5pt;
    }}
    .toc-chapter {{
        min-width: 2em;
        color: #888;
        font-size: 9pt;
    }}
    .toc-title {{
        flex: 1;
        color: #333;
    }}
    .toc-date {{
        color: #999;
        font-size: 9pt;
        margin-left: 1em;
        white-space: nowrap;
    }}

    /* ── Introduction ── */
    .introduction {{
        padding-top: 0.5in;
    }}
    .intro-section {{
        margin-bottom: 1.5em;
    }}
    .intro-section h3 {{
        font-size: 13pt;
        font-weight: normal;
        font-style: italic;
        color: #555;
        margin-bottom: 0.5em;
    }}
    .intro-section p {{
        text-align: justify;
        margin: 0 0 0.6em 0;
    }}
    .faith-label {{
        font-weight: bold;
        font-size: 12pt;
        color: #333;
    }}
    .faith-desc {{
        font-style: italic;
        color: #555;
    }}

    /* ── Heroes ── */
    .heroes-section {{
        padding-top: 0.5in;
    }}
    .heroes-intro {{
        font-style: italic;
        color: #666;
        margin-bottom: 1.5em;
        font-size: 10.5pt;
    }}
    .heroes-grid {{
        column-count: 2;
        column-gap: 1.5em;
    }}
    .hero-card {{
        break-inside: avoid;
        margin-bottom: 1em;
        padding: 0.6em 0;
        border-bottom: 1px solid #eee;
    }}
    .hero-name {{
        font-weight: bold;
        font-size: 10.5pt;
        color: #333;
        margin-bottom: 0.2em;
    }}
    .hero-desc {{
        font-size: 9pt;
        color: #666;
        line-height: 1.5;
    }}

    /* ── Journal Entries ── */
    .entry {{
        padding-top: 0.3in;
    }}
    .chapter-num {{
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: #aaa;
        margin-bottom: 0.2em;
    }}
    .entry-date {{
        font-size: 9pt;
        color: #888;
        letter-spacing: 1px;
        margin-bottom: 0.3em;
    }}
    .entry-title {{
        font-size: 16pt;
        font-weight: normal;
        margin: 0 0 0.6em 0;
        color: #1a1a1a;
    }}

    /* Mood */
    .mood {{
        background: #f8f6f3;
        border-left: 3px solid #c9a96e;
        padding: 0.6em 0.8em;
        margin-bottom: 1em;
        font-size: 10pt;
    }}
    .mood-header {{
        margin-bottom: 0.3em;
    }}
    .mood-weather {{
        font-weight: bold;
        color: #6b5b3e;
    }}
    .mood-sep {{
        color: #999;
        margin: 0 0.3em;
    }}
    .mood-desc {{
        color: #666;
        font-style: italic;
    }}
    .mood-energy {{
        font-size: 9pt;
        color: #888;
        letter-spacing: 1px;
    }}
    .mood-note {{
        font-size: 9.5pt;
        color: #555;
        font-style: italic;
        margin-top: 0.3em;
    }}

    /* Prompt */
    .prompt {{
        font-size: 10pt;
        color: #777;
        font-style: italic;
        margin-bottom: 1em;
        padding-left: 0.5em;
        border-left: 2px solid #ddd;
    }}
    .prompt-label {{
        font-weight: bold;
        font-style: normal;
        color: #999;
    }}

    /* Entry body */
    .entry-body {{
        text-align: justify;
    }}
    .entry-body p {{
        margin: 0 0 0.8em 0;
        text-indent: 1.5em;
    }}
    .entry-body p:first-child {{
        text-indent: 0;
    }}
    .entry-body img {{
        max-width: 100%;
        height: auto;
        display: block;
        margin: 1em auto;
        border: 1px solid #eee;
    }}
    .entry-body blockquote {{
        border-left: 3px solid #c9a96e;
        margin: 1em 0;
        padding: 0.5em 1em;
        color: #555;
        font-style: italic;
    }}
    .entry-body h1, .entry-body h2, .entry-body h3 {{
        font-weight: normal;
        color: #333;
    }}

    /* Photos gallery */
    .photos-gallery {{
        margin: 1.5em 0;
        text-align: center;
    }}
    .photo-item {{
        display: inline-block;
        margin: 0.5em;
        max-width: 90%;
    }}
    .photo-img {{
        max-width: 100%;
        max-height: 4in;
        border: 1px solid #ddd;
    }}
    .photo-caption {{
        font-size: 9pt;
        color: #888;
        font-style: italic;
        margin-top: 0.3em;
    }}

    /* Conversation */
    .conversation {{
        margin: 1.5em 0;
        padding: 0.8em;
        background: #fafaf8;
        border: 1px solid #e8e4dc;
        font-size: 10pt;
    }}
    .conv-header {{
        font-size: 10pt;
        font-weight: bold;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 0.8em;
        padding-bottom: 0.3em;
        border-bottom: 1px solid #e8e4dc;
    }}
    .conv-msg {{
        margin-bottom: 0.6em;
        line-height: 1.5;
    }}
    .msg-role {{
        font-weight: bold;
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}
    .msg-user .msg-role {{
        color: #5a7a5a;
    }}
    .msg-ai .msg-role {{
        color: #6b5b3e;
    }}
    .msg-ai {{
        padding-left: 1em;
        border-left: 2px solid #c9a96e;
    }}

    /* ── Memories / Insights ── */
    .memories-section {{
        padding-top: 0.5in;
    }}
    .memories-intro {{
        font-style: italic;
        color: #666;
        margin-bottom: 1.5em;
        font-size: 10.5pt;
    }}
    .memory-category {{
        margin-bottom: 1.5em;
    }}
    .memory-cat-title {{
        font-size: 12pt;
        font-weight: normal;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #6b5b3e;
        border-bottom: 1px solid #e8e4dc;
        padding-bottom: 0.2em;
        margin-bottom: 0.5em;
    }}
    .memory-item {{
        padding: 0.4em 0;
        border-bottom: 1px dotted #eee;
    }}
    .memory-content {{
        font-size: 10pt;
        color: #333;
    }}
    .memory-date {{
        font-size: 8pt;
        color: #aaa;
    }}

    /* ── Statistics ── */
    .statistics-section {{
        padding-top: 0.5in;
    }}
    .stats-grid {{
        display: flex;
        justify-content: space-around;
        margin: 1.5em 0;
    }}
    .stat-card {{
        text-align: center;
        padding: 1em;
    }}
    .stat-number {{
        font-size: 28pt;
        color: #6b5b3e;
        font-weight: bold;
        line-height: 1;
    }}
    .stat-label {{
        font-size: 9pt;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-top: 0.3em;
    }}
    .stats-range {{
        text-align: center;
        font-size: 10pt;
        color: #666;
        margin: 1em 0;
    }}
    .stats-moods {{
        margin-top: 1.5em;
    }}
    .stats-moods h3 {{
        font-size: 11pt;
        font-weight: normal;
        color: #555;
        margin-bottom: 0.8em;
    }}
    .stat-mood-row {{
        display: flex;
        align-items: center;
        margin-bottom: 0.4em;
    }}
    .stat-mood-label {{
        width: 120px;
        font-size: 9.5pt;
        color: #555;
    }}
    .stat-mood-bar {{
        height: 8px;
        background: #c9a96e;
        border-radius: 4px;
        margin: 0 0.5em;
    }}
    .stat-mood-count {{
        font-size: 9pt;
        color: #888;
    }}

    /* ── Colophon ── */
    .colophon {{
        text-align: center;
        padding-top: 3in;
        color: #999;
        font-size: 10pt;
    }}
    .colophon-ornament {{
        font-size: 20pt;
        color: #ccc;
        margin-bottom: 1em;
    }}
    .colophon-tagline {{
        font-style: italic;
        font-size: 9pt;
        color: #aaa;
        margin-top: 0.3em;
    }}
    .colophon-date {{
        font-size: 9pt;
        color: #bbb;
        margin-top: 0.5em;
    }}

    .page-break {{
        page-break-after: always;
    }}
</style>
</head>
<body>
    {cover}
    {ded}
    {toc}
    {intro}
    {heroes_html}
    {entries_html}
    {memories_html}
    {stats_html}
    {colophon}
</body>
</html>"""


async def generate_pdf(html_content: str, output_path: str) -> str:
    """Generate a PDF from HTML using WeasyPrint. Returns the file path."""
    from weasyprint import HTML

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    HTML(string=html_content).write_pdf(output_path)
    return output_path

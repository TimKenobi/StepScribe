"""
Export Service — Generate a StoryWorth-style journal book as PDF.
Collects entries for a date range, formats them with mood weather,
hero quotes, and personal reflections into a printable book.
"""
import os
from datetime import datetime
from io import BytesIO

import markdown
from app.config import settings


def _entry_to_html(entry: dict) -> str:
    """Convert a single journal entry to a styled HTML page."""
    mood_label = entry.get("mood_label", "")
    mood_desc = entry.get("mood_description", "")
    date_str = entry.get("date", "")
    title = entry.get("title", "Untitled")
    content_html = entry.get("content_html", "")

    mood_block = ""
    if mood_label:
        mood_block = f"""
        <div class="mood">
            <span class="mood-weather">{mood_label}</span>
            <span class="mood-desc"> — {mood_desc}</span>
        </div>"""

    return f"""
    <div class="entry">
        <div class="entry-date">{date_str}</div>
        <h2 class="entry-title">{title}</h2>
        {mood_block}
        <div class="entry-body">{content_html}</div>
    </div>
    <div class="page-break"></div>
    """


def build_journal_book_html(
    entries: list[dict],
    title: str | None = None,
    author: str | None = None,
    year: str | None = None,
    dedication: str = "",
) -> str:
    """Build the full HTML for a journal book."""
    book_title = title or settings.journal_book_title
    book_author = author or settings.journal_book_author or "Anonymous"
    book_year = year or str(datetime.now().year)

    entries_html = "\n".join(_entry_to_html(e) for e in entries)

    dedication_block = ""
    if dedication:
        dedication_block = f"""
        <div class="dedication">
            <p>{dedication}</p>
        </div>
        <div class="page-break"></div>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page {{
        size: 6in 9in;
        margin: 0.75in;
    }}
    body {{
        font-family: 'Georgia', 'Times New Roman', serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #1a1a1a;
    }}
    .cover {{
        text-align: center;
        padding-top: 3in;
        page-break-after: always;
    }}
    .cover h1 {{
        font-size: 28pt;
        font-weight: normal;
        letter-spacing: 2px;
        margin-bottom: 0.5in;
    }}
    .cover .author {{
        font-size: 14pt;
        color: #555;
        margin-bottom: 0.25in;
    }}
    .cover .year {{
        font-size: 12pt;
        color: #888;
    }}
    .dedication {{
        text-align: center;
        padding-top: 2in;
        font-style: italic;
        font-size: 12pt;
        color: #444;
    }}
    .entry {{
        margin-bottom: 1.5em;
    }}
    .entry-date {{
        font-size: 9pt;
        color: #888;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 0.25em;
    }}
    .entry-title {{
        font-size: 16pt;
        font-weight: normal;
        margin: 0 0 0.5em 0;
    }}
    .mood {{
        font-size: 10pt;
        color: #666;
        font-style: italic;
        margin-bottom: 1em;
        border-left: 2px solid #ccc;
        padding-left: 0.5em;
    }}
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
    .page-break {{
        page-break-after: always;
    }}
</style>
</head>
<body>
    <div class="cover">
        <h1>{book_title}</h1>
        <div class="author">{book_author}</div>
        <div class="year">{book_year}</div>
    </div>

    {dedication_block}

    {entries_html}
</body>
</html>"""


async def generate_pdf(html_content: str, output_path: str) -> str:
    """Generate a PDF from HTML using WeasyPrint. Returns the file path."""
    from weasyprint import HTML

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    HTML(string=html_content).write_pdf(output_path)
    return output_path

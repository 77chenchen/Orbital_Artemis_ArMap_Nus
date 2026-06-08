from __future__ import annotations

import textwrap
from pathlib import Path

from reportlab.lib.colors import Color, HexColor
from reportlab.lib.pagesizes import A1
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
OUT = ROOT / "atlas-artemis-m1-resubmission-poster.pdf"
BG = ROOT / "atlas-poster-bg-subtle.png"
TITLE = ROOT / "atlas-title-wordmark.png"
AUTH_SCREEN = REPO / "readme_assets" / "authentication-login-page.png"
MAP_SCREEN = REPO / "readme_assets" / "campus-map-screen.png"
MOBILE_SCREEN = REPO / "readme_assets" / "mobile-app-1.png"

PAGE_W, PAGE_H = A1
FONT_REG = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

for name, path in [
    ("ArialLocal", "/System/Library/Fonts/Supplemental/Arial.ttf"),
    ("ArialLocalBold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]:
    if Path(path).exists():
        pdfmetrics.registerFont(TTFont(name, path))
        if name.endswith("Bold"):
            FONT_BOLD = name
        else:
            FONT_REG = name


def color(value: str, alpha: float = 1) -> Color:
    c = HexColor(value)
    return Color(c.red, c.green, c.blue, alpha=alpha)


def wrap_text(c: canvas.Canvas, text: str, x: float, y: float, width: int, size=12, leading=16, fill="#dcecf3", font=None) -> float:
    c.setFont(font or FONT_REG, size)
    c.setFillColor(color(fill))
    for line in textwrap.wrap(text, width):
        c.drawString(x, y, line)
        y -= leading
    return y


def label(c: canvas.Canvas, x: float, y: float, text: str, size=11, fill="#90f4ff") -> None:
    c.setFont(FONT_BOLD, size)
    c.setFillColor(color(fill))
    c.drawString(x, y, text.upper())


def panel(c: canvas.Canvas, x: float, y: float, w: float, h: float, title: str, accent="#56e6ff", fill="#071725", alpha=0.74) -> None:
    c.saveState()
    c.setFillColor(color(fill, alpha))
    c.setStrokeColor(color(accent, 0.70))
    c.setLineWidth(1.2)
    c.roundRect(x, y, w, h, 16, fill=1, stroke=1)
    c.setStrokeColor(color("#ffffff", 0.12))
    c.roundRect(x + 7, y + 7, w - 14, h - 14, 12, fill=0, stroke=1)
    c.restoreState()
    c.setFont(FONT_BOLD, 28)
    c.setFillColor(color("#f8fdff"))
    c.drawString(x + 20, y + h - 38, title)
    c.setStrokeColor(color(accent, 0.92))
    c.setLineWidth(3)
    c.line(x + 20, y + h - 45, x + 108, y + h - 45)


def draw_bg(c: canvas.Canvas) -> None:
    c.setFillColor(color("#06111c"))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    if BG.exists():
        iw, ih = 1024, 1536
        scale = max(PAGE_W / iw, PAGE_H / ih)
        dw, dh = iw * scale, ih * scale
        c.drawImage(str(BG), (PAGE_W - dw) / 2, (PAGE_H - dh) / 2, dw, dh, preserveAspectRatio=True, mask="auto")
    c.setFillColor(color("#06111c", 0.20))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def draw_title(c: canvas.Canvas) -> None:
    x = 54
    y = PAGE_H - 78
    c.setFillColor(color("#06111c", 0.50))
    c.roundRect(38, PAGE_H - 284, PAGE_W - 76, 224, 24, fill=1, stroke=0)
    label(c, x + 590, y, "Orbital 2026 | Artemis M1 Resubmission | Team Atlas", 16, "#8ff5ff")
    if TITLE.exists():
        c.drawImage(str(TITLE), x - 8, PAGE_H - 248, 560, 220, preserveAspectRatio=True, mask="auto")
    else:
        c.setFont(FONT_BOLD, 76)
        c.setFillColor(color("#f8fdff"))
        c.drawString(x, PAGE_H - 178, "ATLAS")
    c.setFont(FONT_BOLD, 36)
    c.setFillColor(color("#ffd276"))
    c.drawString(x + 590, PAGE_H - 150, "AR CAMPUS")
    c.setFillColor(color("#8ff5ff"))
    c.drawString(x + 590, PAGE_H - 188, "ASSISTANT")
    c.setFont(FONT_REG, 20)
    c.setFillColor(color("#d7ecf5"))
    c.drawString(x, PAGE_H - 302, "Campus navigation from outdoor routes to indoor facilities, schedules, shuttle context, and future AR guidance.")
    c.setStrokeColor(color("#56e6ff", 0.90))
    c.setLineWidth(3)
    c.line(x, PAGE_H - 270, x + 710, PAGE_H - 270)
    c.setFillColor(color("#ffb85c"))
    c.circle(x + 728, PAGE_H - 270, 8, fill=1, stroke=0)


LEFT = 46
GAP = 28
COL_W = 512
COL2_X = LEFT + COL_W + GAP
ROW1_Y, ROW1_H = 1538, 452
ROW2_Y, ROW2_H = 1020, 492
ROW3_Y, ROW3_H = 540, 454
ROW4_Y, ROW4_H = 54, 460


def draw_bullet(c: canvas.Canvas, x: float, y: float, text: str, width: int, size=15, leading=19) -> float:
    c.setFillColor(color("#83f2c6"))
    c.circle(x, y + 5, 4.5, fill=1, stroke=0)
    return wrap_text(c, text, x + 18, y, width, size, leading, "#dcecf3")


def draw_problem(c: canvas.Canvas) -> None:
    panel(c, LEFT, ROW1_Y, COL_W, ROW1_H, "Problem")
    x = LEFT + 26
    y = ROW1_Y + ROW1_H - 74
    y = wrap_text(
        c,
        "NUS students can reach a building but still lose time finding rooms, lifts, restrooms, printers, study spaces, and shuttle connections.",
        x,
        y,
        43,
        17,
        22,
    )
    y -= 18
    label(c, x, y, "Milestone 1 coverage", 14, "#ffd276")
    y -= 28
    for item in [
        "20 user stories across navigation, access, safety, transport, campus life, and community updates.",
        "10 ideated features, including AR guidance, facility search, schedules, bus context, and map corrections.",
        "Project-level SWE: GitHub planning, tests, CI/CD, deployment, diagrams, and walkthrough evidence.",
    ]:
        y = draw_bullet(c, x + 8, y, item, 43, 15, 19) - 9


def draw_features(c: canvas.Canvas) -> None:
    panel(c, COL2_X, ROW1_Y, COL_W, ROW1_H, "Core Features", accent="#ffd276")
    features = [
        ("Auth", "email, demo, Google Sign-In, JWT"),
        ("Map", "MapLibre campus rendering"),
        ("Search", "place lookup and route tracing"),
        ("Assistant", "schedule-aware recommendations"),
        ("Facilities", "rooms, lifts, printers, study spaces"),
        ("Schedule", "create, view, delete items"),
        ("NUSMods", "sync trigger and status"),
        ("Bus", "routes, stops, live arrivals"),
        ("Mobile", "responsive web and iOS shell"),
        ("SWE", "issues, tests, CI/CD, deploy"),
    ]
    start_x = COL2_X + 30
    start_y = ROW1_Y + ROW1_H - 92
    card_w = 222
    card_h = 54
    row_gap = 16
    for i, (title, body) in enumerate(features):
        x = start_x + (i % 2) * (card_w + 28)
        y = start_y - (i // 2) * (card_h + row_gap)
        c.setFillColor(color("#0d384a", 0.88))
        c.setStrokeColor(color("#56e6ff", 0.62))
        c.roundRect(x, y - card_h, card_w, card_h, 10, fill=1, stroke=1)
        c.setFillColor(color("#ffd276" if i % 2 else "#83f2c6"))
        c.circle(x + 21, y - 26, 12, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 11)
        c.setFillColor(color("#07131f"))
        c.drawCentredString(x + 21, y - 30, str(i + 1))
        c.setFont(FONT_BOLD, 16)
        c.setFillColor(color("#f8fdff"))
        c.drawString(x + 43, y - 20, title)
        c.setFont(FONT_REG, 12)
        c.setFillColor(color("#cfe5ed"))
        c.drawString(x + 43, y - 38, body)


def draw_architecture(c: canvas.Canvas) -> None:
    panel(c, LEFT, ROW2_Y, COL_W, ROW2_H, "Architecture", accent="#83f2c6")
    x = LEFT + 30

    def node(nx, ny, w, h, title, body, accent="#56e6ff"):
        c.setFillColor(color("#0b2d3e", 0.9))
        c.setStrokeColor(color(accent, 0.86))
        c.roundRect(nx, ny, w, h, 12, fill=1, stroke=1)
        c.setFont(FONT_BOLD, 15)
        c.setFillColor(color("#f8fdff"))
        c.drawCentredString(nx + w / 2, ny + h - 19, title)
        c.setFont(FONT_REG, 11)
        c.setFillColor(color("#cfe5ed"))
        for idx, line in enumerate(textwrap.wrap(body, 18)):
            c.drawCentredString(nx + w / 2, ny + h - 38 - idx * 13, line)

    def arrow(x1, y1, x2, y2):
        c.setStrokeColor(color("#ffb85c", 0.9))
        c.setLineWidth(2)
        c.line(x1, y1, x2, y2)
        c.setFillColor(color("#ffb85c"))
        c.circle(x2, y2, 3.8, fill=1, stroke=0)

    top_y = ROW2_Y + 260
    mid_y = ROW2_Y + 150
    bot_y = ROW2_Y + 58
    node(x, top_y, 118, 62, "User", "web / mobile student")
    node(x + 172, top_y, 138, 62, "Frontend", "React dashboard and map")
    node(x + 362, top_y, 116, 62, "Go API", "JWT and campus APIs")
    node(x, mid_y, 118, 62, "Map", "search and route tracing")
    node(x + 172, mid_y, 138, 62, "Assistant", "schedule plus context")
    node(x + 362, mid_y, 116, 62, "SQLite", "users and facilities", "#83f2c6")
    node(x + 362, bot_y, 116, 58, "External", "Google, OSM, NUSMods, bus", "#ffd276")
    arrow(x + 118, top_y + 31, x + 172, top_y + 31)
    arrow(x + 310, top_y + 31, x + 362, top_y + 31)
    arrow(x + 420, top_y, x + 420, mid_y + 62)
    arrow(x + 70, top_y, x + 70, mid_y + 62)
    arrow(x + 242, top_y, x + 242, mid_y + 62)
    arrow(x + 420, mid_y, x + 420, bot_y + 58)
    wrap_text(
        c,
        "Layered design separates UI, protected API, data, and external campus services.",
        x,
        ROW2_Y + 46,
        48,
        15,
        19,
    )


def draw_standard_diagrams(c: canvas.Canvas) -> None:
    panel(c, COL2_X, ROW2_Y, COL_W, ROW2_H, "Standard Diagrams", accent="#ffb85c")
    rows = [
        ("Sequence", "Login -> backend verification -> JWT -> protected dashboard."),
        ("Activity", "Search location -> select place -> center map -> draw route."),
        ("ER", "users, buildings, facilities, schedule_items, sync_status."),
        ("Architecture", "frontend, backend, database, external campus services."),
    ]
    x = COL2_X + 30
    y = ROW2_Y + ROW2_H - 92
    for idx, (title, body) in enumerate(rows, 1):
        c.setFillColor(color("#0d384a", 0.88))
        c.roundRect(x, y - 62, COL_W - 60, 68, 12, fill=1, stroke=0)
        c.setFillColor(color("#ffb85c"))
        c.circle(x + 24, y - 28, 13, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 12)
        c.setFillColor(color("#07131f"))
        c.drawCentredString(x + 24, y - 32, str(idx))
        c.setFont(FONT_BOLD, 17)
        c.setFillColor(color("#f8fdff"))
        c.drawString(x + 54, y - 17, title)
        wrap_text(c, body, x + 54, y - 39, 43, 13.5, 16, "#cfe5ed")
        y -= 82


def draw_screens(c: canvas.Canvas) -> None:
    panel(c, LEFT, ROW3_Y, COL_W, ROW3_H, "Prototype Screens", accent="#56e6ff")
    x = LEFT + 26
    shot_y = ROW3_Y + 168
    shots = [
        (AUTH_SCREEN, x, shot_y, 124, 132, "Auth"),
        (MAP_SCREEN, x + 142, shot_y, 236, 132, "Map"),
        (MOBILE_SCREEN, x + 398, shot_y, 58, 132, "Mobile"),
    ]
    for path, sx, sy, sw, sh, title in shots:
        c.setFillColor(color("#0b2d3e", 0.9))
        c.roundRect(sx - 8, sy - 24, sw + 16, sh + 56, 12, fill=1, stroke=0)
        if path.exists():
            c.drawImage(str(path), sx, sy, sw, sh, preserveAspectRatio=True, mask="auto")
        c.setFont(FONT_BOLD, 13)
        c.setFillColor(color("#ffd276"))
        c.drawCentredString(sx + sw / 2, sy - 12, title)
    wrap_text(
        c,
        "The walkthrough demonstrates login, protected dashboard access, schedule context, facility filtering, responsive layout, and campus map interaction.",
        x,
        ROW3_Y + 118,
        54,
        16,
        20,
    )


def draw_testing_cicd(c: canvas.Canvas) -> None:
    panel(c, COL2_X, ROW3_Y, COL_W, ROW3_H, "Testing and CI/CD", accent="#83f2c6")
    checks = [
        ("Backend", "cd backend && go test ./..."),
        ("Frontend", "cd frontend && npm run build"),
        ("iOS shell", "npm run ios:sync"),
        ("Deploy", "docker compose up -d --build"),
    ]
    x = COL2_X + 30
    y = ROW3_Y + ROW3_H - 94
    for title, cmd in checks:
        c.setFillColor(color("#0d384a", 0.88))
        c.roundRect(x, y - 45, COL_W - 60, 52, 12, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 15)
        c.setFillColor(color("#83f2c6"))
        c.drawString(x + 18, y - 15, title)
        c.setFont(FONT_REG, 12.5)
        c.setFillColor(color("#dcecf3"))
        c.drawString(x + 130, y - 15, cmd)
        y -= 64
    label(c, x, y - 2, "Pipeline gates", 14, "#ffd276")
    wrap_text(
        c,
        "GitHub Actions plan: checkout, npm ci, frontend build, Go tests, Docker build, then deployment validation on Render.",
        x,
        y - 28,
        45,
        15,
        19,
        "#dcecf3",
    )


def draw_bottom(c: canvas.Canvas) -> None:
    panel(c, LEFT, ROW4_Y, COL_W, ROW4_H, "User Story Coverage", accent="#ffd276")
    story_groups = [
        ("Navigation", "AR map, indoor guidance, travel time, saved locations."),
        ("Campus Life", "study spaces, events, printing, less crowded facilities."),
        ("Access", "wheelchair-friendly routes, lifts, accessible entrances."),
        ("Transport", "nearby shuttle stops, routes, arrivals, bus context."),
        ("Safety", "emergency exits, first-aid points, security offices."),
        ("Community", "student corrections and admin review."),
    ]
    x = LEFT + 28
    y = ROW4_Y + ROW4_H - 94
    for title, body in story_groups:
        c.setFont(FONT_BOLD, 15)
        c.setFillColor(color("#f8fdff"))
        c.drawString(x, y, title)
        wrap_text(c, body, x + 132, y, 37, 13.5, 16, "#cfe5ed")
        y -= 56

    panel(c, COL2_X, ROW4_Y, COL_W, ROW4_H, "Walkthrough and Links", accent="#56e6ff")
    steps = [
        "Open deployed app and login through demo/auth flow.",
        "Show dashboard, schedule, recommendations, and facility filters.",
        "Show map rendering, search interaction, and route tracing.",
        "Explain repo logs, tests, CI/CD plan, and deployment setup.",
    ]
    x = COL2_X + 30
    y = ROW4_Y + ROW4_H - 96
    for idx, step in enumerate(steps, 1):
        c.setFillColor(color("#56e6ff" if idx % 2 else "#ffb85c"))
        c.circle(x + 14, y + 5, 12, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 12)
        c.setFillColor(color("#07131f"))
        c.drawCentredString(x + 14, y + 1, str(idx))
        y = wrap_text(c, step, x + 42, y, 42, 15, 19, "#dcecf3") - 18
    c.setFont(FONT_BOLD, 16)
    c.setFillColor(color("#ffd276"))
    c.drawString(x, ROW4_Y + 82, "App: orbital-artemis-armap-nus.onrender.com")
    c.drawString(x, ROW4_Y + 56, "GitHub: 77chenchen/Orbital_Artemis_ArMap_Nus")
    c.setFont(FONT_REG, 12.5)
    c.setFillColor(color("#b9d8e3"))
    c.drawRightString(COL2_X + COL_W - 26, ROW4_Y + 28, "Poster regenerated from current readme.tex content")


def main() -> None:
    c = canvas.Canvas(str(OUT), pagesize=A1)
    draw_bg(c)
    draw_title(c)
    draw_problem(c)
    draw_features(c)
    draw_architecture(c)
    draw_standard_diagrams(c)
    draw_screens(c)
    draw_testing_cicd(c)
    draw_bottom(c)
    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()

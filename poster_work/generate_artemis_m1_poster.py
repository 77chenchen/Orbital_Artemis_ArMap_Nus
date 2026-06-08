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
    c.setFont(FONT_BOLD, 22)
    c.setFillColor(color("#f8fdff"))
    c.drawString(x + 20, y + h - 34, title)
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
    label(c, x + 590, y, "Orbital 2026 | Artemis M1 Resubmission | Team Atlas", 14, "#8ff5ff")
    if TITLE.exists():
        c.drawImage(str(TITLE), x - 8, PAGE_H - 248, 560, 220, preserveAspectRatio=True, mask="auto")
    else:
        c.setFont(FONT_BOLD, 76)
        c.setFillColor(color("#f8fdff"))
        c.drawString(x, PAGE_H - 178, "ATLAS")
    c.setFont(FONT_BOLD, 30)
    c.setFillColor(color("#ffd276"))
    c.drawString(x + 590, PAGE_H - 150, "AR CAMPUS")
    c.setFillColor(color("#8ff5ff"))
    c.drawString(x + 590, PAGE_H - 188, "ASSISTANT")
    c.setFont(FONT_REG, 17)
    c.setFillColor(color("#d7ecf5"))
    c.drawString(x, PAGE_H - 302, "Campus navigation from outdoor routes to indoor facilities, schedules, shuttle context, and future AR guidance.")
    c.setStrokeColor(color("#56e6ff", 0.90))
    c.setLineWidth(3)
    c.line(x, PAGE_H - 270, x + 710, PAGE_H - 270)
    c.setFillColor(color("#ffb85c"))
    c.circle(x + 728, PAGE_H - 270, 8, fill=1, stroke=0)


def draw_problem(c: canvas.Canvas) -> None:
    panel(c, 46, 1646, 360, 346, "Problem")
    y = 1930
    y = wrap_text(c, "NUS students often reach the correct building but still struggle to find classrooms, lifts, restrooms, printers, study spaces, and shuttle connections.", 68, y, 43, 12.5, 17)
    label(c, 68, y - 10, "Milestone 1 scope", 10.5, "#ffd276")
    y -= 34
    bullets = [
        "20 user stories covering students, visitors, accessibility, transport, safety, and map updates.",
        "10 ideated product and engineering features.",
        "Full-stack prototype: React frontend, Go backend, SQLite data, JWT auth, deployment.",
    ]
    for item in bullets:
        c.setFillColor(color("#83f2c6"))
        c.circle(76, y + 4, 4, fill=1, stroke=0)
        y = wrap_text(c, item, 90, y, 41, 10.8, 14, "#dcecf3")
        y -= 8


def draw_features(c: canvas.Canvas) -> None:
    panel(c, 426, 1646, 660, 346, "Core Features", accent="#ffd276")
    features = [
        ("Auth", "email, demo, Google Sign-In, JWT"),
        ("Map", "MapLibre campus rendering"),
        ("Search", "place lookup and route tracing"),
        ("Assistant", "schedule-aware recommendations"),
        ("Facilities", "buildings, rooms, lifts, printers"),
        ("Schedule", "view, create, delete items"),
        ("NUSMods", "sync status and trigger"),
        ("Bus", "stops, arrivals, active vehicles"),
        ("Mobile", "responsive web and iOS shell"),
        ("SWE", "issues, branches, CI/CD, tests"),
    ]
    for i, (title, body) in enumerate(features):
        x = 450 + (i % 2) * 312
        y = 1896 - (i // 2) * 52
        c.setFillColor(color("#0d384a", 0.86))
        c.setStrokeColor(color("#56e6ff", 0.52))
        c.roundRect(x, y - 36, 278, 40, 10, fill=1, stroke=1)
        c.setFillColor(color("#ffd276" if i % 2 else "#83f2c6"))
        c.circle(x + 18, y - 16, 10, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 9.5)
        c.setFillColor(color("#07131f"))
        c.drawCentredString(x + 18, y - 20, str(i + 1))
        c.setFont(FONT_BOLD, 12.3)
        c.setFillColor(color("#f8fdff"))
        c.drawString(x + 34, y - 10, title)
        c.setFont(FONT_REG, 9.6)
        c.setFillColor(color("#cfe5ed"))
        c.drawString(x + 34, y - 25, body)


def draw_architecture(c: canvas.Canvas) -> None:
    panel(c, 46, 1168, 618, 426, "Architecture", accent="#83f2c6")

    def node(x, y, w, h, title, body, accent="#56e6ff"):
        c.setFillColor(color("#0b2d3e", 0.88))
        c.setStrokeColor(color(accent, 0.82))
        c.roundRect(x, y, w, h, 13, fill=1, stroke=1)
        c.setFont(FONT_BOLD, 12)
        c.setFillColor(color("#f8fdff"))
        c.drawCentredString(x + w / 2, y + h - 18, title)
        c.setFont(FONT_REG, 8.6)
        c.setFillColor(color("#cfe5ed"))
        for idx, line in enumerate(textwrap.wrap(body, 24)):
            c.drawCentredString(x + w / 2, y + h - 34 - idx * 11, line)

    def arrow(x1, y1, x2, y2):
        c.setStrokeColor(color("#ffb85c", 0.88))
        c.setLineWidth(1.8)
        c.line(x1, y1, x2, y2)
        c.setFillColor(color("#ffb85c"))
        c.circle(x2, y2, 3.4, fill=1, stroke=0)

    node(82, 1448, 130, 62, "User", "Web / mobile student")
    node(274, 1448, 150, 62, "React Frontend", "auth, dashboard, map")
    node(486, 1448, 130, 62, "Go API", "JWT and campus APIs")
    node(486, 1318, 130, 62, "SQLite", "users, facilities, schedule", "#83f2c6")
    node(82, 1318, 130, 62, "Map Layer", "search and route tracing")
    node(274, 1318, 150, 62, "Assistant", "schedule + context")
    node(486, 1218, 130, 58, "External", "Google, OSM, NUSMods, bus", "#ffd276")
    arrow(212, 1479, 274, 1479)
    arrow(424, 1479, 486, 1479)
    arrow(551, 1448, 551, 1380)
    arrow(274, 1448, 212, 1362)
    arrow(349, 1448, 349, 1380)
    arrow(486, 1448, 424, 1362)
    arrow(551, 1318, 551, 1276)
    wrap_text(c, "System-level architecture is intentionally separated into UI, protected API, persistent data, and external service boundaries.", 76, 1262, 68, 11, 15, "#dcecf3")


def draw_standard_diagrams(c: canvas.Canvas) -> None:
    panel(c, 688, 1168, 398, 426, "Standard Diagrams", accent="#ffb85c")
    rows = [
        ("Sequence", "Login -> backend verification -> JWT -> protected dashboard."),
        ("Activity", "Search location -> select place -> center map -> draw route."),
        ("ER", "users, buildings, facilities, schedule items, sync status."),
        ("Architecture", "frontend, backend, database, external campus services."),
    ]
    y = 1506
    for idx, (title, body) in enumerate(rows, 1):
        c.setFillColor(color("#0d384a", 0.86))
        c.roundRect(718, y - 60, 338, 66, 12, fill=1, stroke=0)
        c.setFillColor(color("#ffb85c"))
        c.circle(742, y - 26, 13, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 11)
        c.setFillColor(color("#07131f"))
        c.drawCentredString(742, y - 30, str(idx))
        c.setFont(FONT_BOLD, 13.5)
        c.setFillColor(color("#f8fdff"))
        c.drawString(766, y - 15, title)
        wrap_text(c, body, 766, y - 34, 42, 9.4, 12, "#cfe5ed")
        y -= 82


def draw_screens(c: canvas.Canvas) -> None:
    panel(c, 46, 734, 618, 388, "Prototype Screens", accent="#56e6ff")
    shots = [
        (AUTH_SCREEN, 74, 812, 168, 154, "Authentication"),
        (MAP_SCREEN, 260, 812, 266, 154, "Campus Map"),
        (MOBILE_SCREEN, 548, 812, 74, 154, "Mobile"),
    ]
    for path, x, y, w, h, title in shots:
        c.setFillColor(color("#0b2d3e", 0.88))
        c.roundRect(x - 8, y - 22, w + 16, h + 52, 12, fill=1, stroke=0)
        if path.exists():
            c.drawImage(str(path), x, y, w, h, preserveAspectRatio=True, mask="auto")
        c.setFont(FONT_BOLD, 10.5)
        c.setFillColor(color("#ffd276"))
        c.drawCentredString(x + w / 2, y - 10, title)
    wrap_text(c, "The demo flow shows login, protected dashboard access, schedule context, facility filtering, responsive mobile layout, and campus map interaction.", 74, 778, 77, 11.5, 15, "#dcecf3")


def draw_testing_cicd(c: canvas.Canvas) -> None:
    panel(c, 688, 734, 398, 388, "Testing and CI/CD", accent="#83f2c6")
    checks = [
        ("Backend", "cd backend && go test ./..."),
        ("Frontend", "cd frontend && npm run build"),
        ("iOS shell", "npm run ios:sync"),
        ("Deploy", "docker compose up -d --build"),
    ]
    y = 1038
    for title, cmd in checks:
        c.setFillColor(color("#0d384a", 0.86))
        c.roundRect(718, y - 45, 338, 50, 12, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 12)
        c.setFillColor(color("#83f2c6"))
        c.drawString(738, y - 13, title)
        c.setFont(FONT_REG, 9.4)
        c.setFillColor(color("#dcecf3"))
        c.drawString(820, y - 13, cmd)
        y -= 58
    label(c, 718, y - 8, "Pipeline gates", 10.5, "#ffd276")
    wrap_text(c, "GitHub Actions plan: checkout, npm ci, frontend build, Go tests, Docker build, then deployment validation on the hosted Render app.", 718, y - 30, 45, 10.5, 14, "#dcecf3")


def draw_bottom(c: canvas.Canvas) -> None:
    panel(c, 46, 230, 512, 398, "User Story Coverage", accent="#ffd276")
    story_groups = [
        ("Navigation", "AR map, indoor guidance, travel time, saved locations."),
        ("Campus Life", "study spaces, events, printing, less crowded facilities."),
        ("Access", "wheelchair-friendly routes, lifts, accessible entrances."),
        ("Transport", "nearby shuttle stops, routes, arrivals, bus context."),
        ("Safety", "emergency exits, first-aid points, security offices."),
        ("Community", "student corrections and administrator review."),
    ]
    y = 540
    for title, body in story_groups:
        c.setFont(FONT_BOLD, 11.5)
        c.setFillColor(color("#f8fdff"))
        c.drawString(74, y, title)
        wrap_text(c, body, 176, y, 43, 9.7, 12, "#cfe5ed")
        y -= 48

    panel(c, 582, 230, 504, 398, "Walkthrough and Links", accent="#56e6ff")
    y = 540
    steps = [
        "Open deployed app and login through demo/auth flow.",
        "Show protected dashboard, schedule, recommendations, and facility filters.",
        "Show map rendering, search-oriented interaction, and route tracing.",
        "Explain repo logs, testing commands, CI/CD plan, and deployment setup.",
    ]
    for idx, step in enumerate(steps, 1):
        c.setFillColor(color("#56e6ff" if idx % 2 else "#ffb85c"))
        c.circle(610, y + 4, 10, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 9)
        c.setFillColor(color("#07131f"))
        c.drawCentredString(610, y + 1, str(idx))
        y = wrap_text(c, step, 632, y, 48, 10.2, 13, "#dcecf3")
        y -= 20
    c.setFont(FONT_BOLD, 13)
    c.setFillColor(color("#ffd276"))
    c.drawString(610, 314, "App: orbital-artemis-armap-nus.onrender.com")
    c.drawString(610, 292, "GitHub: 77chenchen/Orbital_Artemis_ArMap_Nus")
    c.setFont(FONT_REG, 10)
    c.setFillColor(color("#b9d8e3"))
    c.drawRightString(1058, 254, "Poster regenerated from current readme.tex content")


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

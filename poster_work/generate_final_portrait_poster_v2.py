from __future__ import annotations

import math
import textwrap
from pathlib import Path

from reportlab.lib.colors import HexColor, Color, white
from reportlab.lib.pagesizes import A1
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
BG = ROOT / "atlas-poster-bg-subtle.png"
TITLE = ROOT / "atlas-title-wordmark.png"
OUT = ROOT / "atlas-final-project-poster-v2.pdf"

PAGE_W, PAGE_H = A1  # portrait, points

FONT_REG = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

for name, path in [
    ("Inter", "/System/Library/Fonts/Supplemental/Arial.ttf"),
    ("InterBold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
]:
    if Path(path).exists():
        pdfmetrics.registerFont(TTFont(name, path))
        if name == "Inter":
            FONT_REG = name
        else:
            FONT_BOLD = name


def hex_color(value: str, alpha: float = 1) -> Color:
    c = HexColor(value)
    return Color(c.red, c.green, c.blue, alpha=alpha)


def rounded_panel(c: canvas.Canvas, x, y, w, h, title=None, accent="#56e6ff", fill="#071725", alpha=0.72):
    c.saveState()
    c.setFillColor(hex_color(fill, alpha))
    c.setStrokeColor(hex_color(accent, 0.72))
    c.setLineWidth(1.3)
    c.roundRect(x, y, w, h, 18, fill=1, stroke=1)
    c.setStrokeColor(hex_color("#9df6ff", 0.38))
    c.setLineWidth(0.55)
    c.roundRect(x + 8, y + 8, w - 16, h - 16, 13, fill=0, stroke=1)
    c.restoreState()
    if title:
        c.setFont(FONT_BOLD, 27)
        c.setFillColor(hex_color("#f8fdff"))
        c.drawString(x + 26, y + h - 44, title)
        c.setStrokeColor(hex_color(accent, 0.88))
        c.setLineWidth(4)
        c.line(x + 26, y + h - 56, x + 122, y + h - 56)


def wrap(c, text, x, y, width_chars, size=14.5, leading=20, color="#dcecf3", font=FONT_REG):
    c.setFont(font, size)
    c.setFillColor(hex_color(color))
    for line in textwrap.wrap(text, width_chars):
        c.drawString(x, y, line)
        y -= leading
    return y


def label(c, x, y, text, size=12, color="#90f4ff"):
    c.setFont(FONT_BOLD, size)
    c.setFillColor(hex_color(color))
    c.drawString(x, y, text.upper())


def draw_bg(c):
    # Fill A1 portrait by cropping the portrait image slightly.
    iw, ih = 1024, 1536
    scale = max(PAGE_W / iw, PAGE_H / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(str(BG), (PAGE_W - dw) / 2, (PAGE_H - dh) / 2, dw, dh, preserveAspectRatio=True, mask="auto")
    c.saveState()
    c.setFillColor(hex_color("#03111d", 0.10))
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.restoreState()


def draw_title(c):
    x = 66
    y = PAGE_H - 86
    c.saveState()
    c.setFillColor(hex_color("#05101c", 0.34))
    c.roundRect(46, PAGE_H - 306, PAGE_W - 92, 238, 28, fill=1, stroke=0)
    c.restoreState()

    label(c, x + 612, y, "Orbital 26 · Artemis · Team Atlas", 17, "#8ff5ff")
    c.drawImage(str(TITLE), x - 12, PAGE_H - 268, 610, 244, preserveAspectRatio=True, mask="auto")
    c.setFont(FONT_BOLD, 34)
    c.setFillColor(hex_color("#ffd276"))
    c.drawString(x + 620, PAGE_H - 162, "AR CAMPUS")
    c.setFillColor(hex_color("#8ff5ff"))
    c.drawString(x + 620, PAGE_H - 204, "ASSISTANT")

    # Designed underline and route dot.
    c.setStrokeColor(hex_color("#56e6ff", 0.92))
    c.setLineWidth(4)
    c.line(x, PAGE_H - 282, x + 742, PAGE_H - 282)
    c.setFillColor(hex_color("#ffb85c"))
    c.circle(x + 764, PAGE_H - 282, 9, fill=1, stroke=0)
    c.setFont(FONT_REG, 20)
    c.setFillColor(hex_color("#d7ecf5"))
    c.drawString(x, PAGE_H - 326, "Context-aware wayfinding from campus routes to indoor facilities.")


def draw_overview(c):
    rounded_panel(c, 62, 1620, 650, 390, "Overview")
    y = 1938
    y = wrap(
        c,
        "Atlas helps NUS students move beyond ordinary map search. It combines campus points, indoor facilities, schedules, and recommendation logic so the app can suggest where to go next and what facility is useful nearby.",
        92,
        y,
        65,
        16,
        23,
    )
    c.setFont(FONT_BOLD, 19)
    c.setFillColor(hex_color("#ffd276"))
    c.drawString(92, y - 10, "Core idea")
    y -= 42
    for i, text in enumerate(["Outdoor route", "Indoor facility", "Schedule context", "Daily guidance"]):
        bx = 92 + (i % 2) * 285
        by = y - 76 - (i // 2) * 88
        c.setFillColor(hex_color("#0e5264", 0.88))
        c.setStrokeColor(hex_color("#66efff", 0.82))
        c.roundRect(bx, by, 250, 60, 12, fill=1, stroke=1)
        c.setFont(FONT_BOLD, 15)
        c.setFillColor(hex_color("#f8fdff"))
        c.drawCentredString(bx + 125, by + 22, text)


def draw_features(c):
    rounded_panel(c, 62, 1084, 650, 520, "Features")
    items = [
        ("AR Wayfinding", "Route lines, waypoints, and future AR overlays guide students through buildings."),
        ("Facility Discovery", "Find study spaces, restrooms, lifts, and printing points by building and type."),
        ("Daily Agent", "Schedule-aware recommendations surface the next useful campus action."),
        ("NUSMods Sync", "External module data integration keeps the system extensible."),
        ("Protected Demo Flow", "Login and JWT-protected routes model a realistic user journey."),
    ]
    y = 1510
    for idx, (title, body) in enumerate(items, 1):
        c.setFillColor(hex_color("#0b2d3e", 0.78))
        c.roundRect(92, y - 62, 590, 70, 14, fill=1, stroke=0)
        c.setStrokeColor(hex_color("#49e2ff", 0.72))
        c.setLineWidth(1)
        c.roundRect(92, y - 62, 590, 70, 14, fill=0, stroke=1)
        c.setFillColor(hex_color("#83f2c6"))
        c.circle(122, y - 26, 15, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 14)
        c.setFillColor(hex_color("#07131f"))
        c.drawCentredString(122, y - 31, str(idx))
        c.setFont(FONT_BOLD, 18)
        c.setFillColor(hex_color("#f8fdff"))
        c.drawString(152, y - 16, title)
        wrap(c, body, 152, y - 40, 62, 12.8, 16, "#cfe5ed")
        y -= 82


def draw_pipeline(c):
    rounded_panel(c, 742, 1334, 382, 514, "System Flow", accent="#ffd276")

    def node(x, y, w, h, title, subtitle="", fill="#0d384a", accent="#56e6ff"):
        c.setFillColor(hex_color(fill, 0.86))
        c.setStrokeColor(hex_color(accent, 0.85))
        c.setLineWidth(1.4)
        c.roundRect(x, y, w, h, 14, fill=1, stroke=1)
        c.setFont(FONT_BOLD, 13.5)
        c.setFillColor(hex_color("#f8fdff"))
        c.drawCentredString(x + w / 2, y + h - 22, title)
        if subtitle:
            c.setFont(FONT_REG, 9.8)
            c.setFillColor(hex_color("#cfe5ed"))
            for i, line in enumerate(textwrap.wrap(subtitle, 22)):
                c.drawCentredString(x + w / 2, y + h - 39 - i * 12, line)

    def arrow(x1, y1, x2, y2, color="#ffb85c"):
        c.setStrokeColor(hex_color(color, 0.86))
        c.setFillColor(hex_color(color, 0.86))
        c.setLineWidth(2.0)
        c.line(x1, y1, x2, y2)
        ang = math.atan2(y2 - y1, x2 - x1)
        size = 6
        p = c.beginPath()
        p.moveTo(x2, y2)
        p.lineTo(x2 - size * math.cos(ang - 0.45), y2 - size * math.sin(ang - 0.45))
        p.lineTo(x2 - size * math.cos(ang + 0.45), y2 - size * math.sin(ang + 0.45))
        p.close()
        c.drawPath(p, fill=1, stroke=0)

    # Three-lane architecture diagram.
    label(c, 780, 1784, "Frontend", 10.5, "#83f2c6")
    node(776, 1718, 138, 52, "Login", "JWT token")
    node(956, 1718, 138, 52, "Dashboard", "map, filters, schedule")
    arrow(914, 1744, 956, 1744, "#83f2c6")

    label(c, 780, 1670, "Backend API", 10.5, "#ffd276")
    node(776, 1600, 138, 58, "Protected Routes", "buildings, facilities, schedule")
    node(956, 1600, 138, 58, "Recommendation", "next class + nearby facilities")
    arrow(1025, 1718, 1025, 1658)
    arrow(845, 1718, 845, 1658)

    label(c, 780, 1548, "Data Layer", 10.5, "#8ff5ff")
    node(776, 1476, 138, 58, "SQLite Store", "campus + user data")
    node(956, 1476, 138, 58, "NUSMods Sync", "external module data")
    arrow(845, 1600, 845, 1534)
    arrow(1025, 1600, 1025, 1534)
    arrow(914, 1505, 956, 1505, "#56e6ff")

    label(c, 780, 1426, "User Outcome", 10.5, "#ffb85c")
    node(826, 1364, 218, 50, "Context-Aware Guidance", "route cue, facility pick, next activity", "#123f4d", "#ffb85c")
    arrow(845, 1476, 900, 1414)
    arrow(1025, 1476, 980, 1414)


def draw_testing(c):
    rounded_panel(c, 742, 968, 382, 316, "Testing", accent="#83f2c6")
    items = [
        ("API", "health, login, JWT protection, schedule CRUD"),
        ("Build", "Vite production build and Go package checks"),
        ("Data", "seeded campus scenarios for repeatable demos"),
    ]
    y = 1188
    for title, body in items:
        c.setFillColor(hex_color("#0d384a", 0.86))
        c.roundRect(774, y - 58, 318, 66, 14, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 17)
        c.setFillColor(hex_color("#83f2c6"))
        c.drawString(796, y - 18, title)
        wrap(c, body, 850, y - 18, 35, 12.5, 16, "#dcecf3")
        y -= 86


def draw_design(c):
    rounded_panel(c, 62, 600, 650, 420, "Design Principles", accent="#ffd276")
    principles = [
        ("Context before controls", "Recommend the next useful action instead of forcing search first."),
        ("Indoor continuity", "Campus navigation continues after the user reaches a building."),
        ("Fast scanning", "Dense but clear cards support repeated daily use."),
        ("Progressive AR", "Start from reliable map data, then layer AR visuals and cues."),
    ]
    y = 924
    for idx, (title, body) in enumerate(principles, 1):
        c.setFillColor(hex_color("#ffd276"))
        c.circle(104, y + 6, 16, fill=1, stroke=0)
        c.setFont(FONT_BOLD, 14)
        c.setFillColor(hex_color("#07131f"))
        c.drawCentredString(104, y + 1, str(idx))
        c.setFont(FONT_BOLD, 17)
        c.setFillColor(hex_color("#f8fdff"))
        c.drawString(138, y + 10, title)
        wrap(c, body, 138, y - 12, 62, 12.8, 16, "#d4e8ef")
        y -= 78


def draw_swe(c):
    rounded_panel(c, 742, 552, 382, 374, "SWE Practice")
    practices = [
        ("Layered architecture", "React UI, API handlers, store layer, scheduler, client modules."),
        ("REST contracts", "JSON routes for buildings, facilities, schedule, recs, auth, sync."),
        ("Security baseline", "Bcrypt password hashing and JWT-protected workflows."),
        ("Reproducible demo", "SQLite migration and seed data for stable local runs."),
    ]
    y = 844
    for title, body in practices:
        c.setFont(FONT_BOLD, 15.5)
        c.setFillColor(hex_color("#8ff5ff"))
        c.drawString(774, y, "◆ " + title)
        wrap(c, body, 798, y - 22, 37, 12.3, 16, "#dcecf3")
        y -= 68


def icon_react(c, x, y, r=26):
    c.setStrokeColor(hex_color("#61dafb"))
    c.setLineWidth(2)
    for ang in [0, 60, -60]:
        c.saveState()
        c.translate(x, y)
        c.rotate(ang)
        c.ellipse(-r * 1.35, -r * 0.45, r * 1.35, r * 0.45, stroke=1, fill=0)
        c.restoreState()
    c.setFillColor(hex_color("#61dafb"))
    c.circle(x, y, 5, fill=1, stroke=0)


def icon_vite(c, x, y):
    c.setFillColor(hex_color("#ffd276"))
    pts = [(x - 18, y + 26), (x + 20, y + 26), (x + 7, y + 3), (x + 23, y + 3), (x - 8, y - 30), (x, y - 5), (x - 18, y - 5)]
    p = c.beginPath()
    p.moveTo(*pts[0])
    for px, py in pts[1:]:
        p.lineTo(px, py)
    p.close()
    c.drawPath(p, fill=1, stroke=0)


def icon_go(c, x, y):
    c.setFont(FONT_BOLD, 28)
    c.setFillColor(hex_color("#8ff5ff"))
    c.drawCentredString(x + 6, y - 10, "Go")
    c.setStrokeColor(hex_color("#8ff5ff"))
    c.setLineWidth(2)
    c.line(x - 42, y + 10, x - 18, y + 10)
    c.line(x - 52, y, x - 20, y)
    c.line(x - 42, y - 10, x - 18, y - 10)


def icon_db(c, x, y):
    c.setStrokeColor(hex_color("#8ff5ff"))
    c.setFillColor(hex_color("#0d5264", 0.9))
    c.ellipse(x - 28, y + 15, x + 28, y + 35, stroke=1, fill=1)
    c.rect(x - 28, y - 20, 56, 45, stroke=0, fill=1)
    c.ellipse(x - 28, y - 31, x + 28, y - 11, stroke=1, fill=1)
    c.line(x - 28, y + 25, x - 28, y - 20)
    c.line(x + 28, y + 25, x + 28, y - 20)


def icon_jwt(c, x, y):
    c.setStrokeColor(hex_color("#ffd276"))
    c.setLineWidth(2)
    for ang in range(0, 180, 45):
        c.saveState()
        c.translate(x, y)
        c.rotate(ang)
        c.line(-31, 0, 31, 0)
        c.restoreState()
    c.setFillColor(hex_color("#ffd276"))
    c.circle(x, y, 6, fill=1, stroke=0)


def icon_nus(c, x, y):
    c.setFillColor(hex_color("#ff8f5c"))
    c.roundRect(x - 30, y - 24, 60, 48, 8, fill=1, stroke=0)
    c.setFillColor(hex_color("#07131f"))
    c.setFont(FONT_BOLD, 14)
    c.drawCentredString(x, y + 4, "NUS")
    c.drawCentredString(x, y - 13, "MODS")


def draw_tech(c):
    rounded_panel(c, 62, 210, 1062, 336, "Tech Stack", accent="#83f2c6")
    techs = [
        ("React", icon_react),
        ("Vite", icon_vite),
        ("Go API", icon_go),
        ("SQLite", icon_db),
        ("JWT", icon_jwt),
        ("NUSMods", icon_nus),
    ]
    for i, (name, fn) in enumerate(techs):
        x = 112 + (i % 3) * 330
        y = 384 - (i // 3) * 122
        c.setFillColor(hex_color("#0b2d3e", 0.86))
        c.setStrokeColor(hex_color("#56e6ff", 0.82))
        c.roundRect(x, y, 278, 86, 18, fill=1, stroke=1)
        fn(c, x + 54, y + 43)
        c.setFont(FONT_BOLD, 22)
        c.setFillColor(hex_color("#f8fdff"))
        c.drawString(x + 104, y + 36, name)


def draw_team(c):
    c.saveState()
    c.setFillColor(hex_color("#071725", 0.82))
    c.roundRect(62, 68, 1062, 92, 18, fill=1, stroke=0)
    c.setStrokeColor(hex_color("#56e6ff", 0.6))
    c.roundRect(62, 68, 1062, 92, 18, fill=0, stroke=1)
    c.restoreState()
    label(c, 96, 128, "Team Members", 15, "#ffd276")
    c.setFont(FONT_BOLD, 28)
    c.setFillColor(hex_color("#f8fdff"))
    c.drawString(96, 92, "Wang Qichen  ·  Feng Yi")
    c.setFont(FONT_REG, 14)
    c.setFillColor(hex_color("#b9d8e3"))
    c.drawRightString(1088, 100, "Atlas · AR Map NUS · Final Poster")


def main():
    c = canvas.Canvas(str(OUT), pagesize=A1)
    draw_bg(c)
    draw_title(c)
    draw_overview(c)
    draw_features(c)
    draw_pipeline(c)
    draw_testing(c)
    draw_design(c)
    draw_swe(c)
    draw_tech(c)
    draw_team(c)
    c.showPage()
    c.save()
    print(OUT)


if __name__ == "__main__":
    main()

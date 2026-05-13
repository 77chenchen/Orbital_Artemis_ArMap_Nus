from __future__ import annotations

import base64
import textwrap
from pathlib import Path

OUT = Path(__file__).with_name("project-poster-template.ps")
JPG = Path(__file__).with_name("orbital-ar-map-bg.jpg")

W, H = 2384, 1684  # A1 landscape in PostScript points.


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


class PS:
    def __init__(self) -> None:
        self.lines: list[str] = [
            "%!PS-Adobe-3.0",
            "%%Pages: 1",
            f"%%BoundingBox: 0 0 {W} {H}",
            "<< /PageSize [{} {}] >> setpagedevice".format(W, H),
            "/Helvetica findfont 12 scalefont setfont",
            "1 setlinejoin 1 setlinecap",
        ]

    def raw(self, line: str) -> None:
        self.lines.append(line)

    def color(self, r: int, g: int, b: int) -> None:
        self.raw(f"{r/255:.4f} {g/255:.4f} {b/255:.4f} setrgbcolor")

    def rect(self, x: float, y: float, w: float, h: float, color: tuple[int, int, int], stroke=None) -> None:
        self.color(*color)
        self.raw(f"newpath {x:.1f} {y:.1f} moveto {w:.1f} 0 rlineto 0 {h:.1f} rlineto {-w:.1f} 0 rlineto closepath fill")
        if stroke:
            self.color(*stroke)
            self.raw(f"newpath {x:.1f} {y:.1f} moveto {w:.1f} 0 rlineto 0 {h:.1f} rlineto {-w:.1f} 0 rlineto closepath stroke")

    def line(self, x1: float, y1: float, x2: float, y2: float, color: tuple[int, int, int], width=2) -> None:
        self.color(*color)
        self.raw(f"{width} setlinewidth newpath {x1:.1f} {y1:.1f} moveto {x2:.1f} {y2:.1f} lineto stroke")

    def font(self, name: str, size: float) -> None:
        self.raw(f"/{name} findfont {size:.1f} scalefont setfont")

    def text(self, x: float, y: float, text: str, size=18, color=(232, 247, 255), font="Helvetica") -> None:
        self.font(font, size)
        self.color(*color)
        self.raw(f"{x:.1f} {y:.1f} moveto ({esc(text)}) show")

    def wrap(self, x: float, y: float, text: str, width: int, size=18, leading=24, color=(220, 234, 241), font="Helvetica") -> float:
        for line in textwrap.wrap(text, width=width):
            self.text(x, y, line, size, color, font)
            y -= leading
        return y

    def pill(self, x: float, y: float, w: float, h: float, label: str, color=(16, 63, 79), text_color=(236, 251, 255)) -> None:
        self.rect(x, y, w, h, color, (77, 196, 220))
        self.text(x + 18, y + h / 2 - 7, label, 18, text_color, "Helvetica-Bold")


ps = PS()

# Background.
ps.rect(0, 0, W, H, (7, 19, 31))

jpg_data = JPG.read_bytes()
encoded = base64.a85encode(jpg_data, adobe=False).decode("ascii") + "~>"
ps.raw("gsave")
ps.raw("1320 96 translate 1040 694 scale")
ps.raw("<<")
ps.raw("/ImageType 1")
ps.raw("/Width 1536")
ps.raw("/Height 1024")
ps.raw("/BitsPerComponent 8")
ps.raw("/ColorSpace /DeviceRGB")
ps.raw("/Decode [0 1 0 1 0 1]")
ps.raw("/ImageMatrix [1536 0 0 -1024 0 1024]")
ps.raw("/DataSource currentfile /ASCII85Decode filter /DCTDecode filter")
ps.raw(">> image")
for i in range(0, len(encoded), 96):
    ps.raw(encoded[i : i + 96])
ps.raw("grestore")

# Dark content wash over image so text remains readable.
ps.rect(0, 0, 1540, H, (7, 19, 31))
ps.rect(1540, 0, 844, H, (8, 25, 38))
ps.line(48, 48, W - 48, 48, (75, 188, 209), 1)
ps.line(48, H - 48, W - 48, H - 48, (75, 188, 209), 1)
ps.line(48, 48, 48, H - 48, (75, 188, 209), 1)
ps.line(W - 48, 48, W - 48, H - 48, (75, 188, 209), 1)

# Orbital decoration.
ps.color(68, 230, 213)
ps.raw("2 setlinewidth newpath 1838 1518 390 0 360 arc stroke")
ps.raw("newpath 2098 1376 9 0 360 arc fill")
ps.color(255, 184, 92)
ps.raw("newpath 2102 1378 18 0 360 arc fill")

# Header.
ps.text(86, 1572, "ORBITAL 26 · ARTEMIS · TEAM ATLAS", 22, (141, 232, 255), "Helvetica-Bold")
ps.text(86, 1495, "Atlas AR Campus Assistant", 74, (255, 255, 255), "Helvetica-Bold")
ps.wrap(
    90,
    1442,
    "A context-aware campus navigation assistant for NUS students, connecting outdoor wayfinding, indoor facility discovery, schedules, and AR-inspired guidance into one daily campus workflow.",
    104,
    24,
    32,
    (214, 230, 239),
)

# Meta tiles.
meta = [
    ("Problem", "Generic navigation often stops at the building entrance."),
    ("Goal", "Guide students to rooms, lifts, study spaces, restrooms, and next activities."),
    ("Users", "NUS students moving through daily campus routines."),
    ("Output", "React demo, Go API, SQLite campus data, JWT auth, and NUSMods sync."),
]
for i, (h, body) in enumerate(meta):
    x = 1548 + (i % 2) * 392
    y = 1430 - (i // 2) * 118
    ps.rect(x, y, 360, 86, (13, 45, 54), (74, 184, 205))
    ps.text(x + 20, y + 55, h.upper(), 15, (255, 207, 132), "Helvetica-Bold")
    ps.wrap(x + 20, y + 33, body, 33, 14, 18, (223, 243, 250))


def section(x, y, w, h, title):
    ps.rect(x, y, w, h, (8, 25, 38), (46, 102, 121))
    ps.text(x + 24, y + h - 42, title, 31, (255, 255, 255), "Helvetica-Bold")


# Overview.
section(86, 520, 660, 812, "Overview")
yy = ps.wrap(
    114,
    1238,
    "Atlas addresses the gap between reaching a campus building and actually finding the right room or facility inside it. The system combines geospatial campus points, indoor facility data, schedule entries, and recommendation logic so students receive guidance based on location, time, and daily context.",
    61,
    18,
    26,
)
ps.text(114, yy - 14, "Guidance Pipeline", 23, (141, 232, 255), "Helvetica-Bold")
pipeline = [("Campus Data", "Buildings, floors, facilities"), ("Schedule", "Classes and meetings"), ("Context", "Location and time"), ("Guidance", "Next route or facility")]
for i, (h, b) in enumerate(pipeline):
    y = yy - 92 - i * 104
    ps.rect(126, y, 566, 74, (17, 75, 96), (82, 209, 222))
    ps.text(148, y + 44, h, 20, (255, 207, 132), "Helvetica-Bold")
    ps.text(148, y + 18, b, 16, (220, 234, 241))
ps.text(114, 680, "Why it matters", 23, (141, 232, 255), "Helvetica-Bold")
ps.wrap(136, 640, "Students need support beyond outdoor routing: lifts, restrooms, printers, study spaces, and schedule-aware next stops all affect daily movement.", 57, 17, 24)

# Features.
section(776, 868, 780, 464, "Features")
features = [
    ("AR Wayfinding Concept", "Waypoint and reticle-based route cues for future AR overlays."),
    ("Indoor Facility Discovery", "Filter by building and type: study, restroom, lift, printing."),
    ("Daily Agent", "Recommendations from schedule, nearby campus points, and time."),
    ("Campus Data Sync", "NUSMods sync status demonstrates external data readiness."),
]
for i, (h, b) in enumerate(features):
    x = 810 + (i % 2) * 366
    y = 1126 - (i // 2) * 132
    ps.rect(x, y, 330, 104, (17, 75, 96), (82, 209, 222))
    ps.text(x + 18, y + 68, h, 19, (141, 232, 255), "Helvetica-Bold")
    ps.wrap(x + 18, y + 42, b, 33, 14, 18)

# Tech stack compact.
section(1588, 884, 710, 344, "Tech Stack")
techs = ["React", "Vite", "Go API", "SQLite", "JWT Auth", "NUSMods API"]
for i, label in enumerate(techs):
    x = 1626 + (i % 3) * 210
    y = 1084 - (i // 3) * 94
    ps.pill(x, y, 172, 58, label)

# Design principles.
section(1588, 520, 710, 428, "Design Principles")
principles = [
    ("Context before controls", "Surface the next useful campus action."),
    ("Indoor continuity", "Treat building arrival as a midpoint."),
    ("Fast scanning", "Compact cards, clear status, map pins."),
    ("Progressive AR", "Start reliable, layer AR visuals later."),
]
for i, (h, b) in enumerate(principles):
    y = 846 - i * 76
    ps.color(131, 242, 198)
    ps.raw(f"newpath 1634 {y+10} 18 0 360 arc fill")
    ps.text(1627, y + 3, str(i + 1), 18, (7, 19, 31), "Helvetica-Bold")
    ps.text(1670, y + 19, h, 19, (255, 255, 255), "Helvetica-Bold")
    ps.text(1670, y - 5, b, 15, (207, 226, 233))

# Testing.
section(776, 520, 780, 312, "Testing")
tests = [
    ("API Checks", "Health, auth, protected routes, schedule CRUD."),
    ("Frontend Build", "Vite production build validates UI bundling."),
    ("Data Scenarios", "Seeded COM1, CLB, UTOWN repeatable demo data."),
]
for i, (h, b) in enumerate(tests):
    x = 810 + i * 244
    ps.rect(x, 596, 216, 124, (15, 52, 65), (62, 139, 158))
    ps.text(x + 16, 674, h, 18, (131, 242, 198), "Helvetica-Bold")
    ps.wrap(x + 16, 646, b, 23, 14, 19)

# SWE practice.
section(86, 150, 2212, 326, "SWE Practice")
practices = [
    ("Layered Architecture", "React UI, API handlers, store layer, scheduler, and client modules are separated."),
    ("REST Contracts", "JSON endpoints for buildings, facilities, schedule, recommendations, auth, and sync."),
    ("Security Baseline", "Bcrypt password hashing and JWT-protected workflow routes."),
    ("Maintainable Demo Data", "SQLite migrations and seed data keep local demos reproducible."),
]
for i, (h, b) in enumerate(practices):
    x = 128 + i * 532
    ps.rect(x, 220, 470, 132, (15, 52, 65), (62, 139, 158))
    ps.text(x + 20, 306, h, 21, (131, 242, 198), "Helvetica-Bold")
    ps.wrap(x + 20, 276, b, 43, 15, 20)

ps.text(86, 84, "Atlas · AR Map NUS · Project Poster Template", 16, (190, 214, 224), "Helvetica-Bold")
ps.text(1540, 84, "Replace placeholders with final metrics, screenshots, QR code, and team details before submission.", 15, (190, 214, 224))
ps.raw("showpage")
ps.raw("%%EOF")

OUT.write_text("\n".join(ps.lines), encoding="latin-1")
print(OUT)

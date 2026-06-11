#!/usr/bin/env python3
"""Generate the Artemis virtual agent model and action modules.

The frontend imports these generated assets:
- src/assets/agent/atlas_agent_model.svg
- src/assets/agent/atlas_agent_modules.json
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from textwrap import dedent


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "src" / "assets" / "agent"


@dataclass(frozen=True)
class ActionModule:
    id: str
    label: str
    mood: str
    durationMs: int
    replies: list[str]


def build_svg() -> str:
    """Return a layered SVG model with class names for CSS animation."""

    return dedent(
        """\
        <svg class="agent-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 360" aria-hidden="true">
          <defs>
            <linearGradient id="agentShell" x1="72" y1="48" x2="248" y2="284" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#F8FFFB"/>
              <stop offset="0.44" stop-color="#C7EFE1"/>
              <stop offset="1" stop-color="#3E9785"/>
            </linearGradient>
            <linearGradient id="agentFace" x1="98" y1="96" x2="224" y2="218" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#123234"/>
              <stop offset="1" stop-color="#1B5260"/>
            </linearGradient>
            <linearGradient id="agentBeacon" x1="134" y1="12" x2="190" y2="88" gradientUnits="userSpaceOnUse">
              <stop offset="0" stop-color="#FFD966"/>
              <stop offset="1" stop-color="#FF7A59"/>
            </linearGradient>
            <filter id="agentSoftShadow" x="-25%" y="-20%" width="150%" height="150%">
              <feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#10322F" flood-opacity="0.22"/>
            </filter>
          </defs>

          <ellipse class="agent-ground-shadow" cx="160" cy="307" rx="92" ry="20" fill="#12322E" opacity="0.16"/>

          <g class="agent-figure" filter="url(#agentSoftShadow)">
            <g class="agent-orbit-ring">
              <path d="M54 168c28-58 89-92 151-75 43 12 72 43 83 78" fill="none" stroke="#FFB84D" stroke-width="8" stroke-linecap="round" opacity="0.9"/>
              <path d="M266 203c-29 52-87 80-145 64-40-11-68-39-81-72" fill="none" stroke="#35C7B1" stroke-width="8" stroke-linecap="round" opacity="0.92"/>
              <circle class="agent-orbit-dot" cx="260" cy="198" r="10" fill="#FFD966"/>
            </g>

            <g class="agent-left-arm">
              <path d="M93 173c-30 6-48 24-52 50" fill="none" stroke="#2D7A72" stroke-width="18" stroke-linecap="round"/>
              <circle cx="41" cy="227" r="16" fill="#F5FFFB" stroke="#2D7A72" stroke-width="7"/>
            </g>

            <g class="agent-right-arm">
              <path d="M226 171c31 5 50 22 58 47" fill="none" stroke="#2D7A72" stroke-width="18" stroke-linecap="round"/>
              <circle cx="287" cy="222" r="16" fill="#F5FFFB" stroke="#2D7A72" stroke-width="7"/>
            </g>

            <g class="agent-body">
              <path class="agent-shell" d="M159 51c53 0 96 43 96 96v48c0 34-19 65-49 81l-34 19a26 26 0 0 1-25 0l-34-19a92 92 0 0 1-49-81v-48c0-53 42-96 95-96Z" fill="url(#agentShell)" stroke="#18584F" stroke-width="8"/>
              <path class="agent-chest" d="M112 229c17 20 79 20 96 0 2 27-19 49-48 49s-50-22-48-49Z" fill="#EAFBF4" opacity="0.95"/>
              <path class="agent-map-pin" d="M160 231c17 0 31 13 31 30 0 22-31 48-31 48s-31-26-31-48c0-17 14-30 31-30Z" fill="#FF7A59"/>
              <circle class="agent-map-pin-core" cx="160" cy="261" r="11" fill="#FFF5D6"/>
            </g>

            <g class="agent-head">
              <path d="M160 35v37" stroke="#18584F" stroke-width="8" stroke-linecap="round"/>
              <circle class="agent-antenna-tip" cx="160" cy="28" r="18" fill="url(#agentBeacon)" stroke="#18584F" stroke-width="6"/>
              <rect class="agent-face" x="88" y="91" width="144" height="103" rx="42" fill="url(#agentFace)" stroke="#18584F" stroke-width="7"/>
              <g class="agent-eye-row">
                <ellipse class="agent-eye agent-eye-left" cx="128" cy="139" rx="13" ry="19" fill="#A8FFF0"/>
                <ellipse class="agent-eye agent-eye-right" cx="193" cy="139" rx="13" ry="19" fill="#A8FFF0"/>
                <circle cx="132" cy="132" r="5" fill="#FFFFFF" opacity="0.85"/>
                <circle cx="197" cy="132" r="5" fill="#FFFFFF" opacity="0.85"/>
              </g>
              <path class="agent-mouth" d="M132 166c15 14 42 14 57 0" fill="none" stroke="#A8FFF0" stroke-width="8" stroke-linecap="round"/>
            </g>

            <g class="agent-signal">
              <path d="M111 77c-10-16-8-32 3-45" fill="none" stroke="#35C7B1" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
              <path d="M209 78c11-15 9-33-3-46" fill="none" stroke="#FFB84D" stroke-width="6" stroke-linecap="round" opacity="0.75"/>
            </g>
          </g>
        </svg>
        """
    )


def build_modules() -> dict:
    actions = [
        ActionModule(
            id="wake",
            label="Wake",
            mood="online",
            durationMs=1800,
            replies=[
                "我在。正在把校园地图、日程和推荐路线接起来。",
                "唤醒成功。今天想先看路线、课程，还是附近设施？",
                "Artemis 已上线。我可以帮你规划下一步去哪里。",
            ],
        ),
        ActionModule(
            id="wave",
            label="Wave",
            mood="friendly",
            durationMs=1700,
            replies=[
                "你好，我会待在角落，需要时再跳出来。",
                "收到你的召唤。地图助手准备就绪。",
                "嗨，我在这里。点一个动作，我就切换状态。",
            ],
        ),
        ActionModule(
            id="think",
            label="Think",
            mood="planning",
            durationMs=2200,
            replies=[
                "我正在思考最省力的路径和时间安排。",
                "让我扫一下当前日程，再给你更稳的建议。",
                "分析中：课程、地点、步行距离都会一起考虑。",
            ],
        ),
        ActionModule(
            id="route",
            label="Route",
            mood="navigation",
            durationMs=2100,
            replies=[
                "路线模式启动。下一步可以把目的地交给地图页面。",
                "我会优先考虑少绕路、少换楼层的走法。",
                "导航状态已打开。需要的话我可以配合地图搜索。",
            ],
        ),
        ActionModule(
            id="celebrate",
            label="Done",
            mood="complete",
            durationMs=1800,
            replies=[
                "完成。这个安排看起来清爽多了。",
                "任务收束好了。下一步可以继续细化日程。",
                "漂亮，当前计划已经整理完成。",
            ],
        ),
    ]

    return {
        "agent": {
            "name": "Artemis",
            "role": "Campus map companion",
            "model": "atlas_agent_model.svg",
            "version": "1.0.0",
        },
        "docked": {
            "label": "Docked",
            "reply": "Artemis is resting in the page corner.",
        },
        "actions": [asdict(action) for action in actions],
    }


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    (ASSET_DIR / "atlas_agent_model.svg").write_text(build_svg(), encoding="utf-8")
    (ASSET_DIR / "atlas_agent_modules.json").write_text(
        json.dumps(build_modules(), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated virtual agent assets in {ASSET_DIR}")


if __name__ == "__main__":
    main()

import React, { useEffect, useMemo, useRef, useState } from "react";
import agentModelSvg from "../assets/agent/atlas_agent_model.svg?raw";
import agentModules from "../assets/agent/atlas_agent_modules.json";
import "./virtualAgent.css";

const actionCycle = ["wave", "think", "route", "celebrate"];

function chooseReply(action) {
  if (!action?.replies?.length) return "我在。需要时随时叫我。";
  return action.replies[Math.floor(Math.random() * action.replies.length)];
}

export default function VirtualAgent() {
  const [isAwake, setIsAwake] = useState(false);
  const [activeAction, setActiveAction] = useState("docked");
  const [message, setMessage] = useState("我在右下角待命。");
  const [cycleIndex, setCycleIndex] = useState(0);
  const actionTimerRef = useRef(null);

  const actions = agentModules.actions;
  const actionById = useMemo(
    () => Object.fromEntries(actions.map((action) => [action.id, action])),
    [actions],
  );

  useEffect(
    () => () => {
      if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);
    },
    [],
  );

  function playAction(actionId) {
    const action = actionById[actionId] || actionById.wake;
    if (!action) return;

    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);

    setIsAwake(true);
    setActiveAction(action.id);
    setMessage(chooseReply(action));

    actionTimerRef.current = window.setTimeout(() => {
      setActiveAction("idle");
    }, action.durationMs);
  }

  function wakeOrCycle() {
    if (!isAwake) {
      playAction("wake");
      return;
    }

    const nextActionId = actionCycle[cycleIndex % actionCycle.length];
    setCycleIndex((current) => current + 1);
    playAction(nextActionId);
  }

  function dockAgent(event) {
    event.stopPropagation();
    if (actionTimerRef.current) window.clearTimeout(actionTimerRef.current);
    setIsAwake(false);
    setActiveAction("docked");
    setMessage("我在右下角待命。");
  }

  const quickActions = actions.filter((action) => action.id !== "wake");

  return (
    <aside
      className={`virtual-agent ${isAwake ? "is-awake" : "is-docked"}`}
      data-agent-action={activeAction}
      aria-label={`${agentModules.agent.name} virtual campus agent`}
    >
      {isAwake && (
        <section className="virtual-agent__panel" aria-live="polite">
          <div className="virtual-agent__panel-head">
            <div>
              <span>{agentModules.agent.name}</span>
              <strong>{actionById[activeAction]?.mood || "ready"}</strong>
            </div>
            <button className="virtual-agent__icon-button" type="button" onClick={dockAgent} aria-label="Hide Artemis">
              ×
            </button>
          </div>

          <p>{message}</p>

          <div className="virtual-agent__actions" aria-label="Agent actions">
            {quickActions.map((action) => (
              <button key={action.id} type="button" onClick={() => playAction(action.id)}>
                {action.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <button
        className="virtual-agent__body-button"
        type="button"
        onClick={wakeOrCycle}
        aria-label={isAwake ? "Play next Artemis action" : "Wake Artemis"}
        aria-expanded={isAwake}
      >
        <span className="virtual-agent__glow" aria-hidden="true" />
        <span className="virtual-agent__art" dangerouslySetInnerHTML={{ __html: agentModelSvg }} />
        {!isAwake && <span className="virtual-agent__dock-label">AI</span>}
      </button>
    </aside>
  );
}

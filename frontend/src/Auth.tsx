import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Login from "./Login";
import Register from "./Register";
import "./auth.css";

const assistantMessages = [
  "Your first lecture starts at LT27.",
  "Fastest route found.",
  "You have 12 minutes before class.",
  "Focus session ready after arrival.",
];

const particles = [
  { left: "8%", top: "14%", size: 5, duration: 7.2, delay: 0.1 },
  { left: "18%", top: "78%", size: 4, duration: 8.3, delay: 1.2 },
  { left: "28%", top: "38%", size: 6, duration: 9.1, delay: 0.6 },
  { left: "42%", top: "10%", size: 3, duration: 7.8, delay: 1.8 },
  { left: "57%", top: "72%", size: 5, duration: 8.8, delay: 0.4 },
  { left: "66%", top: "24%", size: 4, duration: 9.4, delay: 1.4 },
  { left: "78%", top: "84%", size: 6, duration: 7.6, delay: 0.8 },
  { left: "89%", top: "18%", size: 4, duration: 8.6, delay: 1.1 },
];

export default function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Atlas | Sign in";
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % assistantMessages.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  const activeMessage = useMemo(() => assistantMessages[messageIndex], [messageIndex]);

  function enterDemoMode() {
    localStorage.setItem("token", "demo-mode");
    navigate("/Dashboard");
  }

  return (
    <main className="auth-page">
      <div className="auth-background" aria-hidden="true">
        {particles.map((particle, index) => (
          <motion.span
            key={`${particle.left}-${particle.top}`}
            className="background-particle"
            style={{
              left: particle.left,
              top: particle.top,
              width: particle.size,
              height: particle.size,
            }}
            animate={{
              y: [0, -18, 0],
              opacity: [0.18, 0.7, 0.18],
              scale: [0.8, 1.15, 0.8],
            }}
            transition={{
              duration: particle.duration,
              delay: particle.delay + index * 0.08,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <section className="auth-shell">
        <section className="preview-pane">
          <div className="preview-copy">
            <p>Atlas AR Preview</p>
            <h1>Navigate campus before the day starts.</h1>
          </div>
          <ARCampusPreview />
        </section>

        <section className="login-pane">
          <motion.div
            className="login-stack"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="brand-lockup">
              <div className="atlas-mark" aria-hidden="true" />
              <div>
                <strong>Atlas</strong>
                <span>AR Campus Map + Daily Assistant</span>
              </div>
            </div>

            <div className="assistant-bubble" aria-live="polite">
              <span>Atlas Assistant</span>
              <AnimatePresence mode="wait">
                <motion.strong
                  key={activeMessage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.35 }}
                >
                  {activeMessage}
                </motion.strong>
              </AnimatePresence>
            </div>

            {notice ? <p className="auth-notice">{notice}</p> : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={isRegister ? "register" : "login"}
                initial={{ opacity: 0, x: isRegister ? 18 : -18 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: isRegister ? -18 : 18 }}
                transition={{ duration: 0.28 }}
              >
                {isRegister ? (
                  <Register
                    toLogin={() => setIsRegister(false)}
                    onRegistered={() => {
                      setNotice("Account created. You can sign in now.");
                      setIsRegister(false);
                    }}
                  />
                ) : (
                  <Login toRegister={() => setIsRegister(true)} onDemoMode={enterDemoMode} />
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </section>
      </section>
    </main>
  );
}

function ARCampusPreview() {
  return (
    <div className="ar-preview">
      <div className="scan-grid" />
      <div className="terrain terrain-one" />
      <div className="terrain terrain-two" />
      <div className="campus-shadow" />

      <svg className="map-svg" viewBox="0 0 720 520" role="img" aria-label="Animated AR campus map preview">
        <defs>
          <linearGradient id="routeGradient" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#9ff6dd" />
            <stop offset="50%" stopColor="#f5d27b" />
            <stop offset="100%" stopColor="#7cc6ff" />
          </linearGradient>
          <filter id="routeGlow">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="map-plane">
          <path d="M120 365 278 448 605 300 446 221Z" fill="rgba(23, 55, 64, 0.84)" />
          <path d="M154 350 278 414 564 286 442 228Z" fill="rgba(27, 88, 92, 0.52)" />
        </g>

        <g>
          <path d="M168 315 246 348 246 402 168 369Z" fill="#4b7fa1" />
          <path d="M168 315 220 286 298 319 246 348Z" fill="#8cb9de" />
          <path d="M246 348 298 319 298 373 246 402Z" fill="#34627f" />

          <path d="M292 283 365 314 365 387 292 355Z" fill="#4e9a8d" />
          <path d="M292 283 340 258 413 288 365 314Z" fill="#9fe9d7" />
          <path d="M365 314 413 288 413 360 365 387Z" fill="#37766d" />

          <path d="M432 225 520 260 520 346 432 311Z" fill="#5b74bd" />
          <path d="M432 225 493 194 580 229 520 260Z" fill="#a4b8ff" />
          <path d="M520 260 580 229 580 316 520 346Z" fill="#43579c" />

          <path d="M515 327 592 358 592 414 515 382Z" fill="#d8965c" />
          <path d="M515 327 566 301 643 333 592 358Z" fill="#ffd39c" />
          <path d="M592 358 643 333 643 389 592 414Z" fill="#b66f3e" />
        </g>

        <motion.path
          d="M186 341 C247 322 273 320 324 323 C376 326 398 291 455 263 C495 243 535 253 559 308"
          fill="none"
          stroke="url(#routeGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          filter="url(#routeGlow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 2.3, ease: "easeInOut" }}
        />

        <motion.circle
          r="6"
          fill="#9ff6dd"
          animate={{ cx: [186, 250, 324, 401, 455, 559], cy: [341, 326, 323, 298, 263, 308] }}
          transition={{ duration: 6.5, repeat: Infinity, ease: "linear" }}
        />
        <motion.circle
          r="5"
          fill="#f5d27b"
          animate={{ cx: [214, 285, 348, 427, 510], cy: [360, 338, 342, 309, 281] }}
          transition={{ duration: 7.8, repeat: Infinity, ease: "linear", delay: 1.2 }}
        />
        <motion.circle
          r="4"
          fill="#7cc6ff"
          animate={{ cx: [294, 336, 388, 450, 532], cy: [395, 371, 348, 334, 344] }}
          transition={{ duration: 8.6, repeat: Infinity, ease: "linear", delay: 0.6 }}
        />
      </svg>

      {[
        { label: "COM1", left: "24%", top: "59%", delay: 0 },
        { label: "LT27", left: "48%", top: "40%", delay: 0.25 },
        { label: "COM3", left: "72%", top: "31%", delay: 0.5 },
      ].map((pin) => (
        <motion.div
          key={pin.label}
          className="location-pin"
          style={{ left: pin.left, top: pin.top }}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3.2, delay: pin.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          {pin.label}
        </motion.div>
      ))}

      <motion.div
        className="route-card"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span>Indoor route detected</span>
        <strong>Navigate to COM3</strong>
        <small>ETA 7 min</small>
      </motion.div>
    </div>
  );
}

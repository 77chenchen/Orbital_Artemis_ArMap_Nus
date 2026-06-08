import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Login from "./Login";
import Register from "./Register";
import "./auth.css";

const assistantMessages = [
  "Fastest green route to your next class is ready.",
  "Daily Assistant can turn campus gaps into study time.",
  "Indoor navigation, buses, and plans live in one place.",
  "Demo mode is ready when you want a quick look.",
];

const navItems = ["Home", "Map", "Assistant", "Campus"];

const leafParticles = [
  { left: "9%", top: "18%", size: 7, duration: 8.2, delay: 0.1 },
  { left: "17%", top: "78%", size: 5, duration: 9.1, delay: 1.2 },
  { left: "35%", top: "16%", size: 4, duration: 8.8, delay: 0.6 },
  { left: "58%", top: "76%", size: 6, duration: 10.2, delay: 0.3 },
  { left: "76%", top: "18%", size: 5, duration: 8.5, delay: 1.5 },
  { left: "90%", top: "68%", size: 8, duration: 9.6, delay: 0.8 },
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
        {leafParticles.map((particle, index) => (
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
              y: [0, -24, 0],
              rotate: [0, 18, -8, 0],
              opacity: [0.18, 0.78, 0.18],
              scale: [0.8, 1.2, 0.8],
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
        <header className="green-header">
          <button className="head-logo" type="button" onClick={() => setIsRegister(false)}>
            green <span>atlas</span>
          </button>

          <nav className="green-nav" aria-label="Auth preview navigation">
            {navItems.map((item) => (
              <span key={item} className="nav-items">
                {item}
              </span>
            ))}
          </nav>

          <div className="head-cta">
            <button className="header-cta-btn" type="button" onClick={() => setIsRegister(false)}>
              Login
            </button>
            <button className="header-cta-btn partner" type="button" onClick={enterDemoMode}>
              Demo
            </button>
          </div>
        </header>

        <div className="hero-content">
          <section className="left hero-copy" aria-label="Atlas sign in introduction">
            <motion.p
              className="main-text"
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              Navigate <span>Campus</span>, Save Your Day!
            </motion.p>
            <motion.p
              className="sub-text"
              initial={{ opacity: 0, y: 56 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              A greener, calmer entry point for Atlas: map routes, daily assistant guidance, and campus
              signals before the first lecture starts.
            </motion.p>
            <div className="hero-cta">
              <button className="hero-cta-btn" type="button" onClick={() => setIsRegister(false)}>
                Sign in
              </button>
              <button className="hero-cta-btn btn2" type="button" onClick={enterDemoMode}>
                Explore demo
              </button>
            </div>
          </section>

          <aside className="right login-card-wrap">
            <motion.img
              className="green-tree-image"
              src="https://raw.githubusercontent.com/codegenweb/Green-Future/main/images/tr1.png"
              alt=""
              aria-hidden="true"
              animate={{ scale: [1, 1.05, 1], y: [0, -10, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            />

            <motion.div
              className="login-stack"
              initial={{ opacity: 0, x: 70 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="brand-lockup">
                <div className="atlas-mark" aria-hidden="true" />
                <div>
                  <strong>{isRegister ? "Create Atlas Account" : "Welcome Back"}</strong>
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
          </aside>
        </div>
      </section>
    </main>
  );
}

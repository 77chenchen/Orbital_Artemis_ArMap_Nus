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
          <linearGradient id="blueFacade" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#3d6e8d" />
            <stop offset="100%" stopColor="#31586f" />
          </linearGradient>
          <linearGradient id="blueRoof" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#9ec9ec" />
            <stop offset="100%" stopColor="#7ca9d0" />
          </linearGradient>
          <linearGradient id="mintFacade" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#4a9386" />
            <stop offset="100%" stopColor="#39756c" />
          </linearGradient>
          <linearGradient id="mintRoof" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#b7f4e5" />
            <stop offset="100%" stopColor="#8bdac7" />
          </linearGradient>
          <linearGradient id="violetFacade" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#536cb4" />
            <stop offset="100%" stopColor="#415493" />
          </linearGradient>
          <linearGradient id="violetRoof" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#bac8ff" />
            <stop offset="100%" stopColor="#94a8f4" />
          </linearGradient>
          <linearGradient id="amberFacade" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#d28c51" />
            <stop offset="100%" stopColor="#ae6538" />
          </linearGradient>
          <linearGradient id="amberRoof" x1="0%" x2="100%">
            <stop offset="0%" stopColor="#ffe0b0" />
            <stop offset="100%" stopColor="#f4bf7d" />
          </linearGradient>
          <linearGradient id="glassStrip" x1="0%" x2="100%">
            <stop offset="0%" stopColor="rgba(219, 252, 247, 0.78)" />
            <stop offset="100%" stopColor="rgba(134, 217, 244, 0.42)" />
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
          <path d="M172 347 282 404 545 286" fill="none" stroke="rgba(236, 248, 244, 0.22)" strokeWidth="18" strokeLinecap="round" />
          <path d="M230 388 350 330 441 369" fill="none" stroke="rgba(245, 210, 123, 0.22)" strokeWidth="12" strokeLinecap="round" />
          <path d="M205 352 283 391 372 351 451 390" fill="none" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="3" strokeDasharray="10 10" />
        </g>

        <g>
          <path d="M142 381 170 395 170 423 142 409Z" fill="rgba(123, 206, 158, 0.8)" />
          <path d="M142 381 159 372 187 386 170 395Z" fill="rgba(177, 246, 210, 0.9)" />
          <path d="M170 395 187 386 187 414 170 423Z" fill="rgba(80, 137, 105, 0.9)" />

          <path d="M620 306 645 318 645 345 620 333Z" fill="rgba(123, 206, 158, 0.8)" />
          <path d="M620 306 636 297 662 309 645 318Z" fill="rgba(177, 246, 210, 0.9)" />
          <path d="M645 318 662 309 662 336 645 345Z" fill="rgba(80, 137, 105, 0.9)" />

          <g>
            <path d="M158 321 246 358 246 414 158 377Z" fill="url(#blueFacade)" />
            <path d="M158 321 221 288 309 326 246 358Z" fill="url(#blueRoof)" />
            <path d="M246 358 309 326 309 382 246 414Z" fill="#284b61" />
            <path d="M175 338 231 362 231 373 175 349Z" fill="url(#glassStrip)" />
            <path d="M175 356 231 380 231 391 175 367Z" fill="url(#glassStrip)" />
            <path d="M260 354 295 336 295 346 260 364Z" fill="rgba(219, 252, 247, 0.52)" />
            <path d="M260 371 295 353 295 363 260 381Z" fill="rgba(219, 252, 247, 0.52)" />
            <path d="M189 304 211 293 233 302 211 313Z" fill="rgba(31, 55, 66, 0.42)" />
            <path d="M178 382 203 394 203 409 178 398Z" fill="#1d3847" />
            <path d="M174 379 204 392 214 386 185 373Z" fill="rgba(245, 210, 123, 0.72)" />
            <path d="M309 348 326 339 326 365 309 374Z" fill="rgba(123, 206, 158, 0.48)" />
          </g>

          <g>
            <path d="M286 284 370 319 370 400 286 365Z" fill="url(#mintFacade)" />
            <path d="M286 284 344 254 428 289 370 319Z" fill="url(#mintRoof)" />
            <path d="M370 319 428 289 428 370 370 400Z" fill="#2f665f" />
            <path d="M300 309 356 332 356 344 300 321Z" fill="rgba(219, 252, 247, 0.62)" />
            <path d="M300 329 356 352 356 364 300 341Z" fill="rgba(219, 252, 247, 0.62)" />
            <path d="M386 317 414 302 414 314 386 329Z" fill="rgba(219, 252, 247, 0.52)" />
            <path d="M386 338 414 323 414 335 386 350Z" fill="rgba(219, 252, 247, 0.52)" />
            <path d="M309 279 343 261 376 274 343 292Z" fill="rgba(35, 82, 74, 0.22)" />
            <path d="M318 367 344 378 344 397 318 386Z" fill="#214b47" />
            <path d="M311 363 348 379 360 372 323 356Z" fill="rgba(245, 210, 123, 0.74)" />
            <path d="M406 349 444 329 444 342 406 362Z" fill="rgba(159, 246, 221, 0.35)" />
          </g>

          <g>
            <path d="M424 216 526 258 526 363 424 321Z" fill="url(#violetFacade)" />
            <path d="M424 216 493 180 595 223 526 258Z" fill="url(#violetRoof)" />
            <path d="M526 258 595 223 595 328 526 363Z" fill="#35457f" />
            <path d="M443 246 504 271 504 284 443 259Z" fill="rgba(226, 237, 255, 0.72)" />
            <path d="M443 269 504 294 504 307 443 282Z" fill="rgba(226, 237, 255, 0.72)" />
            <path d="M443 292 504 317 504 330 443 305Z" fill="rgba(226, 237, 255, 0.72)" />
            <path d="M543 255 579 236 579 248 543 267Z" fill="rgba(226, 237, 255, 0.58)" />
            <path d="M543 278 579 259 579 271 543 290Z" fill="rgba(226, 237, 255, 0.58)" />
            <path d="M543 301 579 282 579 294 543 313Z" fill="rgba(226, 237, 255, 0.58)" />
            <path d="M466 201 492 187 518 198 492 211Z" fill="rgba(42, 55, 102, 0.36)" />
            <path d="M524 318 563 298 563 310 524 330Z" fill="rgba(159, 246, 221, 0.34)" />
            <path d="M500 350 533 365 533 382 500 368Z" fill="#29345f" />
          </g>

          <path d="M423 343 476 366 520 343 467 321Z" fill="rgba(226, 237, 255, 0.28)" />
          <path d="M418 343 468 365 468 377 418 355Z" fill="rgba(159, 246, 221, 0.38)" />
          <path d="M468 365 520 339 520 351 468 377Z" fill="rgba(159, 246, 221, 0.24)" />

          <g>
            <path d="M505 331 592 367 592 427 505 390Z" fill="url(#amberFacade)" />
            <path d="M505 331 568 298 655 334 592 367Z" fill="url(#amberRoof)" />
            <path d="M592 367 655 334 655 394 592 427Z" fill="#9b552f" />
            <path d="M524 352 578 374 578 385 524 363Z" fill="rgba(255, 243, 220, 0.62)" />
            <path d="M607 364 642 346 642 357 607 375Z" fill="rgba(255, 243, 220, 0.52)" />
            <path d="M544 318 569 305 594 315 569 329Z" fill="rgba(116, 66, 37, 0.26)" />
            <path d="M531 389 557 400 557 418 531 407Z" fill="#71401f" />
          </g>

          <g>
            <path d="M216 424 226 429 226 444 216 439Z" fill="#7c5737" />
            <path d="M204 418 220 399 238 417 220 425Z" fill="#72be91" />
            <path d="M390 410 399 415 399 430 390 425Z" fill="#7c5737" />
            <path d="M378 404 394 385 412 403 394 411Z" fill="#72be91" />
            <path d="M606 426 615 431 615 446 606 441Z" fill="#7c5737" />
            <path d="M594 420 610 401 628 419 610 427Z" fill="#72be91" />
          </g>
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

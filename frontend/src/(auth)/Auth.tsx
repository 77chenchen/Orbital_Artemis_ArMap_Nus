import gsap from "gsap";
import React, { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Login from "./Login";
import Register from "./Register";
import teamLogo from "../assets/brand/team_logo.jpg";

const heroAccents = [
  { left: "18%", top: "58%", size: 13, tone: "#f26d44" },
  { left: "43%", top: "36%", size: 9, tone: "#e9c468" },
  { left: "72%", top: "59%", size: 12, tone: "#78d0b1" },
  { left: "61%", top: "72%", size: 7, tone: "#a8d4ef" },
];

export default function Auth() {
  const [isRegister, setIsRegister] = useState(false);
  const [notice, setNotice] = useState("");
  const [pointer, setPointer] = useState({ x: 50, y: 50, active: false });
  const { width } = useWindowDimensions();
  const compact = width < 960;
  const routeRef = useRef<unknown>(null);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = "Atlas | Sign in";
    }
  }, []);

  useEffect(() => {
    const stage = document.querySelector('[data-testid="auth-stage"]');
    const art = document.querySelector('[data-testid="auth-art-pane"]');
    const form = document.querySelector('[data-testid="auth-login-pane"]');
    const route = routeRef.current instanceof SVGPathElement ? routeRef.current : null;

    if (!stage || !art || !form) {
      return;
    }

    const context = gsap.context(() => {
      gsap.fromTo(stage, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5, ease: "power2.out" });
      gsap.fromTo(art, { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.85, ease: "power3.out" });
      gsap.fromTo(
        '[data-testid="atlas-island"]',
        { y: 24, scale: 0.975, autoAlpha: 0 },
        { y: 0, scale: 1, autoAlpha: 1, duration: 0.9, delay: 0.12, ease: "power3.out" },
      );
      gsap.fromTo(
        '[data-testid="atlas-building"] rect',
        { y: 22, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.56, stagger: 0.08, delay: 0.32, ease: "back.out(1.25)" },
      );
      gsap.fromTo(form, { x: 30, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.78, delay: 0.22, ease: "power3.out" });
      gsap.fromTo(
        '[data-testid="hero-value"]',
        { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.58, delay: 0.46, ease: "power3.out" },
      );
      gsap.to('[data-testid="atlas-building"] rect', {
        y: (index) => (index % 2 ? 6 : -6),
        duration: (index) => 3.8 + index * 0.28,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        stagger: 0.16,
      });
      gsap.to('[data-testid="hero-accent"]', {
        y: (index) => (index % 2 ? 12 : -12),
        x: (index) => (index % 3 ? -8 : 8),
        scale: (index) => (index % 2 ? 1.18 : 0.9),
        duration: 4.8,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
        stagger: 0.25,
      });
      gsap.to(route, {
        strokeDashoffset: -216,
        duration: 4.6,
        repeat: -1,
        ease: "none",
      });
    }, stage);

    return () => context.revert();
  }, []);

  useEffect(() => {
    const art = document.querySelector('[data-testid="auth-art-pane"]');
    const form = document.querySelector('[data-testid="auth-login-pane"]');
    if (!art || !form || compact) {
      return;
    }

    const dx = (pointer.x - 50) / 50;
    const dy = (pointer.y - 50) / 50;
    gsap.to(art, { x: dx * 13, y: dy * 9, rotateX: -dy * 2, rotateY: dx * 3, duration: 0.55, ease: "power3.out" });
    gsap.to(form, { x: -dx * 6, y: -dy * 4, duration: 0.55, ease: "power3.out" });
  }, [compact, pointer.x, pointer.y]);

  function movePointer(event: any) {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
      active: true,
    });
  }

  return (
    <View
      testID="auth-stage"
      style={styles.page}
      onMouseMove={movePointer}
      onMouseLeave={() => setPointer((current) => ({ ...current, active: false }))}
      onPointerMove={movePointer}
      onPointerLeave={() => setPointer((current) => ({ ...current, active: false }))}
    >
      <View style={styles.paperGrain} />
      <View style={styles.inkWashOne} />
      <View style={styles.inkWashTwo} />
      <View
        testID="cursor-aura"
        style={[
          styles.cursorAura,
          {
            left: `${pointer.x}%`,
            top: `${pointer.y}%`,
            opacity: pointer.active ? 1 : 0,
          },
        ]}
      />

      <View style={[styles.shell, compact && styles.shellCompact]}>
        <View testID="auth-art-pane" style={[styles.artPane, compact && styles.artPaneCompact]}>
          <View style={styles.brandPlate}>
            <Text style={styles.nusText}>NUS Atlas</Text>
            <Text style={styles.brandMicro}>Campus wayfinding</Text>
          </View>

          <View style={styles.heroIllustration}>
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
            <svg aria-hidden="true" className="atlas-route-svg" viewBox="0 0 760 470">
              <defs>
                <linearGradient id="atlasTerrain" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#7fd0ad" stopOpacity="0.58" />
                  <stop offset="58%" stopColor="#e7c768" stopOpacity="0.44" />
                  <stop offset="100%" stopColor="#ef7449" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="atlasBuilding" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#fbf3d8" stopOpacity="0.96" />
                  <stop offset="100%" stopColor="#83c7b3" stopOpacity="0.76" />
                </linearGradient>
                <filter id="atlasSoftShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#031017" floodOpacity="0.26" />
                </filter>
              </defs>
              <path
                d="M68 386 C188 440 522 438 690 338"
                fill="none"
                stroke="rgba(255, 243, 208, 0.16)"
                strokeWidth="2"
              />
              <path
                d="M54 326 C142 196 245 182 330 216 C416 250 454 140 560 148 C654 154 710 210 724 290 C646 398 504 446 344 418 C198 392 112 406 54 326Z"
                fill="rgba(255, 236, 184, 0.16)"
                filter="url(#atlasSoftShadow)"
              />
              <path
                data-testid="atlas-island"
                d="M72 318 C146 220 222 206 308 234 C404 266 450 162 548 168 C626 172 678 216 706 284 C628 382 514 416 354 390 C212 368 128 390 72 318Z"
                fill="url(#atlasTerrain)"
                stroke="rgba(255, 248, 226, 0.28)"
                strokeWidth="2"
                filter="url(#atlasSoftShadow)"
              />
              <path
                d="M96 330 C188 242 262 350 364 250 S556 148 676 280"
                fill="none"
                stroke="rgba(7, 30, 34, 0.48)"
                strokeLinecap="round"
                strokeWidth="38"
              />
              <path
                ref={routeRef as never}
                d="M96 330 C188 242 262 350 364 250 S556 148 676 280"
                fill="none"
                stroke="#ffe6aa"
                strokeDasharray="16 20"
                strokeLinecap="round"
                strokeWidth="9"
                filter="url(#atlasSoftShadow)"
              />
              <g data-testid="atlas-building" opacity="0.94" filter="url(#atlasSoftShadow)">
                <rect x="178" y="166" width="54" height="120" rx="8" fill="url(#atlasBuilding)" />
                <rect x="242" y="126" width="78" height="160" rx="8" fill="url(#atlasBuilding)" opacity="0.82" />
                <rect x="332" y="184" width="56" height="102" rx="8" fill="url(#atlasBuilding)" opacity="0.76" />
                <rect x="488" y="132" width="86" height="154" rx="8" fill="url(#atlasBuilding)" opacity="0.88" />
                <rect x="586" y="188" width="44" height="98" rx="8" fill="url(#atlasBuilding)" opacity="0.7" />
              </g>
              <g stroke="rgba(3, 16, 23, 0.22)" strokeWidth="2">
                <path d="M190 188 H220 M190 218 H220 M190 248 H220" />
                <path d="M258 154 H304 M258 184 H304 M258 214 H304 M258 244 H304" />
                <path d="M504 160 H558 M504 190 H558 M504 220 H558 M504 250 H558" />
              </g>
              <g fill="rgba(255, 248, 226, 0.88)">
                <circle cx="96" cy="330" r="7" />
                <circle cx="364" cy="250" r="7" />
                <circle cx="676" cy="280" r="7" />
              </g>
              <g fill="rgba(255, 248, 226, 0.78)" fontFamily="Inter, sans-serif" fontSize="18" fontWeight="600">
                <text x="72" y="368">UTown</text>
                <text x="320" y="226">Library</text>
                <text x="622" y="318">COM</text>
              </g>
            </svg>

            {heroAccents.map((accent) => (
              <View
                key={`${accent.left}-${accent.top}`}
                testID="hero-accent"
                style={[
                  styles.heroAccent,
                  {
                    left: accent.left,
                    top: accent.top,
                    width: accent.size,
                    height: accent.size,
                    backgroundColor: accent.tone,
                  },
                ]}
              />
            ))}
          </View>

          <View testID="hero-value" style={styles.valueClaim}>
            <Text style={styles.valueClaimText}>Know where to go next.</Text>
            <Text style={styles.valueClaimSubtext}>A calmer way to orient, move, and arrive at NUS.</Text>
          </View>
        </View>

        <View testID="auth-login-pane" style={[styles.loginPane, compact && styles.loginPaneCompact]}>
          <View style={styles.loginCard}>
            <View style={styles.markWrap}>
              <View style={styles.atlasMark}>
                <Image source={{ uri: teamLogo }} style={styles.teamLogoImage} resizeMode="cover" />
                <View style={styles.teamLogoTone} />
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.brandName}>Atlas</Text>
                <Text style={styles.brandTagline}>Campus navigation for NUS</Text>
              </View>
            </View>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            {isRegister ? (
              <Register
                toLogin={() => setIsRegister(false)}
                onRegistered={() => {
                  setNotice("Account created. You can sign in now.");
                  setIsRegister(false);
                }}
              />
            ) : (
              <Login toRegister={() => setIsRegister(true)} />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    position: "relative",
    minHeight: "100vh" as never,
    overflow: "hidden",
    padding: "clamp(16px, 3vw, 32px)" as never,
    color: "#17251f",
    backgroundColor: "#efe6d7",
    backgroundImage:
      "radial-gradient(circle at 16% 12%, rgba(239, 105, 68, 0.18), transparent 24%), radial-gradient(circle at 86% 18%, rgba(30, 91, 87, 0.2), transparent 28%), radial-gradient(circle at 68% 84%, rgba(119, 168, 139, 0.18), transparent 30%), linear-gradient(135deg, #f4eadc 0%, #dde5d8 46%, #d8ceb8 100%)",
    userSelect: "none" as never,
  },
  paperGrain: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    opacity: 0.45,
    backgroundImage:
      "repeating-linear-gradient(0deg, rgba(32, 25, 18, 0.05) 0 1px, transparent 1px 4px), repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.18) 0 1px, transparent 1px 5px)",
    mixBlendMode: "multiply" as never,
    animationKeyframes: {
      "0%": { opacity: 0.38 },
      "50%": { opacity: 0.5 },
      "100%": { opacity: 0.38 },
    },
    animationDuration: "14s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  } as never,
  inkWashOne: {
    position: "absolute",
    left: "-9%",
    bottom: "-16%",
    width: "42%",
    height: "50%",
    borderRadius: 999,
    backgroundColor: "rgba(16, 47, 55, 0.18)",
    filter: "blur(40px)" as never,
    animationKeyframes: {
      "0%": { opacity: 0.74, transform: "translate3d(0, 0, 0) scale(1)" },
      "50%": { opacity: 0.88, transform: "translate3d(14px, -10px, 0) scale(1.035)" },
      "100%": { opacity: 0.74, transform: "translate3d(0, 0, 0) scale(1)" },
    },
    animationDuration: "16s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  inkWashTwo: {
    position: "absolute",
    right: "-12%",
    top: "-18%",
    width: "46%",
    height: "52%",
    borderRadius: 999,
    backgroundColor: "rgba(234, 92, 56, 0.18)",
    filter: "blur(42px)" as never,
    animationKeyframes: {
      "0%": { opacity: 0.18, transform: "translate3d(0, 0, 0) scale(1)" },
      "50%": { opacity: 0.22, transform: "translate3d(18px, -12px, 0) scale(1.04)" },
      "100%": { opacity: 0.18, transform: "translate3d(0, 0, 0) scale(1)" },
    },
    animationDuration: "19s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  cursorAura: {
    position: "absolute",
    width: 260,
    height: 260,
    marginLeft: -130,
    marginTop: -130,
    borderRadius: 999,
    pointerEvents: "none",
    backgroundImage: "radial-gradient(circle, rgba(255, 226, 171, 0.38), rgba(255, 226, 171, 0) 68%)",
    transitionProperty: "opacity",
    transitionDuration: "180ms",
  },
  shell: {
    position: "relative",
    zIndex: 1,
    flexDirection: "row",
    width: "min(1280px, 92vw)" as never,
    minHeight: "min(760px, calc(100vh - 64px))" as never,
    marginHorizontal: "auto" as never,
    borderWidth: 1,
    borderColor: "rgba(36, 49, 42, 0.16)",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "rgba(255, 251, 241, 0.46)",
    boxShadow: "0 34px 110px rgba(43, 35, 24, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.36)",
    backdropFilter: "blur(22px)" as never,
    perspective: 1200,
  },
  shellCompact: {
    flexDirection: "column-reverse",
    minHeight: "calc(100vh - 32px)" as never,
  },
  artPane: {
    position: "relative",
    flex: 0.58,
    minHeight: 620,
    overflow: "hidden",
    padding: "clamp(28px, 4vw, 48px)" as never,
    backgroundColor: "#123a3b",
    backgroundImage:
      "radial-gradient(circle at 24% 20%, rgba(242, 109, 68, 0.24), transparent 28%), radial-gradient(circle at 78% 30%, rgba(120, 208, 177, 0.2), transparent 32%), linear-gradient(145deg, #123b3d 0%, #1f4b43 48%, #5b4635 100%)",
    boxShadow: "inset -42px 0 70px rgba(255, 249, 236, 0.08)" as never,
    animationKeyframes: {
      "0%": { filter: "saturate(1) brightness(1)" },
      "50%": { filter: "saturate(1.04) brightness(1.025)" },
      "100%": { filter: "saturate(1) brightness(1)" },
    },
    animationDuration: "17s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  artPaneCompact: {
    minHeight: 520,
    padding: 20,
  },
  brandPlate: {
    position: "relative",
    zIndex: 5,
    gap: 4,
  },
  nusText: {
    color: "#fff3d0",
    fontSize: 52,
    fontWeight: "900",
    lineHeight: 54,
    textShadow: "0 6px 24px rgba(5, 18, 18, 0.42)" as never,
  },
  brandMicro: {
    color: "rgba(255, 243, 208, 0.78)",
    fontSize: 14,
    fontWeight: "900",
  },
  heroIllustration: {
    position: "absolute",
    left: "5.5%",
    right: "5%",
    top: "19%",
    bottom: "18%",
    overflow: "hidden",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 243, 208, 0.1)",
    backgroundColor: "rgba(6, 26, 28, 0.1)",
  },
  heroGlowOne: {
    position: "absolute",
    left: "8%",
    top: "12%",
    width: "42%",
    height: "42%",
    borderRadius: 999,
    backgroundColor: "rgba(255, 116, 71, 0.18)",
    filter: "blur(18px)" as never,
  },
  heroGlowTwo: {
    position: "absolute",
    right: "7%",
    bottom: "16%",
    width: "46%",
    height: "44%",
    borderRadius: 999,
    backgroundColor: "rgba(119, 212, 183, 0.16)",
    filter: "blur(20px)" as never,
  },
  heroAccent: {
    position: "absolute",
    display: "flex",
    zIndex: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 243, 208, 0.62)",
    boxShadow: "0 0 22px rgba(255, 243, 208, 0.28)" as never,
  },
  heroAccentRing: {
    position: "absolute",
    borderRadius: 999,
  },
  valueClaim: {
    position: "absolute",
    left: "9%",
    right: "9%",
    bottom: 44,
    zIndex: 7,
    gap: 6,
  },
  valueClaimText: {
    color: "#fff3d0",
    fontSize: 28,
    letterSpacing: 0,
    fontWeight: "900",
    textAlign: "left",
    textShadow: "0 4px 18px rgba(5, 18, 18, 0.38)" as never,
  },
  valueClaimSubtext: {
    maxWidth: 420,
    color: "rgba(255, 243, 208, 0.64)",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  loginPane: {
    flex: 0.42,
    justifyContent: "center",
    minWidth: 0,
    padding: "clamp(24px, 4vw, 48px)" as never,
    backgroundColor: "rgba(255, 249, 236, 0.78)",
    backgroundImage:
      "radial-gradient(circle at 16% 14%, rgba(242, 109, 68, 0.08), transparent 24%), radial-gradient(circle at 90% 88%, rgba(18, 78, 69, 0.08), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.48), rgba(255,255,255,0.1))",
    boxShadow: "inset 28px 0 58px rgba(255, 249, 236, 0.42)" as never,
    animationKeyframes: {
      "0%": { filter: "brightness(1)" },
      "50%": { filter: "brightness(1.018)" },
      "100%": { filter: "brightness(1)" },
    },
    animationDuration: "15s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  loginPaneCompact: {
    padding: 20,
    boxShadow: "none" as never,
  },
  loginCard: {
    width: "min(420px, 100%)" as never,
    marginHorizontal: "auto" as never,
    gap: 24,
    padding: 30,
    borderWidth: 1,
    borderColor: "rgba(36, 49, 42, 0.12)",
    borderRadius: 24,
    backgroundColor: "rgba(255, 252, 243, 0.78)",
    boxShadow: "0 26px 80px rgba(35, 30, 23, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.72)",
    backdropFilter: "blur(28px)" as never,
    userSelect: "none" as never,
    animationKeyframes: {
      "0%": { transform: "translateY(0)" },
      "50%": { transform: "translateY(-4px)" },
      "100%": { transform: "translateY(0)" },
    },
    animationDuration: "5s",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
  },
  markWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  atlasMark: {
    position: "relative",
    width: 62,
    height: 62,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(21, 87, 83, 0.2)",
    backgroundColor: "#fff8e9",
    backgroundImage: "linear-gradient(145deg, rgba(21, 87, 83, 0.16) 0%, rgba(242, 109, 68, 0.14) 100%)",
    boxShadow: "0 16px 34px rgba(21, 87, 83, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.28)",
  },
  teamLogoImage: {
    position: "absolute",
    inset: 5,
    width: 52,
    height: 52,
    borderRadius: 14,
    filter: "sepia(0.18) saturate(1.24) hue-rotate(124deg) contrast(1.08)" as never,
  },
  teamLogoTone: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    backgroundImage:
      "linear-gradient(145deg, rgba(20, 86, 76, 0.2) 0%, rgba(255, 248, 230, 0.02) 46%, rgba(242, 109, 68, 0.22) 100%)",
    mixBlendMode: "color" as never,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  brandName: {
    color: "#112621",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 31,
  },
  brandTagline: {
    color: "#667164",
    fontSize: 14,
    fontWeight: "800",
  },
  notice: {
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 100, 80, 0.18)",
    borderRadius: 8,
    color: "#005c49",
    backgroundColor: "#eefbf6",
    fontWeight: "800",
  },
});

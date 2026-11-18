"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";

export interface GlassTabItem {
  id: string;
  label: string;
  href?: string;
  controlsId?: string;
}

const STIFFNESS = 420;
const DAMPING = 30;

function generateLensDisplacementMap(w: number, h: number): string {
  if (typeof document === "undefined") return "";
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(w));
  canvas.height = Math.max(2, Math.round(h));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const img = ctx.createImageData(canvas.width, canvas.height);
  const data = img.data;
  const r = canvas.height / 2;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      // Signed distance inside pill
      const cx = Math.max(r, Math.min(canvas.width - r, x));
      const dx = x - cx;
      const dy = y - r;
      const dist = Math.hypot(dx, dy);
      const norm = Math.min(1, dist / r);

      // Flat in centre (128, 128), strongest near rim (norm > 0.55)
      const rim = norm > 0.55 ? Math.pow((norm - 0.55) / 0.45, 1.6) : 0;
      const nx = dist > 0.001 ? dx / dist : 0;
      const ny = dist > 0.001 ? dy / dist : 0;

      const idx = (y * canvas.width + x) * 4;
      data[idx] = Math.round(128 - nx * rim * 115);
      data[idx + 1] = Math.round(128 - ny * rim * 115);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
}

function lerpColor(t: number): string {
  // --plum-muted (#72536A -> 114, 83, 106) to --plum (#3F113D -> 63, 17, 61)
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(114 + (63 - 114) * clamped);
  const g = Math.round(83 + (17 - 83) * clamped);
  const b = Math.round(106 + (61 - 106) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export function GlassTabs({
  tabs,
  activeId,
  onSelect,
  ariaLabel = "Tools navigation",
}: {
  tabs: GlassTabItem[];
  activeId: string;
  onSelect: (tab: GlassTabItem) => void;
  ariaLabel?: string;
}) {
  const filterId = useId().replace(/:/g, "");
  const trackRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const charRefs = useRef<Array<Array<HTMLSpanElement | null>>>([]);

  const [dispUrl, setDispUrl] = useState<string>("");
  const [supportsSvgBackdrop, setSupportsSvgBackdrop] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [focusedIdx, setFocusedIdx] = useState(() =>
    Math.max(0, tabs.findIndex((t) => t.id === activeId))
  );

  // Spring state stored in refs for 60fps updates without React re-renders
  const springRef = useRef({
    x: 0,
    w: 96,
    vx: 0,
    vw: 0,
    targetX: 0,
    targetW: 96,
    scaleX: 1,
    scaleY: 1,
    dragging: false,
    dragStartX: 0,
    lensStartX: 0,
    lastPointerX: 0,
    lastTime: 0,
    releaseVx: 0,
    rafId: null as number | null,
    reducedMotion: false,
  });

  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)");
    springRef.current.reducedMotion = rm.matches;
    const onChange = (e: MediaQueryListEvent) => {
      springRef.current.reducedMotion = e.matches;
    };
    rm.addEventListener("change", onChange);

    // Feature-detect SVG filter inside backdrop-filter (supported in Chromium)
    const isChromium = /Chrome|Chromium|Edg/.test(navigator.userAgent) && !/Firefox/.test(navigator.userAgent);
    const hasSupport =
      isChromium &&
      (CSS.supports("backdrop-filter", "url(#x)") ||
        CSS.supports("-webkit-backdrop-filter", "url(#x)"));
    setSupportsSvgBackdrop(hasSupport);

    return () => rm.removeEventListener("change", onChange);
  }, []);

  const updateCharOverlaps = useCallback((lensLeft: number, lensWidth: number) => {
    const track = trackRef.current;
    if (!track) return;
    const trackRect = track.getBoundingClientRect();
    const lensAbsLeft = trackRect.left + lensLeft - track.scrollLeft;
    const lensAbsRight = lensAbsLeft + lensWidth;

    for (let ti = 0; ti < charRefs.current.length; ti++) {
      const chars = charRefs.current[ti] || [];
      for (let ci = 0; ci < chars.length; ci++) {
        const span = chars[ci];
        if (!span) continue;
        const rect = span.getBoundingClientRect();
        const overlap = Math.max(
          0,
          Math.min(rect.right, lensAbsRight) - Math.max(rect.left, lensAbsLeft)
        );
        const ratio = rect.width > 0 ? overlap / rect.width : 0;
        span.style.color = lerpColor(ratio);
        // Subtle weight gain via text-shadow without changing layout metrics
        span.style.textShadow =
          ratio > 0.35
            ? `0 0 0.4px rgba(63, 17, 61, ${(ratio * 0.65).toFixed(2)})`
            : "none";
      }
    }
  }, []);

  const measureTab = useCallback((idx: number) => {
    const track = trackRef.current;
    const btn = tabRefs.current[idx];
    if (!track || !btn) return { x: 0, w: 96 };
    const x = btn.offsetLeft;
    const w = btn.offsetWidth;
    return { x, w };
  }, []);

  const applyLensTransform = useCallback(
    (x: number, w: number, sx: number, sy: number) => {
      const lens = lensRef.current;
      if (!lens) return;
      lens.style.width = `${w}px`;
      lens.style.transform = `translate3d(${x}px, -50%, 0) scaleX(${sx.toFixed(4)}) scaleY(${sy.toFixed(4)})`;
      updateCharOverlaps(x, w);
    },
    [updateCharOverlaps]
  );

  const stepSpring = useCallback(
    (now: number) => {
      const s = springRef.current;
      s.rafId = null;
      const dt = Math.min(0.032, Math.max(0.001, (now - (s.lastTime || now)) / 1000));
      s.lastTime = now;

      if (s.reducedMotion) {
        s.x = s.targetX;
        s.w = s.targetW;
        s.vx = 0;
        s.vw = 0;
        s.scaleX = 1;
        s.scaleY = 1;
        applyLensTransform(s.x, s.w, 1, 1);
        setIsMoving(false);
        return;
      }

      if (!s.dragging) {
        const ax = -STIFFNESS * (s.x - s.targetX) - DAMPING * s.vx;
        const aw = -STIFFNESS * (s.w - s.targetW) - DAMPING * s.vw;
        s.vx += ax * dt;
        s.vw += aw * dt;
        s.x += s.vx * dt;
        s.w += s.vw * dt;

        // Velocity-driven squash & stretch (max scaleX 1.18, min scaleY 0.86)
        const speedNorm = Math.min(1, Math.abs(s.vx) / 1400);
        const targetSx = 1 + speedNorm * 0.18;
        const targetSy = 1 - speedNorm * 0.14;
        s.scaleX += (targetSx - s.scaleX) * 0.32;
        s.scaleY += (targetSy - s.scaleY) * 0.32;
      } else {
        s.scaleX += (1.04 - s.scaleX) * 0.25;
        s.scaleY += (0.96 - s.scaleY) * 0.25;
      }

      applyLensTransform(s.x, s.w, s.scaleX, s.scaleY);

      const settled =
        !s.dragging &&
        Math.abs(s.x - s.targetX) < 0.25 &&
        Math.abs(s.vx) < 1 &&
        Math.abs(s.w - s.targetW) < 0.25 &&
        Math.abs(s.scaleX - 1) < 0.005;

      if (settled) {
        s.x = s.targetX;
        s.w = s.targetW;
        s.vx = 0;
        s.vw = 0;
        s.scaleX = 1;
        s.scaleY = 1;
        applyLensTransform(s.x, s.w, 1, 1);
        setIsMoving(false);
      } else {
        s.rafId = requestAnimationFrame(stepSpring);
      }
    },
    [applyLensTransform]
  );

  const startLoop = useCallback(() => {
    const s = springRef.current;
    if (s.rafId === null) {
      s.lastTime = performance.now();
      setIsMoving(true);
      s.rafId = requestAnimationFrame(stepSpring);
    }
  }, [stepSpring]);

  // Sync lens to activeId
  useEffect(() => {
    const idx = Math.max(0, tabs.findIndex((t) => t.id === activeId));
    setFocusedIdx(idx);
    const { x, w } = measureTab(idx);
    const s = springRef.current;

    if (s.w === 96 && s.x === 0 && x !== 0) {
      // Initial mount snap
      s.x = x;
      s.w = w;
      s.targetX = x;
      s.targetW = w;
      applyLensTransform(x, w, 1, 1);
    } else {
      // Launch squeeze against travel direction
      if (!s.reducedMotion && Math.abs(x - s.x) > 4) {
        s.scaleX = 0.92;
        s.scaleY = 1.07;
      }
      s.targetX = x;
      s.targetW = w;
      startLoop();
    }

    // Generate displacement map for lens dimensions
    setDispUrl(generateLensDisplacementMap(Math.max(80, w), 48));

    // Keep active tab scrolled into view on narrow screens
    const btn = tabRefs.current[idx];
    btn?.scrollIntoView({ behavior: s.reducedMotion ? "auto" : "smooth", inline: "nearest", block: "nearest" });
  }, [activeId, tabs, measureTab, applyLensTransform, startLoop]);

  useEffect(() => {
    const onResize = () => {
      const idx = Math.max(0, tabs.findIndex((t) => t.id === activeId));
      const { x, w } = measureTab(idx);
      const s = springRef.current;
      s.x = x;
      s.w = w;
      s.targetX = x;
      s.targetW = w;
      applyLensTransform(x, w, 1, 1);
      setDispUrl(generateLensDisplacementMap(Math.max(80, w), 48));
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      if (springRef.current.rafId !== null) {
        cancelAnimationFrame(springRef.current.rafId);
      }
    };
  }, [activeId, tabs, measureTab, applyLensTransform]);

  const onLensPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = springRef.current;
    s.dragging = true;
    s.dragStartX = e.clientX;
    s.lensStartX = s.x;
    s.lastPointerX = e.clientX;
    s.lastTime = performance.now();
    s.releaseVx = 0;
    startLoop();
  };

  const onLensPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = springRef.current;
    if (!s.dragging) return;
    const track = trackRef.current;
    if (!track) return;

    const now = performance.now();
    const dt = Math.max(0.001, (now - s.lastTime) / 1000);
    s.releaseVx = (e.clientX - s.lastPointerX) / dt;
    s.lastPointerX = e.clientX;
    s.lastTime = now;

    const first = measureTab(0);
    const last = measureTab(tabs.length - 1);
    const minX = first.x;
    const maxX = last.x;

    let nextX = s.lensStartX + (e.clientX - s.dragStartX);
    // Rubber-band resistance at both ends
    if (nextX < minX) {
      nextX = minX - (minX - nextX) * 0.28;
    } else if (nextX > maxX) {
      nextX = maxX + (nextX - maxX) * 0.28;
    }

    s.x = nextX;
    applyLensTransform(s.x, s.w, 1.04, 0.96);
  };

  const onLensPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = springRef.current;
    if (!s.dragging) return;
    s.dragging = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    // Project position slightly with release velocity to pick nearest tab
    const projectedX = s.x + Math.max(-180, Math.min(180, s.releaseVx * 0.08));
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < tabs.length; i++) {
      const m = measureTab(i);
      const dist = Math.abs(m.x - projectedX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    s.vx = s.releaseVx * 0.45;
    onSelect(tabs[bestIdx]);
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = tabs.length - 1;
    else return;

    e.preventDefault();
    setFocusedIdx(nextIdx);
    tabRefs.current[nextIdx]?.focus();
    onSelect(tabs[nextIdx]);
  };

  return (
    <div className="relative max-w-full overflow-x-auto no-scrollbar">
      {supportsSvgBackdrop && dispUrl && (
        <svg aria-hidden="true" className="absolute h-0 w-0 pointer-events-none">
          <defs>
            <filter id={filterId} x="-10%" y="-10%" width="120%" height="120%">
              <feImage href={dispUrl} result="disp" preserveAspectRatio="none" />
              <feDisplacementMap
                in="SourceGraphic"
                in2="disp"
                scale="18"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>
        </svg>
      )}

      <div
        ref={trackRef}
        role="tablist"
        aria-label={ariaLabel}
        className="relative inline-flex items-center gap-1 rounded-full p-1.5 min-h-[52px]"
        style={{
          background: "rgba(221, 238, 194, 0.48)",
          border: "1px solid rgba(255, 255, 255, 0.72)",
          boxShadow:
            "inset 0 2px 6px rgba(63, 17, 61, 0.14), 0 1px 0 rgba(255, 255, 255, 0.85)",
          WebkitBackdropFilter: "blur(18px) saturate(150%)",
          backdropFilter: "blur(18px) saturate(150%)",
        }}
      >
        {/* Liquid glass lens */}
        <div
          ref={lensRef}
          onPointerDown={onLensPointerDown}
          onPointerMove={onLensPointerMove}
          onPointerUp={onLensPointerUp}
          onPointerCancel={onLensPointerUp}
          className="absolute left-0 top-1/2 h-[46px] rounded-full cursor-grab active:cursor-grabbing touch-pan-y select-none z-10"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(246,251,221,0.16) 50%, rgba(221,238,194,0.28) 100%)",
            border: "1px solid rgba(255, 255, 255, 0.88)",
            boxShadow:
              "inset 0 1.5px 2px rgba(255,255,255,0.9), inset 0 -2px 4px rgba(63,17,61,0.12), 0 6px 16px rgba(63, 17, 61, 0.16)",
            WebkitBackdropFilter: supportsSvgBackdrop
              ? `url(#${filterId}) saturate(165%)`
              : "blur(16px) saturate(165%)",
            backdropFilter: supportsSvgBackdrop
              ? `url(#${filterId}) saturate(165%)`
              : "blur(16px) saturate(165%)",
            transformOrigin: "center center",
          }}
        >
          {/* Spectral rainbow glints */}
          <span
            aria-hidden="true"
            className={`glass-glint-ring absolute inset-0 rounded-full ${isMoving ? "is-moving" : ""}`}
          />
        </div>

        {/* Tab buttons */}
        {tabs.map((tab, ti) => {
          const isSelected = tab.id === activeId;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[ti] = el;
              }}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={tab.controlsId}
              tabIndex={focusedIdx === ti ? 0 : -1}
              onClick={() => onSelect(tab)}
              onKeyDown={(e) => handleKeyDown(e, ti)}
              className="relative z-20 min-h-[44px] px-5 py-2 rounded-full text-sm font-medium whitespace-nowrap select-none cursor-pointer"
            >
              {tab.label.split("").map((ch, ci) => (
                <span
                  key={ci}
                  ref={(el) => {
                    if (!charRefs.current[ti]) charRefs.current[ti] = [];
                    charRefs.current[ti][ci] = el;
                  }}
                  style={{ color: isSelected ? "#3F113D" : "#72536A" }}
                >
                  {ch}
                </span>
              ))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef } from "react";

const SPACING = 28;
const SIGMA = 150;
const THREE_SIGMA_SQ = (3 * SIGMA) * (3 * SIGMA);
const TWO_SIGMA_SQ = 2 * SIGMA * SIGMA;
const STRENGTH = 0.86;
const LERP = 0.12;

export function MeshFlow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = reducedMotionQuery.matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let cols = 0;
    let rows = 0;
    let restX = new Float32Array(0);
    let restY = new Float32Array(0);
    let dispX = new Float32Array(0);
    let dispY = new Float32Array(0);
    let gVals = new Float32Array(0);

    let targetX = -9999;
    let targetY = -9999;
    let smoothX = -9999;
    let smoothY = -9999;
    let influence = 0;
    let targetInfluence = 0;
    let rafId: number | null = null;

    const rebuildGrid = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      cols = Math.ceil(width / SPACING) + 2;
      rows = Math.ceil(height / SPACING) + 2;
      const count = cols * rows;

      restX = new Float32Array(count);
      restY = new Float32Array(count);
      dispX = new Float32Array(count);
      dispY = new Float32Array(count);
      gVals = new Float32Array(count);

      for (let r = 0; r < rows; r++) {
        const y = (r - 0.5) * SPACING;
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const x = (c - 0.5) * SPACING;
          restX[idx] = x;
          restY[idx] = y;
          dispX[idx] = x;
          dispY[idx] = y;
        }
      }
    };

    const drawStatic = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "rgba(63, 17, 61, 0.07)";
      for (let i = 0; i < restX.length; i++) {
        ctx.beginPath();
        ctx.arc(restX[i], restY[i], 1, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawFrame = () => {
      rafId = null;
      if (document.hidden) return;
      if (reducedMotion) {
        drawStatic();
        return;
      }

      smoothX += (targetX - smoothX) * LERP;
      smoothY += (targetY - smoothY) * LERP;
      influence += (targetInfluence - influence) * LERP;

      const settled =
        Math.abs(targetInfluence - influence) < 0.002 &&
        (influence < 0.002 ||
          (Math.abs(targetX - smoothX) < 0.25 && Math.abs(targetY - smoothY) < 0.25));

      if (influence < 0.002 && targetInfluence === 0) {
        influence = 0;
        drawStatic();
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Faint lime glow under pointer centre
      if (influence > 0.01) {
        const grad = ctx.createRadialGradient(smoothX, smoothY, 0, smoothX, smoothY, SIGMA * 1.4);
        grad.addColorStop(0, `rgba(185, 209, 117, ${0.18 * influence})`);
        grad.addColorStop(1, "rgba(185, 209, 117, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(smoothX, smoothY, SIGMA * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Compute displacements for points within 3*sigma; others stay at rest
      const minC = Math.max(0, Math.floor((smoothX - 3 * SIGMA) / SPACING));
      const maxC = Math.min(cols - 1, Math.ceil((smoothX + 3 * SIGMA) / SPACING) + 1);
      const minR = Math.max(0, Math.floor((smoothY - 3 * SIGMA) / SPACING));
      const maxR = Math.min(rows - 1, Math.ceil((smoothY + 3 * SIGMA) / SPACING) + 1);

      // Draw rest dots outside active box in one batch
      ctx.fillStyle = "rgba(63, 17, 61, 0.07)";
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (r >= minR && r <= maxR && c >= minC && c <= maxC) {
            const dx = smoothX - restX[idx];
            const dy = smoothY - restY[idx];
            const d2 = dx * dx + dy * dy;
            if (d2 <= THREE_SIGMA_SQ) {
              const g = Math.exp(-d2 / TWO_SIGMA_SQ);
              gVals[idx] = g;
              const factor = STRENGTH * influence * g;
              dispX[idx] = restX[idx] + dx * factor;
              dispY[idx] = restY[idx] + dy * factor;
              continue;
            }
          }
          gVals[idx] = 0;
          dispX[idx] = restX[idx];
          dispY[idx] = restY[idx];
          ctx.beginPath();
          ctx.arc(restX[idx], restY[idx], 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Connect neighbouring displaced points within 3*sigma
      ctx.lineWidth = 0.85;
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const idx = r * cols + c;
          const g = gVals[idx];
          if (g <= 0.005) continue;

          const x1 = dispX[idx];
          const y1 = dispY[idx];

          if (c + 1 <= maxC) {
            const right = idx + 1;
            const gR = gVals[right];
            if (gR > 0.005) {
              const alpha = Math.min(0.28, (g + gR) * 0.5 * 0.28 * influence);
              ctx.strokeStyle = `rgba(63, 17, 61, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(dispX[right], dispY[right]);
              ctx.stroke();
            }
          }

          if (r + 1 <= maxR) {
            const down = idx + cols;
            const gD = gVals[down];
            if (gD > 0.005) {
              const alpha = Math.min(0.28, (g + gD) * 0.5 * 0.28 * influence);
              ctx.strokeStyle = `rgba(63, 17, 61, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(dispX[down], dispY[down]);
              ctx.stroke();
            }
          }
        }
      }

      // Draw active dots
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          const idx = r * cols + c;
          const g = gVals[idx];
          if (g <= 0) continue;
          const alpha = 0.07 + g * influence * 0.48;
          const radius = 1 + g * influence * 1.45;
          ctx.fillStyle = `rgba(63, 17, 61, ${alpha})`;
          ctx.beginPath();
          ctx.arc(dispX[idx], dispY[idx], radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (!settled) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    const scheduleFrame = () => {
      if (reducedMotion || document.hidden) return;
      if (rafId === null) {
        rafId = requestAnimationFrame(drawFrame);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (reducedMotion) return;
      if (smoothX < -1000) {
        smoothX = e.clientX;
        smoothY = e.clientY;
      }
      targetX = e.clientX;
      targetY = e.clientY;
      targetInfluence = 1;
      scheduleFrame();
    };

    const onPointerLeave = () => {
      targetInfluence = 0;
      scheduleFrame();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (reducedMotion || e.touches.length === 0) return;
      const touch = e.touches[0];
      if (smoothX < -1000) {
        smoothX = touch.clientX;
        smoothY = touch.clientY;
      }
      targetX = touch.clientX;
      targetY = touch.clientY;
      targetInfluence = 1;
      scheduleFrame();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (reducedMotion || e.touches.length === 0) return;
      const touch = e.touches[0];
      targetX = touch.clientX;
      targetY = touch.clientY;
      targetInfluence = 1;
      scheduleFrame();
    };

    const onTouchEnd = () => {
      targetInfluence = 0;
      scheduleFrame();
    };

    const onVisibilityChange = () => {
      if (document.hidden && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      } else if (!document.hidden) {
        scheduleFrame();
      }
    };

    const onReducedMotionChange = (e: MediaQueryListEvent) => {
      reducedMotion = e.matches;
      if (reducedMotion && rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      drawStatic();
    };

    rebuildGrid();
    drawStatic();

    const ro = new ResizeObserver(() => {
      rebuildGrid();
      drawStatic();
    });
    ro.observe(document.documentElement);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    reducedMotionQuery.addEventListener("change", onReducedMotionChange);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}

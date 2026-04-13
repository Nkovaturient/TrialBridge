"use client";

import { useEffect, useRef } from "react";

const NODE_COUNT = 60;
const MAX_DIST = 160;

export default function LandingCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0;
    let H = 0;
    let nodes: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      pulse: number;
    }>;
    let frame = 0;

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }

    function initNodes() {
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.8 + 0.6,
        pulse: Math.random() * Math.PI * 2,
      }));
    }

    function draw() {
      ctx!.clearRect(0, 0, W, H);

      const g1 = ctx!.createRadialGradient(W * 0.15, H * 0.2, 0, W * 0.15, H * 0.2, H * 0.55);
      g1.addColorStop(0, "rgba(0,229,200,0.045)");
      g1.addColorStop(1, "transparent");
      ctx!.fillStyle = g1;
      ctx!.fillRect(0, 0, W, H);

      const g2 = ctx!.createRadialGradient(W * 0.88, H * 0.75, 0, W * 0.88, H * 0.75, H * 0.45);
      g2.addColorStop(0, "rgba(0,100,255,0.03)");
      g2.addColorStop(1, "transparent");
      ctx!.fillStyle = g2;
      ctx!.fillRect(0, 0, W, H);

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        n.x += n.vx;
        n.y += n.vy;
        n.pulse += 0.018;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;

        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j]!;
          const dx = m.x - n.x;
          const dy = m.y - n.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.18;
            ctx!.beginPath();
            ctx!.moveTo(n.x, n.y);
            ctx!.lineTo(m.x, m.y);
            ctx!.strokeStyle = `rgba(0,229,200,${alpha})`;
            ctx!.lineWidth = 0.6;
            ctx!.stroke();
          }
        }

        const pAlpha = 0.5 + 0.5 * Math.sin(n.pulse);
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r * (0.9 + 0.2 * pAlpha), 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(0,229,200,${0.3 + 0.25 * pAlpha})`;
        ctx!.fill();
      }

      frame = requestAnimationFrame(draw);
    }

    resize();
    initNodes();
    draw();

    const onResize = () => {
      resize();
      initNodes();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      id="bg-canvas"
      className="tb-landing-canvas"
      aria-hidden
    />
  );
}

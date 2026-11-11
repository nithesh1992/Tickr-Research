import React, { useEffect, useRef } from 'react';

export function PulsatingDotsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth * window.devicePixelRatio;
        canvas.height = parent.clientHeight * window.devicePixelRatio;
        canvas.style.width = `${parent.clientWidth}px`;
        canvas.style.height = `${parent.clientHeight}px`;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      }
    };

    window.addEventListener('resize', resize);
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }
    resize();

    const draw = () => {
      time += 0.012; // Calm, subtle breathing cadence
      const parent = canvas.parentElement;
      if (!parent) return;

      const width = parent.clientWidth;
      const height = parent.clientHeight;

      ctx.clearRect(0, 0, width, height);

      const spacing = 36;
      const cols = Math.ceil(width / spacing);
      const rows = Math.ceil(height / spacing);

      const centerX = width / 2;
      const centerY = height * 0.35;
      const maxDist = Math.max(width, height) * 0.75;

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing + spacing / 2;
          const y = j * spacing + spacing / 2;

          const dx = x - centerX;
          const dy = y - centerY;
          const distRatio = Math.min(1, Math.hypot(dx, dy) / maxDist);

          const phase = i * 0.18 + j * 0.18 - time;
          const wave = (Math.sin(phase) + 1) * 0.5;

          const radialFade = 1 - distRatio * 0.65;
          const opacity = Math.max(0.02, (0.04 + wave * 0.1) * radialFade);
          const radius = 1 + wave * 0.35;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(214, 211, 202, ${opacity})`;
          ctx.fill();
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Subtle ambient architectural radial glows */}
      <div
        className="absolute -top-48 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full opacity-20 blur-[130px]"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.35) 0%, rgba(212, 175, 55, 0.12) 50%, transparent 80%)',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

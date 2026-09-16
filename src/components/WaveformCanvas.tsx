// WaveformCanvas v2 — Philips IntelliVue style
import React, { useRef, useEffect, useCallback } from 'react';

interface WaveformCanvasProps {
  buffer: number[];
  color: string;
  label: string;
  unit?: string;
  currentValue?: string;
  height?: number;
  fillColor?: string;
  critical?: boolean;
  gridColor?: string;
  showGrid?: boolean;
}

const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  buffer,
  color,
  label,
  unit,
  currentValue,
  height = 120,
  fillColor,
  critical = false,
  showGrid = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const blinkRef = useRef<boolean>(true);
  const blinkTimerRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    // Philips-style dark background
    ctx.fillStyle = '#000810';
    ctx.fillRect(0, 0, W, H);

    // Grid — subtle green tint like real monitors
    if (showGrid) {
      const gridCol = 'rgba(0,180,80,0.07)';
      ctx.strokeStyle = gridCol;
      ctx.lineWidth = 0.5;
      // Major grid every 50px
      for (let x = 0; x < W; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      // Minor grid every 10px (lighter)
      ctx.strokeStyle = 'rgba(0,180,80,0.03)';
      for (let x = 0; x < W; x += 10) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
    }

    if (buffer.length < 2) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const visible = buffer.slice(-W);
    const min = Math.min(...visible);
    const max = Math.max(...visible);
    const range = max - min || 1;
    const pad = 0.12;
    const normalize = (v: number) =>
      H - ((v - min) / range) * H * (1 - 2 * pad) - H * pad;

    // Glow effect — draw wide dim line first
    if (!critical || blinkRef.current) {
      ctx.beginPath();
      ctx.strokeStyle = color + '28';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 0; i < visible.length; i++) {
        if (i === 0) ctx.moveTo(i, normalize(visible[i]));
        else ctx.lineTo(i, normalize(visible[i]));
      }
      ctx.stroke();

      // Fill
      if (fillColor && visible.length > 1) {
        ctx.beginPath();
        ctx.moveTo(0, normalize(visible[0]));
        for (let i = 1; i < visible.length; i++) ctx.lineTo(i, normalize(visible[i]));
        ctx.lineTo(visible.length - 1, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
      }

      // Main sharp line
      ctx.beginPath();
      ctx.strokeStyle = critical && !blinkRef.current ? 'rgba(255,60,60,0.4)' : color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      for (let i = 0; i < visible.length; i++) {
        if (i === 0) ctx.moveTo(i, normalize(visible[i]));
        else ctx.lineTo(i, normalize(visible[i]));
      }
      ctx.stroke();
    }

    // Sweep line (scanning dot)
    if (visible.length > 0) {
      const lx = visible.length - 1;
      const ly = normalize(visible[visible.length - 1]);
      // Dark eraser ahead of sweep
      ctx.fillStyle = '#000810';
      ctx.fillRect(lx + 1, 0, 18, H);
      // Bright dot
      ctx.beginPath();
      ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [buffer, color, fillColor, critical, showGrid]);

  useEffect(() => {
    if (critical) {
      blinkTimerRef.current = window.setInterval(() => {
        blinkRef.current = !blinkRef.current;
      }, 500);
    }
    return () => clearInterval(blinkTimerRef.current);
  }, [critical]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width  = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-sm" style={{ height, background: '#000810' }}>
      {/* Label top-left — Philips style */}
      <div className="absolute top-1 left-2 z-10 flex items-center gap-2 pointer-events-none">
        <span className="text-[9px] font-bold uppercase tracking-[0.15em] opacity-80" style={{ color }}>
          {label}
        </span>
      </div>

      {/* Value top-right — large numeric display */}
      {currentValue && (
        <div className="absolute top-0.5 right-2 z-10 text-right pointer-events-none">
          <span
            className={`font-mono font-bold leading-none ${critical ? 'animate-pulse' : ''}`}
            style={{ color, fontSize: '1.5rem', textShadow: `0 0 12px ${color}80` }}
          >
            {currentValue}
          </span>
          {unit && (
            <span className="block text-[8px] text-right opacity-50" style={{ color }}>
              {unit}
            </span>
          )}
        </div>
      )}

      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export default WaveformCanvas;

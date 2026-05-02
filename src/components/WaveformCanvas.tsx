// WaveformCanvas — Canvas-рендер кривих у реальному часі
import React, { useRef, useEffect, useCallback } from 'react';

interface WaveformCanvasProps {
  buffer: number[];         // буфер даних
  color: string;            // колір лінії (hex або css)
  label: string;            // підпис кривої
  unit?: string;            // одиниця виміру
  currentValue?: string;    // поточне значення (праворуч)
  height?: number;
  speed?: number;           // швидкість прокрутки (px/frame)
  fillColor?: string;       // колір заливки під кривою
  critical?: boolean;       // мигання при критичному стані
  gridColor?: string;
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
  gridColor = 'rgba(255,255,255,0.04)',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const positionRef = useRef<number>(0);
  const blinkRef = useRef<boolean>(true);
  const blinkTimerRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Очистка
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // Сітка
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    if (buffer.length < 2) return;

    // Нормалізація буфера
    const visible = buffer.slice(-W);
    const min = Math.min(...visible);
    const max = Math.max(...visible);
    const range = max - min || 1;

    const normalize = (v: number) => H - ((v - min) / range) * (H * 0.8) - H * 0.1;

    // Заливка
    if (fillColor && visible.length > 1) {
      ctx.beginPath();
      ctx.moveTo(0, normalize(visible[0]));
      for (let i = 1; i < visible.length; i++) {
        ctx.lineTo(i, normalize(visible[i]));
      }
      ctx.lineTo(visible.length - 1, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    // Крива
    ctx.beginPath();
    ctx.strokeStyle = critical && !blinkRef.current ? 'rgba(255,0,0,0.3)' : color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    for (let i = 0; i < visible.length; i++) {
      const x = i;
      const y = normalize(visible[i]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // "Голова" сканера — яскравіша точка
    if (visible.length > 1) {
      const lastX = visible.length - 1;
      const lastY = normalize(visible[visible.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [buffer, color, fillColor, critical, gridColor]);

  // Blink timer для critical
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

  // Resize observer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width = entry.contentRect.width;
        canvas.height = entry.contentRect.height;
      }
    });
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="relative w-full bg-black rounded border border-gray-800 overflow-hidden" style={{ height }}>
      {/* Підпис */}
      <div className="absolute top-1.5 left-2 z-10 flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
          {label}
        </span>
      </div>

      {/* Поточне значення */}
      {currentValue && (
        <div
          className={`absolute top-1 right-2 z-10 font-mono font-bold text-xl leading-none ${critical ? 'animate-pulse' : ''}`}
          style={{ color }}
        >
          {currentValue}
          {unit && <span className="text-[10px] ml-1 text-gray-500">{unit}</span>}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default WaveformCanvas;

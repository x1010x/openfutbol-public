import { useEffect, useRef, useState } from 'react';
import { Application } from 'pixi.js';
import type { MatchTimeline } from '../types/match';
import { SPEED_OPTIONS, SPEED_FACTORS, CANVAS_W, CANVAS_H } from './layout';
import { buildScene } from './renderer';
import { updateScene } from './animator';

interface Match2DProps {
  timeline: MatchTimeline;
  homeTeamName?: string;
  awayTeamName?: string;
  // Game-time multiplier (game-ms per real-ms). When set, playback auto-starts
  // at this factor so the full 90' lands in the caller's chosen real duration
  // (factor = 90 / realMinutes). The Nx buttons still override it manually.
  initialSpeed?: number;
  onClose: () => void;
}

export function Match2D({ timeline, homeTeamName = 'Real Madrid', awayTeamName = 'Barcelona', initialSpeed, onClose }: Match2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const minuteRef = useRef<HTMLSpanElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);
  const speedRef = useRef<number>(0); // 0 = paused
  // Last non-zero speed, used by pause/resume. Defaults to the duration-derived
  // factor when provided, else the slowest manual preset.
  const playSpeedRef = useRef<number>(initialSpeed ?? SPEED_FACTORS[1]);
  const [displaySpeed, setDisplaySpeed] = useState<number>(1);
  // Auto-play when a duration-derived speed was provided, else start paused.
  const autoPlay = initialSpeed != null && initialSpeed > 0;
  const [isPaused, setIsPaused] = useState<boolean>(!autoPlay);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    speedRef.current = autoPlay ? playSpeedRef.current : 0;

    let alive = true;
    const app = new Application();

    (async () => {
      try {
        await app.init({
          canvas,
          width: CANVAS_W,
          height: CANVAS_H,
          background: 0x000000,
          antialias: false,
          roundPixels: true,
        });
        if (!alive) { app.destroy(true, { children: true }); return; }

        const scene = await buildScene(app, timeline, () => alive);
        if (!scene || !alive) { if (app.renderer) app.destroy(true, { children: true }); return; }

        app.ticker.add((ticker) => {
          updateScene(scene, ticker, {
            speedRef,
            homeTeamName,
            awayTeamName,
            logsRef,
            scoreRef,
            minuteRef,
          });
        });
      } catch (e) {
        console.error('[Match2D] init error:', e);
      }
    })();

    return () => {
      alive = false;
      if (app.renderer) app.destroy(true, { children: true });
    };
    // Scene is rebuilt only when the timeline changes; team names / autoPlay are
    // read once at mount and intentionally excluded to avoid tearing down Pixi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeline]);

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-50">
      <div className="bg-vga-blue border-2 border-vga-white px-6 py-1 mb-2 flex items-center gap-6">
        <span className="text-vga-light-red text-[10px] w-28 text-right">{homeTeamName}</span>
        <span ref={scoreRef} className="text-vga-yellow text-[14px] font-bold w-12 text-center">0 - 0</span>
        <span className="text-vga-light-cyan text-[10px] w-28 text-left">{awayTeamName}</span>
        <span ref={minuteRef} className="text-vga-gray text-[8px] ml-4">0'</span>
      </div>
      <canvas ref={canvasRef} className="block" style={{ imageRendering: 'pixelated' }} />

      {/* Controles en el lateral izquierdo */}
      <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[60] bg-vga-black/80 p-3 border border-vga-gray">
        <button
          onClick={() => {
            if (isPaused) {
              speedRef.current = playSpeedRef.current;
              setIsPaused(false);
            } else {
              speedRef.current = 0;
              setIsPaused(true);
            }
          }}
          className={`text-[10px] px-4 py-2 border ${isPaused ? 'bg-vga-green text-vga-bright-white border-vga-white' : 'bg-vga-yellow text-vga-black border-vga-white'}`}
        >
          {isPaused ? 'REANUDAR' : 'PAUSA'}
        </button>

        <div className="flex flex-col gap-1">
          <span className="text-vga-gray text-[8px] mb-1 text-center">VEL:</span>
          {SPEED_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => {
                setDisplaySpeed(s);
                playSpeedRef.current = SPEED_FACTORS[s];
                if (!isPaused) speedRef.current = SPEED_FACTORS[s];
              }}
              className={`text-[8px] px-3 py-1 border ${displaySpeed === s ? 'bg-vga-yellow text-vga-black border-vga-white' : 'bg-vga-blue text-vga-white border-vga-gray hover:border-vga-white'}`}
            >
              {s}x
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="bg-vga-red text-vga-bright-white text-[10px] px-4 py-2 border border-vga-bright-white hover:bg-vga-light-red"
        >
          CERRAR
        </button>
      </div>

      {/* Log de Eventos en el lateral derecho */}
      <div className="fixed right-4 top-1/2 -translate-y-1/2 w-48 h-64 flex flex-col z-[60] bg-vga-black/80 border border-vga-gray overflow-hidden">
        <div className="bg-vga-blue border-b border-vga-gray p-1 text-center">
          <span className="text-vga-white text-[8px] uppercase">Eventos</span>
        </div>
        <div ref={logsRef} className="flex-1 p-2 overflow-y-auto scrollbar-hide flex flex-col justify-start">
        </div>
      </div>
    </div>
  );
}

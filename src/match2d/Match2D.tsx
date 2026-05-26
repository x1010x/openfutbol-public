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
    <div className="fixed inset-0 bg-black flex flex-col items-center z-50 overflow-auto p-2 gap-2">
      {/* Marcador */}
      <div className="bg-vga-blue border-2 border-vga-white px-6 py-1 flex items-center gap-6 shrink-0">
        <span className="text-vga-light-red text-[10px] w-28 text-right">{homeTeamName}</span>
        <span ref={scoreRef} className="text-vga-yellow text-[14px] font-bold w-12 text-center">0 - 0</span>
        <span className="text-vga-light-cyan text-[10px] w-28 text-left">{awayTeamName}</span>
        <span ref={minuteRef} className="text-vga-gray text-[8px] ml-4">0'</span>
      </div>

      {/* Campo + controles compactos al lateral. El campo se escala al alto del
          viewport para que nunca se recorten los porteros en monitores bajos. */}
      <div className="flex items-start justify-center gap-2 shrink-0">
        <canvas
          ref={canvasRef}
          className="block"
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Controles de velocidad — columna estrecha a la derecha */}
        <div className="flex flex-col gap-2 z-[60] bg-vga-black/80 p-1.5 border border-vga-gray self-center">
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
            className={`text-[7px] px-2 py-1.5 border ${isPaused ? 'bg-vga-green text-vga-bright-white border-vga-white' : 'bg-vga-yellow text-vga-black border-vga-white'}`}
          >
            {isPaused ? '►' : 'II'}
          </button>

          <div className="flex flex-col gap-0.5">
            <span className="text-vga-gray text-[6px] text-center">VEL</span>
            {SPEED_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => {
                  setDisplaySpeed(s);
                  playSpeedRef.current = SPEED_FACTORS[s];
                  if (!isPaused) speedRef.current = SPEED_FACTORS[s];
                }}
                className={`text-[7px] w-7 py-0.5 border ${displaySpeed === s ? 'bg-vga-yellow text-vga-black border-vga-white' : 'bg-vga-blue text-vga-white border-vga-gray hover:border-vga-white'}`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="text-[7px] px-2 py-1.5 bg-vga-red text-vga-bright-white border border-vga-bright-white hover:bg-vga-light-red"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Log de eventos — debajo del campo, a lo ancho */}
      <div className="w-full max-w-[78vw] flex flex-col z-[60] bg-vga-black/80 border border-vga-gray overflow-hidden shrink-0" style={{ height: '16vh' }}>
        <div className="bg-vga-blue border-b border-vga-gray px-2 py-0.5">
          <span className="text-vga-white text-[8px] uppercase">Eventos</span>
        </div>
        <div ref={logsRef} className="flex-1 px-2 py-1 overflow-y-auto scrollbar-hide flex flex-col justify-start">
        </div>
      </div>
    </div>
  );
}

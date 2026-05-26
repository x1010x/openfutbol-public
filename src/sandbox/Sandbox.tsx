import { useState } from 'react';
import { Match2D } from '../match2d/Match2D';
import { simulateFromState } from '../engine/zoneEngine';
import type { MatchTimeline } from '../types/match';
import { SCENARIOS, SCENARIOS_BY_ID, SCENARIO_GROUPS } from './scenarios';

export function Sandbox() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [seed, setSeed] = useState(1);
  const [timeline, setTimeline] = useState<MatchTimeline | null>(null);

  const scenario = SCENARIOS_BY_ID.get(scenarioId)!;

  const run = () => {
    const state = scenario.build(seed);
    setTimeline(simulateFromState(state, scenario.durationMs, seed));
  };

  const exit = () => { window.location.hash = ''; };

  if (timeline) {
    return (
      <Match2D
        timeline={timeline}
        homeTeamName="Locales"
        awayTeamName="Visitantes"
        onClose={() => setTimeline(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-vga-black p-6 flex flex-col items-center">
      <header className="w-full max-w-3xl mb-6">
        <div className="bg-vga-blue border-4 border-vga-white p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between">
          <h1 className="text-vga-yellow text-lg tracking-widest font-bold">SANDBOX</h1>
          <button
            onClick={exit}
            className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
          >
            VOLVER AL JUEGO
          </button>
        </div>
      </header>

      <div className="w-full max-w-3xl flex flex-col md:flex-row gap-4">
        <aside className="md:w-72 bg-vga-blue border-4 border-vga-white p-3 max-h-[80vh] overflow-y-auto">
          <h2 className="text-vga-yellow text-xs underline decoration-double mb-3">ESCENARIOS</h2>
          <div className="flex flex-col gap-3">
            {SCENARIO_GROUPS.map(group => (
              <div key={group.label}>
                <h3 className="text-vga-cyan text-[8px] mb-1 uppercase tracking-wider">{group.label}</h3>
                <ul className="flex flex-col gap-1">
                  {group.scenarios.map(s => (
                    <li key={s.id}>
                      <button
                        onClick={() => setScenarioId(s.id)}
                        className={`w-full text-left text-[8px] px-2 py-2 border-2 transition-colors ${
                          scenarioId === s.id
                            ? 'bg-vga-yellow text-vga-black border-vga-bright-white'
                            : 'bg-vga-black text-vga-white border-vga-gray hover:border-vga-light-green'
                        }`}
                      >
                        {s.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <main className="flex-1 bg-vga-blue border-4 border-vga-white p-4 flex flex-col gap-4">
          <div>
            <h2 className="text-vga-yellow text-xs underline decoration-double mb-2">
              {scenario.name}
            </h2>
            <p className="text-vga-white text-[8px] leading-relaxed">
              {scenario.description}
            </p>
            <p className="text-vga-gray text-[7px] mt-2">
              Duración: {(scenario.durationMs / 1000).toFixed(1)}s
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[8px]">
            <span className="text-vga-cyan">SEED:</span>
            <input
              type="number"
              value={seed}
              onChange={e => setSeed(Number(e.target.value) || 0)}
              className="w-24 bg-vga-black border border-vga-gray text-vga-white px-2 py-1"
            />
            <button
              onClick={() => setSeed(s => s + 1)}
              className="bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-light-green"
            >
              SIGUIENTE
            </button>
            <button
              onClick={() => setSeed(Math.floor(Math.random() * 1_000_000_000))}
              className="bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-light-green"
            >
              ALEATORIO
            </button>
          </div>

          <button
            onClick={run}
            className="w-full bg-vga-green hover:bg-vga-light-green text-vga-bright-white py-3 border-b-4 border-r-4 border-vga-black active:border-0 text-sm font-bold"
          >
            EJECUTAR
          </button>
        </main>
      </div>

      <p className="mt-6 text-vga-gray text-[7px] max-w-3xl text-center">
        Cambiá el seed y volvé a ejecutar para obtener un resultado distinto del mismo escenario. Sirve para barrer outcomes sin esperar a que algo pase en un partido real.
      </p>
    </div>
  );
}

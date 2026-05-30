# Handoff — Integración motor 2D ↔ Manager

> Documento de self-handoff. Rama: `feature/engine-integration`. Última sesión: 2026-05-29 (validación B1/B2/B3 OK por el usuario; reconciliación del Bloque 8 + fix de determinismo).
> Objetivo: terminar de integrar el motor de simulación 2D (Pixi) con el manager (PC-Fútbol-like).
> Hay memorias relacionadas: `2d-speed-time-model`, `engine-hardcoded-slots`.
> **Estado de un vistazo**: ver la tabla "📋 ESTADO ACTUAL" al final. Bloques 1,2,3,4,5,6,7,8 ✅ · Bloque 9 🟡 (cálculo + parada de reloj en cambios ✅; falta display "45+X'" del descuento general) · Bugs B1/B2/B3 ✅ (validados por el usuario 2026-05-29; quedan correcciones menores no críticas). **Pendiente principal: validación visual** de B2/B8/B9 nuevos.

> **Sesión 2026-05-29**:
> - El usuario **validó B1/B2/B3** a ojo (OK; quedan ajustes menores no críticos → seguimos avanzando).
> - **Reconciliación**: el Bloque 8 "táctica/formación en vivo" ya estaba cableado end-to-end (el handoff lo daba como ⬜, estaba desactualizado): `AlignmentView` permite drag + cambio de formación también en `ingame` (`draggable={true}`, `handleFormationChange` sin gate), su `onUpdate` apila `tacticalChanges`, y `handle2DContinue` los reinyecta vía `applyFormationChange` (que ya existe en `substitution.ts` y emite evento `'tactic'`). Verificado headless: con jugadores frescos la cabecera pre-cambio es idéntica y el `tactic` se emite en su tick.
> **Sesión 2026-05-29 (cont.) — glitches + mejoras post-validación**:
> - **Issue 1 — el partido se pitaba ~87' sin descuento**: causa = en duraciones comprimidas las ventanas FIJAS (entrada `KICKOFF_INITIAL_TICKS`, walkouts) consumían una fracción grande de cada parte y `toClockMs` mapeaba la 2ª parte a `durationMs` (no al silbato). **Fix**: el motor guarda `fullTimeMs` (instante real del silbato) y `stoppage1Min/2Min` (heurística `calcStoppageMin` en `zoneEngine`, mismo cálculo que el bridge) en el `MatchTimeline`; `toClockMs` (`layout.ts`) mapea `[live1,descanso]→[0',(45+st1)']` y `[live2,fullTimeMs]→[45',(90+st2)']`; el animator muestra "45+X'/90+X'". Verificado (réplica JS, 6' watch): descanso 45', silbato a **90+4'** (antes ~87'). El bridge usa `timeline.stoppageN` para el `MatchState` (coherencia con lo mostrado).
> - **Issue 2 — coreografía de cambios**: el saliente ahora sale por el **túnel central** (norte, como la expulsión) en vez de la banda más próxima; el entrante spawnea cerca del **centro** (spread por slot) y trota a su posición; y **varios cambios ordenados a la vez se ejecutan en una sola secuencia** (batch): `state.subBatch` (sustituye a `subWalkerId/subIncoming/subLog`), `startSubWalkout` toma TODAS las pendientes válidas, `tickSubWalkout` aplica todas y registra **un** `clockFrozenSpan`. `move.ts` usa `isWalker()` (set) para congelar al resto.
> - **Issue 3 — sanción por expulsión (manager)**: el sistema `suspensionMatches` ya existía (roja→2, decremento por jornada, exclusión en pickBestXI/AlignmentView). Faltaba el relleno: `updateLeagueStats` **filtraba** al expulsado dejando hueco (→ arrancar con 10). Nuevo `fillLineupGaps(team, unavailableIds)` (`formations.ts`) reemplaza al expulsado EN SU SLOT por el mejor suplente disponible para esa posición (conserva la estructura posicional); el leagueStore lo llama en vez del filter.
> - **Cambios de la IA (rival)** — nuevo `src/engine/aiSubs.ts` `decideAiSubs(state,tick,total)`: el motor gestiona el banquillo del **oponente** (el usuario sigue con la UI). `MatchState.aiSub: Record<side,{bench,subsUsed,lastSubTick}>` (init en `state.ts` desde `cfg.benches`); `benchEnginePlayers(team)` (managerBridge) mapea los no-titulares aptos a `EnginePlayer` con `role` por posición. Lógica: **lesión** → cambio forzado en la siguiente parada (sin gate de tiempo); **cansancio** → pasada la hora, sustituye al más fundido (mayor caída de `speed` vs su base) por un suplente más fresco y del rol adecuado; **táctico** → si pierde por 2+ tarde, cambia un defensa por un delantero fresco. Tope `MAX_AI_SUBS=3`, espaciado ~6% del partido. Pasa por la misma cola `pendingSubs`/`sub_walkout` (se ve al rival hacer el cambio; batch con los del usuario si coinciden en la parada) y **congela el reloj** igual. **Determinista (0 RNG)** → reproduce la cabecera del Bloque 8. Gated por `opts.aiSubs` (solo `generateTimeline`); el sandbox deja benches vacíos. App (`startWatch2D`/`handle2DContinue`) construye el banquillo del oponente y lo pasa por `benches`, guardándolo en `watch2dRef` para que la regeneración lo reuse idéntico.
> - **Issue 4 — variedad de pases**: en 2v1 el carrier metía el balón recto al defensor central porque `lineFactor` solo bajaba a ~0.68 con un defensor en la línea. **Fix** (`effectors/pass.ts findBestPassTarget`): penalización por carril bloqueado mucho más escarpada (0.15/0.45/0.80 por tramos de `lineThreat.dist`); detección de **pase al espacio** (`throughBall`: receptor corriendo adelante + carril al punto de adelanto libre → exento de la penalización + bonus) y bonus de **cambio de orientación** a un hombre libre cuando el carrier está presionado; `resolvePass` adelanta más el balón (lead 6.5) al desmarque. Determinista (sin RNG nuevo) → la cabecera del Bloque 8 se sigue reproduciendo.
>
> - **🐞 Fix de determinismo (B4)**: `createInitialState` (`state.ts`) reusaba los mismos objetos `EnginePlayer` del llamante (`homePlayers: cfg.homePlayers`), y la sim los **muta** (`foulsCommitted`/`yellowCount`/`redCard`/`injured`; las live changes reasignan `slot/role/tag`). Como la app reusa `inp.homePlayers` en cada regeneración (watch inicial → cada "continuar"), la 2ª corrida arrancaba con jugadores sucios → la cabecera re-simulada **divergía de lo ya visto** (reproducido headless: divergencia a t≈75s con el cambio en t=2.7M). **Fix**: `createInitialState` ahora **clona** los jugadores entrantes (incl. `slot`/`slotOffset`), así ninguna corrida ensucia los arrays del llamante. Verificado: cabecera + keyframes idénticos pre-cambio con arrays compartidos (el escenario real de la app). `tsc`+eslint limpios.

> **Sesión 2026-05-30 — overlays del campo + fix de cambio en set-piece**:
> - **Overlays del sprite del campo** (todo en `match2d/`, sin tocar el motor): (1) **marcador dinámico** en los dos recuadros del banner inferior de `CAMP` (home abajo-izq, away abajo-dcha) con dígitos de **BIGNUM** (16×16); `renderScoreBox` (renderer) repinta en cada gol y en `primeResume`; los recuadros NO se espejan en la 2ª parte (marcador fijo). (2) Indicador de parte: en la 2ª parte se tapa el **"1er"** pintado en `CAMP` con el sprite **"2do"** de `GRAFICOS` (`halfIndicator`, visible cuando `flipped`) → se lee "2do TIEMPO". (3) Overlay **"CAMBIO"** (de `GRAFICOS`) centrado, parpadea ~3s al dispararse un evento `sub` (`cambioOverlay`/`rt.cambioTimer`, mismo patrón que falta/gol). Coordenadas (source px, canvas=×2) en `layout.ts`: cajas `SCORE_BOX_HOME/AWAY`, `HALF_INDICATOR_POS`, rects `SPR_2DO`/`SPR_CAMBIO`. Validado componiendo una maqueta (los 3 caen exactos); `tsc`+eslint+`vite build` limpios. **Pendiente validación visual en Pixi.**
> - **🐞 Fix B-cambio**: al sustituir al **lanzador** de un set-piece interrumpido (falta/saque de banda/córner/saque de puerta), `applySubstitution` anulaba `kickerId` y soltaba el balón → la jugada NO se ejecutaba (alguien cogía el balón suelto y seguía sin sacar). **Fix** (`substitution.ts`): si `state.kickerId === outId`, se **re-elige lanzador** del mismo bando (`pickSetPieceKicker`: el portero para saque de puerta, si no el compañero más cercano al punto), se le pone el balón en el punto y se le hace `carrier`/`ballOwner` → la fase resumida (`subResumePhase`, ya existente) ejecuta el saque. Reproducido y verificado headless (antes: t=16250 "Segundo balón" suelto; después: t=14750 "Falta" pass_forward del nuevo lanzador). El suplente entra trotando desde el túnel (y −0.12→campo) con normalidad. `tsc`+eslint limpios.
>
> **Sesión 2026-05-30 (cont.) — minuto + nombre del carrier + descuento**:
> - **Fuente FUENTE2**: fondo negro (índice 12) + glifos blancos (índice 15), celdas de 8×8, 59 celdas. Layout: celda 15='N', 16-25='0'..'9', 33-58='A'..'Z'. Helper `font2Cell(ch)` + `renderFont(container,text,fontTex,align)` (renderer) + `normalizeFontText` (mayúsculas, sin diacríticos, A-Z/0-9, máx 20). El fondo negro encaja con el banner negro.
> - **Minuto en el campo** (FUENTE2): minuto corrido entero, **alineado a la derecha** justo antes del "min." pintado (`MINUTE_POS` source x=424,y=456). Se repinta solo al cambiar de minuto (`rt.lastMinute`).
> - **Nombre del carrier** (FUENTE2): centrado **encima del recuadro ENERGIA** (`CARRIER_NAME_POS` source x=320,y=453). Se lee de `kfA.ballOwner`→`scene.playerNames` (mapa id→nombre que `App.tsx` construye desde las plantillas de ambos equipos, titulares+banquillo, y pasa por la prop `playerNames`→`buildScene`). Mantiene el último poseedor mientras el balón está suelto/en vuelo (no parpadea por pase).
> - **Marcador DOM eliminado**: la cabecera de `Match2D` ya no pinta el "0 - 0" ni el minuto (ahora van sobre el sprite); solo quedan los nombres con "vs". `scoreRef`/`minuteRef` se conservan (sin nodo) para el ctx del animator, que los ignora si son null.
> - **Escudos + máscara de barras + cabecera fuera** (match2d, remate final): (1) **Escudos** junto a los marcadores, **orientados por partido a favor del usuario**: el equipo del usuario va SIEMPRE en la caja **derecha** (posición "local"), el rival en la izquierda. Por defecto (usuario local) home=dcha/away=izq; cuando el usuario juega de **visitante** se invierte (`flipScoreboard`, derivado de `awayTeam.id === league.userTeamId` en `App.tsx`) → así su equipo (que saca en la parte derecha del campo) queda a la derecha. Constantes neutrales `SCORE_BOX_LEFT/RIGHT` + `CREST_LEFT/RIGHT_POS`; el renderer asigna lado según el flag. Fijo a nivel de partido (no cambia en el descanso). Se cargan las **imágenes reales** de `assets/teams/{teamId}.{png,jpeg,jpg,ico}` (mismo cascadeo que el componente `TeamCrest` del manager) vía `loadImageTexture` (nuevo en `sprites.ts`, canvas→Texture lineal); fallback a una camiseta de dos colores (Graphics) desde los colores del kit. `buildCrest` escala object-contain a `CREST_SIZE`. Usa `timeline.homeTeamId/awayTeamId` (no hacen falta props nuevas). (2) **Máscara de las dos barras azul-oscuro** de "modo interactivo" baked en CAMP (x[146,215] y x[424,493], y[442,447]): se tapan con la barra negra sólida de GRAFICOS (`SPR_BLACK_BAR` x2358,y44,36×16) **redimensionada al 70×6 exacto** de cada barra → solo cubre el azul, el negro funde con el banner. (3) **Cabecera HTML de nombres eliminada**: marcador, minuto, nombre del carrier y escudos ya viven sobre el sprite; `scoreRef`/`minuteRef` se conservan sin nodo. `tsc`+eslint+`vite build` limpios; maqueta integral validada. **Pendiente validación visual en Pixi.**
> - **Barra de ENERGIA del carrier** (match2d): sobre el placeholder rojo de `CAMP` (96×8 source, x[298,393] y[464,471]) se dibuja un **track rojo oscuro** (GRAFICOS x[1176,1271] y[52,59]) + un **relleno rojo claro** (GRAFICOS x[1032,1127] y[52,59]) cuyo `scale.x` el animator ajusta a la energía del carrier. **Modelo (decisión del usuario): la fórmula del manager, no la fatiga del engine 2D**: empieza llena (100%) para todos y baja a `1 − rate·minutosJugados/99`, con `rate = staminaDecayPerMin(físico) = (0.25 + (1−físico/99)·0.15)·staminaDecayMult` (exportada nueva en `simEngine.ts`, **única fuente de verdad** — los dos sitios de desgaste del text-sim la usan). Así la barra **drena en sintonía con la stamina que el manager persiste** a la liga (físico 99 → ~77% a FT, físico 0 → ~60%). Minutos jugados desde **tiempo de motor monótono** `(gt−entryMs)/durationMs·90` (evita el rebote del dip 45+X→45 del descanso); suplentes drenan desde su `entryEngineMs` (de los eventos `sub`). Sigue al carrier como el nombre (mantiene el último al soltarse el balón). **Lesión = barra vacía**: si el carrier tiene un evento `injury` pasado (su `actor`, mapa `injuryMs` en el Scene), la barra se fuerza a **0 (sin el suelo del 5%)** como aviso al usuario de que lo sustituya (la IA ya releva a los suyos sola). `App.tsx` pasa `playerEnergyRate` (rate/99 por id de ambas plantillas) como prop. Validado con maqueta a varios niveles; `tsc`+eslint+`vite build` limpios. **Pendiente validación visual en Pixi.**
> - **🐞 Descuento (B-stoppage)**: (a) **"45 clavado"**: el mapeo viejo (`toClockMs`) comprimía el descuento en `st1/(45+st1)` de la ventana de la 1ª parte → con st1 pequeño el "45+X" sólo se alcanzaba en el instante exacto del pitido (coincide con el flip a 2ª parte) → invisible. **Fix**: se reserva una **fracción fija** `STOPPAGE_DISPLAY_FRAC=0.12` del final de cada parte para la cuenta 45→45+st / 90→90+st (regulación en el 88% inicial). Validado: 1ª parte muestra 45+1,45+2…; 2ª muestra 90+1…90+5. (b) **Fórmula por parte reequilibrada** (`calcStoppageMin` en zoneEngine + `calcStoppage` en bridge): base menos desigual (1 vs 2, antes 1 vs 3), ponderada por eventos de ESA parte — `goals*0.4 + subs*0.4 + injuries*0.6 + reds*1.5 + min(1, fouls*0.06)`, cap 5/8. Una expulsión añade ~1.5 visible (antes una roja sólo +0.3→redondeaba a 0 extra). El término de faltas va capado a 1' para que una parte muy guarrera no dispare el reloj. `tsc`+eslint+`vite build` limpios. **Pendiente validación visual en Pixi.**

---

## 0. Cómo está montado (mapa rápido)

- **Manager UI**: `src/App.tsx` (monolito grande). Tipos en `src/types/game.d.ts` (`Player`, `PlayerStats`, `Team`, `MatchEvent`, `MatchState`).
- **Motor de zona (sim 2D)**: `src/engine/` — entrada `zoneEngine.ts` (`generateTimeline`, `simulateFromState`, interface `EnginePlayer`). Estado en `state.ts`, slots/zonas en `zones.ts`, formaciones en `formations.ts`, fases en `phases/`, decisiones en `decide/`, movimiento en `move/`, efectores (pase/tiro/entrada/falta) en `effectors/`.
- **Puente**: `src/engine/managerBridge.ts` — ÚNICO módulo que conoce ambos mundos. `teamToEnginePlayers(team)` (manager→motor) y `timelineToMatchResult(timeline,...)` (motor→manager).
- **Render 2D**: `src/match2d/` — `Match2D.tsx` (componente React + Pixi), `renderer.ts` (`buildScene`), `animator.ts` (`updateScene` por frame), `layout.ts` (constantes/transformaciones), `palette.ts` + `paletteFilter.ts` (color indexado VGA), `sprites.ts`, `states.ts` (máquina de animación).
- **Sandbox**: `src/sandbox/Sandbox.tsx` — usa `simulateFromState` con escenarios; también monta `Match2D`. NO romper.
- **Tipos de la línea temporal**: `src/types/match.ts` (`MatchTimeline`, `TimelineEvent`, `Keyframe`, `EventKind`).

### Flujo del partido del usuario en 2D
`App.startWatch2D()` (≈línea 1017) → `generateTimeline({...teamToEnginePlayers, durationMs})` → `setTimeline2d(tl)` → render `<Match2D timeline initialSpeed={BASE_SPEED_FACTOR} .../>` (≈línea 2337). Al cerrar, `handleClose2D()` (≈1317) sintetiza un `MatchState` finalizado vía `timelineToMatchResult` y lo pasa por `finalizeMatch`.

### ⚠️ Decisión arquitectónica CENTRAL (afecta bloques 7 y 8)
La línea temporal se **precomputa entera** en `generateTimeline` y luego se reproduce. Eso es incompatible con **cambios en vivo** (sustituciones/tácticas a mitad) y con un **cambio de campo** que dependa del estado en ese instante. Para los bloques 7/8 hay que elegir:
- **(A) Simulación por segmentos**: simular hasta el punto de pausa/descanso, y al reanudar regenerar la cola desde el `MatchState` actual con la nueva alineación/táctica. Requiere exponer/serializar `MatchState` y un `simulateFromState` que continúe (ya existe, recibe `state`). Es la vía recomendada.
- **(B) Simulación interactiva** (tick a demanda desde el render). Más reescritura.
Recomendado: **(A)**. Diseñar `Match2D` para pedir "simula hasta X, devuélveme timeline parcial + estado final" y poder continuar.

---

## 🐞 BUGS (validación visual del usuario — 2026-05-27)

Detectados al probar a ojo lo implementado (bloques 7.b + 8). **B1, B2 y B3 ARREGLADOS** (sesión 2026-05-27, segunda tanda — pendiente revalidación visual del usuario).

### B1 — ✅ ARREGLADO: al volver de "CAMBIOS" el partido no se renderizaba y todo quedaba deshabilitado
**Causa raíz confirmada**: el efecto de `Match2D` dependía de `[timeline]`; su cleanup ejecutaba `app.destroy(true, {children:true})`. El primer argumento `true` **elimina el `<canvas>` del DOM**. Como el `canvasRef` de React seguía apuntando a ese nodo ya desconectado, el nuevo `app.init({canvas})` renderizaba sobre un canvas fuera del documento → 2D en blanco. Y como `setIsPaused(false)` + `app.ticker.add` vivían dentro del efecto async que podía abortarse, los controles quedaban muertos.
- **Fix** (`Match2D.tsx`): se separó en **dos efectos** (la opción robusta del plan):
  - **Efecto 1 (deps `[]`)**: crea el `Application` UNA vez por mount, registra el ticker (que lee `sceneRef.current` cada frame) y marca `appReady`. Solo se destruye en el unmount real (cierre del visor).
  - **Efecto 2 (deps `[timeline, appReady]`)**: reconstruye SOLO la escena al cambiar el timeline, reutilizando app+canvas+ticker. Tira los display objects anteriores (`app.stage.removeChildren().forEach(c => c.destroy({children:true}))`, sin destruir texturas) y hace `buildScene` + `primeResume` + `setIsPaused(false)`. Nunca toca el canvas.

### B2 — ✅ ARREGLADO: el reloj empezaba a contar antes del saque
Ahora el minuto se congela a **0'** hasta el saque inicial y a **45'** durante el descanso + entrada de la 2ª parte.
- **Fix**: se registra el instante (engine `t`) en que el balón entra en juego en cada parte (transición `kickoff_setup→live` de una entrada) en `state.entranceLiveMs` (`phases/kickoff.ts tickKickoffSetup`, solo cuando `kickoffEntrance`), se expone en `MatchTimeline.entranceLiveMs` (`zoneEngine.ts` + `types/match.ts`), y el animator usa una nueva **`toClockMs(t, timeline, halfTimeMs)`** (`layout.ts`) que remapea por tramos: `0` hasta `live1`; `[live1, halfTime]→[0',45']`; `45'` durante el descanso; `[live2, durationMs]→[45',90']`. Fallback al remap lineal cuando no hay `nominalMatchMs`/marcas (sandbox). El log usa la misma función → coherente con el reloj.
- Verificado headless: `entranceLiveMs=[7500, 2037000]` en un 90' (half_time=2025000).
- **Nota / desbloqueo parcial Bloque 9**: el reloj YA es no-lineal con frontera de parte. El display "45+X'/90+X'" sigue ⬜ porque el motor no tiene una noción de "fin del tiempo reglamentario vs descuento" (el medio tiempo cae exacto en `halfTimeMs`→45'); habría que reservar parte del tiempo de motor como descuento. El valor del descuento ya se calcula en `MatchState.stoppageTime1/2` (Bloque 9).

### B3 — ✅ ARREGLADO: los jugadores entraban desde norte Y sur; ahora entran TODOS desde el norte
- **Fix** (`phases/kickoff.ts` branch `teleport`): los 22 spawnean en `{ x: 0.5 + (slot.x-0.5)*0.4, y: -0.30 }` — todos fuera por el **norte**, embudados cerca del centro en x (spread suave por slot para que no se enreden), y `applyKickoffForces` los reparte a sus slots. El clamp vertical se relajó a `yMin=-0.40` durante `kickoff_setup && kickoffEntrance` (`move.ts`).
- **Distancia**: como un slot sur cruza casi todo el campo, se subió el boost de entrada a `MAX_SPEED=0.07` (separado del walkout que sigue en 0.05) y `KICKOFF_INITIAL_TICKS` 18→**30**. Verificado headless: kf0 con los 22 en `y=-0.30`, `x∈[0.302,0.698]`; tras la ventana, 22/22 dentro del campo.
- **Suplente unificado** (`substitution.ts`): spawnea siempre por el norte (`offY=-0.12`, antes por banda cercana); el clamp de juego vivo lo deja en la banda norte y el spring off-ball lo mete a su slot.
- ⚠️ **Determinismo**: subir `KICKOFF_INITIAL_TICKS` a 30 vuelve a desplazar el consumo de RNG del arranque → el "guion" exacto del partido cambia respecto a sesiones previas (sim seed-based igualmente válida, no es regresión).

---

## 1. ✅ HECHO — Velocidad + tiempo + layout

Modelo confirmado con el usuario (ver memoria `2d-speed-time-model`):
- **1x = factor fijo 0,75** (ritmo cómodo), NO derivado de la duración. `SPEED_FACTORS` en `layout.ts`: 1x=0,75 · 2x=1,5 · 4x=3,0 · 8x=6,0. (Se quitó 16x.)
- **La duración elegida fija la longitud de la línea temporal del motor**: `engineDurationMs(min) = min*60000*0,75`. A 1x el partido dura esos minutos reales; subir velocidad lo acorta.
- **El minuto 0–90′ es cosmético**: `toDisplayMs(t, durationMs, nominalMatchMs)`; `nominalMatchMs` solo lo pone `generateTimeline` (90′). Sandbox lo deja sin poner → muestra tiempo crudo.
- **NO escalar tasas de eventos**: el motor ya está calibrado para pocos goles en duraciones cortas. Una línea corta = menos jugadas; subir velocidad solo lo muestra antes.

Archivos tocados: `layout.ts` (factores + helpers), `zoneEngine.ts` (`generateTimeline` acepta `durationMs`, marca `nominalMatchMs`), `animator.ts` (remap minuto en reloj + log), `managerBridge.ts` (remap minuto en stats/resultado), `types/match.ts` (campo `nominalMatchMs`), `App.tsx` (`durationMs` + `initialSpeed=BASE_SPEED_FACTOR`).

Layout `Match2D.tsx`: campo a **tamaño nativo** (1280×960), contenedor `overflow-auto` (scroll si no cabe), controles de velocidad **compactos** en columna a la derecha, **log debajo del campo** (ya no solapa).

**Pendiente menor**: validación visual en el monitor del usuario (no se pudo probar Pixi headless). Confirmar que el scroll va bien.

---

## 2. 🟡 PARCIAL — Stats del motor (goalkeeping ✅ + stamina inicial ✅ + decaimiento ⬜)

**Objetivo**: que las stats que recoge el manager repercutan en el juego; inyectar las que faltan y decidir el efecto de las que el motor no contempla.

**✅ HECHO — stamina (escalado inicial)** (sesión 2026-05-27):
- En `teamToEnginePlayers` (`managerBridge.ts`): factor de forma física pre-partido `fitness = 0.85 + 0.15*(stamina/99)` (99→×1.0, 1→×0.85, defaultea a fit si el campo falta). Escala SOLO `speed` y `physical` del `EnginePlayer` (lo atlético; los stats técnicos son ~independientes de la fatiga, como dice el handoff). Es forma de LLEGADA al partido, no decaimiento en vivo (el motor precomputa → el decaimiento real es del Bloque 8).
- Verificado `tsc`+eslint limpios; sanity headless (8 partidos fresco 99 vs cansado 40): el efecto es **modesto y direccional** (el fresco gana en goles; la posesión queda en ruido con pocas muestras). Intencionado: forma física ≠ stat grande. **Pendiente validación** con datos reales de stamina variada.
- `media`/edad NO se inyectan al motor: ya influyen en `media` del manager y el motor usa stats individuales, no la media.

**✅ HECHO — goalkeeping** (sesión 2026-05-27):
- `goalkeeping` añadido a `EnginePlayer` (`zoneEngine.ts`) y mapeado en `teamToEnginePlayers` (`managerBridge.ts`). Sandbox `presets.ts` actualizado (POR 80, def 12, mid 8, del 5) para no romper compile.
- `ballPhysics.ts`: `catchProb` (atrapar a dos manos) usa `p.goalkeeping` en vez de `p.defending`; `diveReach` (radio de estirada) escala con el stat: `0.066 + 0.032*(gk/99)` (~0.072 a 30 → ~0.098 a 99).
- `move/gk.ts`: ganancia de reacción en estirada on-target escala con el stat: `0.24 + 0.16*(gk/99)` (~0.29 a 30 → ~0.40 a 99) → buen portero llega a más tiros.
- Verificado `npx tsc -b` limpio. **Pendiente validación visual** (portero bueno vs malo debe parar más).

**✅ HECHO — decaimiento de stamina en vivo** (sesión 2026-05-29):
- Nuevo `src/engine/fatigue.ts` `applyFatigue(state, tick, totalTicks)`: escala `speed`/`physical` efectivos de cada jugador por el tiempo que lleva en el campo y su **aguante**, lineal con la fracción de partido jugada. Los stats técnicos no se tocan (la habilidad aguanta, las piernas no).
- **Driver del ritmo de fatiga = combinación 50/50** (decisión del usuario): el **físico** (`enduranceBase` = `stats.physical` crudo, aguante permanente) modulado por la **frescura del día** (`stamina`, condición actual). `endurance = 0.5*físico + 0.5*stamina`; `maxDrop(endurance)=0.06+0.16*(1-endurance/99)` (99 → -6% a FT; 0 → -22%). Verificado: físico90/fresco99 -6.7%, físico90/cansado30 -12.3%, físico30/fresco99 -11.6%, físico30/cansado30 -17.2% → el físico manda, la frescura modula. **Ojo conceptual**: `stamina` (1-99, resetea a 99 cada temporada, baja al jugar, se recupera entre partidos) es la CONDICIÓN actual, no el físico; el físico es `stats.physical` (atributo fijo). La condición actual ya gobierna también la forma de LLEGADA (`engineStatsFromPlayer fitness=0.85+0.15*stamina/99`).
- **Auto-inicializante por jugador**: la 1ª vez que ve a un jugador captura su `speed`/`physical` (ya escalados de llegada) como base de decaimiento y registra `enteredTick`. Así los **suplentes cansan desde su propio reloj** (un suplente que entra al min 70 está casi fresco) SIN tocar `applySubstitution`. Campos `stamina?/baseSpeed?/basePhysical?/enteredTick?` añadidos a `EnginePlayer`.
- **Determinista** (no consume RNG) → no desplaza el "guion"; la re-simulación del Bloque 8 reproduce la cabecera idéntica. **Gated por `opts.fatigue`** (solo lo pone `generateTimeline`); el sandbox llama `simulateFromState` sin el flag → escenarios byte-for-byte intactos.
- `engineStatsFromPlayer` (`managerBridge.ts`) ahora propaga la `stamina` cruda al `EnginePlayer` (el `speed`/`physical` que devuelve es la forma de LLEGADA; la stamina es el driver del ritmo de decaimiento).
- Verificado headless: decaimiento direccional (99: -6%, 20: -18.8% a FT); suplente fresco 70.0 > titular cansado 62.4 al min ~70; cabecera idéntica pre-sub con arrays compartidos; sandbox sin cambios; agregado 12 partidos fresco(95) 482 goles vs cansado(30) 271. `tsc`+eslint limpios. **Pendiente validación visual**.
- **Nota**: sin recuperación en el descanso (decaimiento monótono sobre el partido completo). Si se quiere, `applyFatigue` podría restar una fracción al pasar el medio tiempo.

**Verificación**: comparar resultados con porteros buenos vs malos; un portero con `goalkeeping` alto debe parar más.

---

## 3. ✅ HECHO — Colores reales + estilo de camiseta

**Objetivo**: colorear a los jugadores con los colores reales del equipo y elegir camiseta lisa / a rayas / con franja.

**✅ HECHO** (sesión 2026-05-27):
- **Hallazgo clave**: el mapeo de color es el MISMO para los 3 estilos (comparando `KIT_MADRID` liso vs `KIT_BARCA` rayas). Lo único que cambia es el sprite PNG. Índices de "tela": primario→{2,3,5,6,7} (dark/light), secundario→{10,11}; resto identidad (1 piel, 4, 8/9, 12 negro, 13 sombra, 14/15 trim).
- Nuevo `src/match2d/kit.ts`: `buildKitPalette(colors)` (hex→shade más cercano en `BASE_PAL`, tabla `SHADES` blanco/negro/azul/rojo/verde/amarillo/naranja/púrpura) y `spriteForStyle(style)` (solid→JUGALISO, stripes→JUGARAYA, sash→JUGARAYO).
- `renderer.ts buildScene` acepta `kits?: SceneKits` ({home/away: {colors, style}}); sin kits → fallback Madrid/Barca. Carga el sprite+paleta elegidos por equipo (mismo atlas JSON para los 3). Porteros siguen con `KIT_GK`/`KIT_GK_AWAY`.
- `Match2D` props `homeColors/awayColors/homeKitStyle/awayKitStyle`; App los pasa desde `team.colors`/`team.kitStyle`.
- Tipo: añadido `kitStyle?: 'solid'|'stripes'|'sash'` a `Team` (decisión del usuario: campo opcional, por defecto liso). `npx tsc -b` + eslint limpios.

**Pendiente menor**: (1) **validación visual** (no se pudo probar Pixi headless). (2) Ningún equipo trae `kitStyle` en los datos todavía → todos lisos; cuando se rellene en la BD hay que mapearlo en `mockTeams.ts` (hoy solo mapea `colors`).

### 3.b ✅ HECHO — Equipación de VISITANTE (anti-clash) — pedido del usuario

**Regla (clave, según el usuario)**: un equipo NO lleva la camiseta principal **solo** cuando se cumplen LAS DOS condiciones: (a) juega **de visitante** Y (b) su color principal es **parecido** al del equipo local. Si no hay parecido, ambos visten su equipación principal normal. El local SIEMPRE usa la principal.

**✅ HECHO** (sesión 2026-05-27) — opción (a) **derivar en caliente**, solo render, datos intactos:
- Nuevo `resolveAwayKit(homeColors, awayColors, awayStyle)` en `kit.ts`. **Clash** = el shirt local y el visitante resuelven al **mismo índice oscuro** de la paleta (`nearestShade(...).dark`), no por hex crudo: dos azules que cuantizan al mismo índice VGA se ven iguales en pantalla. Comparar por `dark` (no por identidad de SHADE) también pilla casos como rojo-vs-naranja (distinto SHADE, mismo `dark=8`).
- Si hay clash → viste al visitante con el SHADE cuyo RGB está **más lejos** del shirt local (saltando los que comparten su `dark`, para que sea realmente distinguible); devuelve `colors:[hex,hex]` manteniendo el `kitStyle`. Si NO hay clash → devuelve el away normal. El local nunca se toca (el caller solo reescribe las props del away).
- `App.tsx` (render `<Match2D>`): calcula `resolveAwayKit` y pasa el resultado a `awayColors`/`awayKitStyle`. No modifica `team.colors`.
- Verificado `tsc -b` + eslint(kit.ts) limpios; sanity de la lógica (blanco↔casi-blanco→negro, azul↔azul→amarillo, rojo↔naranja→azul, sin clash conserva el color). **Pendiente validación visual** (Pixi headless no testeable).
- **Nota**: con `[hex,hex]` el patrón de rayas degrada a liso (los 2 colores de raya coinciden) — aceptable para una alternativa legible. Si se quiere conservar rayas reales, habría que derivar 2 shades contrastantes.

#### ⬜ FUTURO (opcional) — kit de visitante editable en el manager [opción (b)]
Lo IDEAL según el usuario sería definir el kit de visitante en el manager (más fiel que derivarlo en caliente). **HOY NO ESTÁ SOPORTADO**: `EditorView.tsx` solo edita `colors` (3 `<input type=color>`: Cam.Izq=`colors[0]`, Cam.Dcha=`colors[1]`, Pantalón=`colors[2]`) y `Team` no tiene `awayColors`/`awayKitStyle`. Trabajo para soportarlo:
1. **Tipo**: añadir `awayColors?: string[]` y (opcional) `awayKitStyle?: KitStyle` a `Team` (`src/types/game.d.ts`).
2. **Editor**: ampliar la sección "Colores del kit" de `EditorView.tsx` (líneas ~132 form de edición y ~629 form de alta) con 3 inputs de color de visitante + un selector de `kitStyle`; persistir en `colors`/`awayColors`. OJO al `normalizeColors` (línea 64) y al guardado por temporada (`seasons[].colors`, líneas ~327/334) — habría que serializar también `awayColors`.
3. **mockTeams.ts**: mapear los nuevos campos desde la BD (hoy solo mapea `colors`).
4. **Render**: en `App.tsx`, cuando `resolveAwayKit` detecte clash y el equipo tenga `awayColors`, usar ESOS en vez del kit derivado. Es decir: `resolveAwayKit` (o el caller) prioriza `awayColors` reales sobre la derivación automática. La derivación actual queda como fallback cuando no hay datos.

**Implementación sugerida** (solo en el render, sin tocar los datos del equipo):
1. **Detección de clash**: comparar el color principal del home con el del away. Lo más robusto es reusar `kit.ts`: si `nearestShade(homeColors[0])` y `nearestShade(awayColors[0])` resuelven al **mismo SHADE** (o distancia RGB por debajo de un umbral) → hay clash. (Mejor por SHADE que por hex crudo, porque el render ya cuantiza a la paleta VGA de 16: dos azules distintos que caen en el mismo índice se verían iguales en pantalla.)
2. **Equipación alternativa** (solo si hay clash y el equipo es el visitante): como NO hay datos de "away kit", opciones:
   - (a) **Derivar** un kit contrastante en caliente: elegir el SHADE más lejano al del home (o usar el color de pantalón `colors[2]` como base de camiseta), manteniendo el `kitStyle`.
   - (b) **Añadir datos**: campos opcionales `awayColors?: string[]` / `awayKitStyle?` al `Team` + soporte en el editor (ver abajo). Más fiel pero requiere rellenarlos.
3. **Punto de aplicación**: en `App.startWatch2D` / `<Match2D>`, calcular el clash y, si procede, sustituir SOLO los `awayColors`/`awayKitStyle` que se pasan a `Match2D` por la equipación alternativa. No modificar `team.colors`.

**¿Hay editor en el manager?** SÍ: `src/components/EditorView.tsx` → sección **"Colores del kit"** con 3 `<input type="color">`: **Cam. Izq.** = `colors[0]`, **Cam. Dcha.** = `colors[1]`, **Pantalón** = `colors[2]` (guarda `colors:[shirtL,shirtR,shorts]`). NO edita `kitStyle` ni equipación de visitante. Si se elige la opción (b), ampliar este editor con esos campos.

**Nota sobre la semántica de `colors[]`** (la confirma el editor): `[camiseta-izq, camiseta-dcha, pantalón]`. Para lisa, izq==dcha; para rayas, son los **dos colores de raya**. ⚠️ `kit.ts buildKitPalette` hoy usa `colors[0]` (primario) y `colors[1]` como "secundario"→slots {10,11}; el **pantalón real es `colors[2]`**. Para rayas esto funciona (colors[1] = 2º color de raya → slots 10/11), pero para el pantalón en camiseta lisa convendría considerar `colors[2]`. Revisar al implementar el away kit.

Hallazgos originales:
- Sprites disponibles (`public/assets/match2d/base_sprites/`): **`JUGALISO`** (lisa), **`JUGARAYA`** (rayas verticales), **`JUGARAYO`** (franja/banda diagonal estilo Rayo). Porteros: `PORTEROI` (izq), `PORTEROD` (der).
- `palette.ts`: `BASE_PAL` = 16 colores VGA (índices). `computeKitPalette(mapping)` mapea índices de sprite → índices de `BASE_PAL`. Ya hay `KIT_MADRID` (lisa blanca), `KIT_BARCA` (rayas azulgrana), `KIT_RAYO` (franja), `KIT_GK`, `KIT_GK_AWAY`.
- `paletteFilter.ts`: shader que toma el rojo del pixel como índice y aplica el color de la paleta. El color sale de la paleta pasada a `loadAtlasWithPalette`.
- `renderer.ts:129-145`: **hardcodeado** — home usa `JUGALISO+KIT_MADRID`, away usa `JUGARAYA+KIT_BARCA`. `buildScene` solo recibe `timeline` (no colores).

**Trabajo**:
1. Pasar los colores de cada equipo a `buildScene` (vía nuevas props de `Match2D` o metiéndolos en `timeline`/un objeto aparte). `team.colors` es `string[]` (hex).
2. Mapear `team.colors` (hex) → índices de `BASE_PAL` por cercanía (distancia RGB) y construir un `mapping` de kit per-equipo (replicar la estructura de los `KIT_*`: hay slots concretos para camiseta primaria/secundaria/piel/sombra/etc — deducir qué índices del sprite son "tela" mirando los `KIT_*` existentes).
3. **Inferir el estilo** (lisa/rayas/franja) → elegir sprite `JUGALISO`/`JUGARAYA`/`JUGARAYO`. No hay campo de estilo en los datos: o se infiere de `team.colors` (p.ej. 1 color dominante → lisa; 2 colores equilibrados → rayas; combinación concreta → franja) o se añade un campo opcional al equipo. Decidir heurística.
4. Cargar el atlas con la paleta calculada para home y away por separado (hoy se cargan 2 atlas fijos; habrá que cargar el sprite elegido por equipo con su paleta).

**Gotcha**: el filtro de paleta es un `UniformGroup` por atlas; si home y away comparten sprite pero distinta paleta, hay que instanciar dos atlas/filtros distintos.

---

## 4. ✅ HECHO — Formación real (motor) + alineación arrastrable (UI)

**Objetivo**: que la formación/alineación real se refleje en el 2D; y permitir adelantar/retrasar jugadores (variantes de formación) SOLO para el equipo del usuario, desde "Ajustar alineación". Esa posición define el **wandering base sin balón** (línea defensiva adelantada → defensa adelantada por defecto, manteniendo presión/robos/etc).

**✅ HECHO — Etapa 1 (motor)** (sesión 2026-05-27):
- Nuevo `src/engine/lineup.ts`: `buildLineupLayout(formationId, side)` deriva slots (x,y)/role/tag de la formación real (líneas POR/DEF x=0.20/MED x=0.42/ATAQUE x=0.60, Y repartida con span creciente; away espejado). `baseSlot(p)` = slot + `slotOffset` (clamp a campo).
- `EnginePlayer` ahora lleva `slot/role/tag/slotOffset?`. `teamToEnginePlayers(team, side)` los computa desde `team.formation` y aplica `team.lineupOffsets[slotIndex]`. App pasa `'home'`/`'away'`.
- Puntos de lectura migrados de las tablas fijas a los campos del jugador: `state.ts` (pos inicial + `roleOf`), `move.ts` (base anchor + role), `decide/offBall.ts` (tag + slots de avance via `baseSlot`), `move/intent.ts` (role), `phases/corner.ts` (role), `phases/kickoff.ts` (teleport). Las heurísticas `slotIndex % N` / `slotIndex===N` de fases (foul/goalKick/corner lanes) se dejan: degradan bien.
- Sandbox `presets.ts` sigue usando las tablas fijas de `zones.ts` (HOME_SLOTS etc.) → escenarios sin cambios.
- Verificado: `tsc -b` + eslint limpios; generador de slots OK para las 6 formaciones; simulación completa 90' end-to-end vía bridge (4-3-3 vs 5-3-2 + offset) genera timeline válido. **Pendiente validación visual** (Pixi).

**✅ HECHO — Etapa 2 (UI drag + persistencia)** (sesión 2026-05-27):
- `PitchDiagram` admite `draggable`/`offsets`/`onDragOffset`: arrastre de tokens outfield (POR no) con pointer events; convierte el delta de pantalla → offset en espacio motor (`dx`=adelante hacia rival = arriba en el diagrama, 104 u/eje; `dy`=lateral, 94 u/eje); clamp `dx∈[-0.18,0.30]`, `dy∈±0.16`; click sin mover = seleccionar (umbral 2px); línea punteada del slot base al desplazado.
- `AlignmentView`: pasa `draggable={!ingame}` (solo pre-partido), `handleDragOffset` mergea en `team.lineupOffsets`, botón "RESET POSICIONES", y `handleFormationChange` limpia offsets (cambian de significado entre formaciones). `onUpdate` extendido con `lineupOffsets?`.
- `App.handleUpdateAlignment` persiste `lineupOffsets` solo cuando el patch los trae (drag/reset/cambio formación); otras ediciones (asignar/auto-11) los conservan.
- **Signo home/away**: los offsets se guardan en marco del equipo (dx>0 = adelante). El bridge voltea `dx` cuando `side==='away'` (slots espejados). Verificado round-trip + sim end-to-end. i18n `misc.resetPositions` (es/en).
- **Pendiente validación visual** del arrastre en navegador (no testeable headless). El rival no se arrastra (usa su formación por defecto).

Hallazgos originales:
- `zones.ts`: `HOME_SLOTS` (5-3-2 fijo) y `AWAY_SLOTS` (4-4-2 fijo) + `HOME_ROLES`/`AWAY_ROLES`/`*_TAGS`. `mirrorSlot`.
- `state.ts` `createInitialState`: posiciona con `HOME_SLOTS[p.slotIndex]` / `AWAY_SLOTS[...]`. El `wander` se inicializa aleatorio; el movimiento sin balón ancla a estos slots (revisar `move/` y `decide/offBall.ts`).
- `formations.ts`: `FORMATIONS: Record<FormationId, Position[]>` (11 posiciones POR/DEF/MED/DEL/AML/AMR por slot). `buildSlotMap`, `slotPositionFor`, `pickBestXI`, `reslotLineup`. `teamToEnginePlayers` ya respeta el orden de `team.lineup` para `slotIndex`.
- `AlignmentView.tsx` + `PitchDiagram.tsx`: UI de alineación. `AlignmentView` ya tiene props `ingame` (subs, htPaused) — reutilizable para el bloque 8. `PitchDiagram` dibuja slots clicables.

**Trabajo**:
1. Generar slots `(x,y)` a partir de `team.formation` en vez de las tablas fijas. Crear un mapa `Position → (x,y)` por línea (POR/DEF/MED/DEL/bandas) y derivar las coordenadas según la formación (nº de defensas/medios/delanteros), con `mirrorSlot` para el away. Conservar `roles`/`tags` equivalentes para que `decide/offBall` siga funcionando.
2. Pasar esos slots al estado: el bridge/`generateTimeline` debe poder recibir las posiciones de slot (no solo `EnginePlayer` con `slotIndex`). Opciones: añadir `slot: Vec2` a `EnginePlayer`, o pasar arrays de slots a `createInitialState`.
3. **Drag en AlignmentView (solo equipo del usuario)**: permitir mover cada jugador adelante/atrás (y quizá lateral) respecto a su slot base. Persistir un offset por slot en el `Team` (nuevo campo, p.ej. `lineupOffsets?: Record<slotIndex, {dx,dy}>` o por playerId). Solo se ajusta desde "Ajustar alineación".
4. Aplicar el offset como **ancla del wandering sin balón**: en el motor, el "home position" al que vuelve cada jugador sin balón = slot base + offset. Mantener el resto de dinámicas (presión, robos) intactas. Revisar dónde se calcula el retorno a posición en `move/`/`decide/offBall.ts`.

**Nota**: el rival usa la formación por defecto (sin drag).

---

## 5. ✅ HECHO — Mapeo de tiempo a minuto real
Incluido en el bloque 1 (remap `toDisplayMs`). El minuto se muestra como minuto de partido (0–90′) en reloj, log y stats, independientemente de la duración/velocidad de visionado.

---

## 6. ✅ HECHO — Eventos completos al manager

**Objetivo**: que el manager reciba todos los eventos que espera (goles, lesionados, faltas, expulsiones, cambios…).

**✅ HECHO** (sesión 2026-05-27):
- Nuevo `kind:'injury'` en `EventKind` (`types/match.ts`); `effectors/foul.ts` lo emite cuando una entrada lesiona a la víctima (`side`=víctima, `actor`=víctima, `target`=infractor, log '¡Lesión!'). Sale en el log on-screen vía el manejador genérico del animator; `firePlayerEvent` lo ignora (sin `default` que lance) y el cojeo ya lo dispara el evento `foul` previo + el `MAX_SPEED*0.35` de `move.ts`.
- `timelineToMatchResult` ahora devuelve estructura rica: `homeSentOff/awaySentOff` (card red/second_yellow), `homeYellows/awayYellows`, `homeInjured/awayInjured` (de eventos injury), `homeFouls/awayFouls` (foul+penalty por equipo del infractor vía pertenencia del `actor`), `homeShots/awayShots` (shot_on+shot_off), `homeShotsOnTarget` (shot_on), `homePossession/awayPossession` (% por keyframes con `ballOwner`). Sigue emitiendo MatchEvents goal/yellow/red (+injury) con remap de minuto.
- `App.handleClose2D` puebla el `MatchState` con todos esos campos (antes vacíos/0). Verificado: `updateLeagueStats` solo procesa goal/yellow/red (ignora injury sin romper); `writebackMatchStamina` aplica lesión real desde los arrays. `tsc`+eslint limpios; agregación verificada en 8 partidos (posesión suma 100, SOT≤tiros, red/yellow/injury consistentes con arrays).
- **Pendiente menor**: no se emite `kind:'sub'` (el motor de zona aún no tiene sustituciones — eso es el Bloque 8). Posesión es por keyframes (proporción de tenencia), no por tiempo exacto.

Hallazgos originales:
- `timelineToMatchResult` (`managerBridge.ts:45`) hoy SOLO mapea `goal` y `card`. Devuelve `{homeScore, awayScore, events}`.
- `handleClose2D` (`App.tsx:1317`) sintetiza el `MatchState` pero rellena con **arrays vacíos**: `homeSentOff/awaySentOff`, `homeYellows/awayYellows`, `homeInjuredInMatch/awayInjuredInMatch`, fouls, shots, possession = 0.
- El motor emite (`TimelineEvent.kind`, ver `types/match.ts`): `goal, foul, penalty, card, shot_on, shot_off, save, corner, throw_in, ...`. El estado guarda `expelledIds`, `injuredIds`. **No hay `kind:'injury'`** explícito → hay que derivar lesiones de `injuredIds` o emitir un evento de lesión en el motor (mirar `effectors/foul.ts`/`tackle.ts` donde se setea `injured`).
- `MatchEvent.type` del manager admite: `goal, shot, card, commentary, yellow, red, injury, sub`.

**Trabajo**:
1. Ampliar `timelineToMatchResult` para devolver también: expulsados (de `card` red/second_yellow → ids), amonestados (yellow), lesionados, faltas (contar `foul`), tiros/tiros a puerta (shot_on/off/save), posesión (si se quiere computar). Idealmente devolver una estructura rica para poblar el `MatchState`.
2. Emitir/propagar **lesiones**: o añadir `kind:'injury'` al motor cuando se setea `injured`, o exponer `injuredIds` en el `MatchTimeline` para mapearlo.
3. En `handleClose2D`, poblar los arrays del `MatchState` con esos datos en vez de vacíos, para que `finalizeMatch`/`updateLeagueStats` registre suspensiones, lesiones, etc.

---

## 7. ✅ HECHO — Dos tiempos + cambio de campo (min 45)

**Objetivo**: al llegar al minuto 45 real, cambio de campo, manteniendo estado/alineación/tácticas.

**✅ HECHO** (sesión 2026-05-27) — enfoque **espejo solo en el render** (motor intacto, sin regresión a la sim validada):
- **Decisión clave**: cualquier cambio de campo correcto exige tocar el portero (su atlas PORTEROI/PORTEROD es direccional y se fija en spawn). El enfoque elegido NO toca el motor (home sigue atacando x=1 internamente); solo el render espeja en la 2ª parte. Football-wise es equivalente (la sim es simétrica; goles/stats van por `side`).
- `zoneEngine.simulateFromState` acepta `opts.emitHalfTime`; `generateTimeline` lo pasa `true` → **half_time se emite siempre en el midpoint** de un partido completo (antes la puerta `durationMs>=5min` lo suprimía en duraciones comprimidas). Verificado headless (2 min → half_time en t=45000).
- Render: `Scene` guarda `gkLeftAtlas`/`gkRightAtlas` y `halfTimeMs` (t del evento half_time). El animator, para `gt >= halfTimeMs`, aplica `mir(x)=1-x` a posiciones de jugadores/balón, `mdx(dx)=-dx` a los deltas de orientación (facing, kick dir, wall stance, face-ball), y para el portero **intercambia el atlas** (left↔right) + el flag isHome de `gkAnimKey`/`fireGKEvent` (las estiradas N/S son verticales, no afectadas). Las porterías (sprites fijos a ambos lados) y overlays centrados quedan bien.
- `tsc`+eslint limpios. **Necesita validación visual** (no testeable headless): que en la 2ª parte los equipos cambien de banda, el balón entre por la portería correcta y el portero use el sprite del lado correcto.
- **FIX descanso** (tras validación del usuario): antes el descanso era solo el espejo de render y la jugada **continuaba** (se veía un teletransporte + mirror). Corregido en `zoneEngine` HALF_TIME: ahora hace `resetKickoff(state,'home',true,...)` → para la jugada, recoloca los 22 en formación y monta **saque de centro de la 2ª parte sacado por el AWAY** (el que no sacó en la 1ª; el inicio siempre lo saca HOME). Emite un evento `kickoff` (log '¡Segunda parte!') en t del descanso. Verificado headless (balón al centro, dueño = jugador away). Con el espejo de render, los equipos cambian de banda en ese saque.
- **Reloj en el descanso**: como `gt≈durationMs/2` en el descanso, el minuto mostrado se lee ~45' y no incrementa durante el breve setup del saque → "freeze" aproximado. El freeze exacto + "45+X'/90+X'" sigue necesitando el remap no-lineal (Bloque 9); el descuento YA se registra en el MatchState.
- **Pendiente menor**: el cambio de banda sigue siendo **instantáneo en el pitido** (sin transición "salen y vuelven"); suavizable con overlay/freeze si se quiere → ver 7.b.

### 7.b ✅ HECHO — Secuencia "los jugadores se van y vuelven" — pedido del usuario

**✅ HECHO** (sesión 2026-05-27) — enfoque **motor** (las posiciones de entrada/salida van en el timeline; el render las reproduce solo, sin tocar `animator`):
- **Entrada (inicio + 2ª parte)**: en el branch `teleport` de `resetKickoff` (`phases/kickoff.ts`) los 22 ya NO hacen snap a su slot; spawnean **fuera de cuadro** en su banda más cercana (`y=-0.12 / 1.12`, misma `x` que el slot) y el campo de fuerzas de `kickoff_setup` (`applyKickoffForces`, ya existente) los **trota a formación**. Nuevo flag `state.kickoffEntrance` (true solo en teleport=true; el post-gol sigue caminando desde el juego, sin entrada). `KICKOFF_INITIAL_TICKS` subido 12→18 para que dé tiempo a la carrera; el gate de llegada del sacador en `tickKickoffSetup` lo extiende si hace falta. El flag se limpia al pasar a `live`.
- **Salida (solo descanso)**: nueva fase `halftime_walkout`. En `zoneEngine`, al `half_time` ya no se hace el restage inmediato: se entra en `halftime_walkout` por `HALFTIME_WALKOUT_TICKS` (18). `applyHalftimeWalkoutForces` (en `kickoff.ts`) lleva a cada jugador a su banda más cercana y fuera de cuadro (`y=-0.30/1.30`, manteniendo `x`). Al acabar la ventana, `tickHalftimeWalkout` hace el `resetKickoff('home', true)` (la 2ª la saca el AWAY) → entrada de la 2ª parte. Emite el `kickoff` '¡Segunda parte!' en ese momento (no en el pitido).
- **Velocidad**: boost `MAX_SPEED=0.05` en `move.ts` durante `kickoff_setup`+`kickoffEntrance` (trote de entrada) y durante `halftime_walkout` (salida). Clamp vertical relajado a `[-0.30, 1.30]` para `halftime_walkout` (todos cruzan su banda, unos por arriba y otros por abajo).
- **Plumbing**: `halftime_walkout` añadido a `MatchPhase` (en `types.ts` Y `phases/shared.ts`), a `isGamePaused` (`state.ts`) y a los dos dispatchers de `phases.ts` (`applyPhaseForces`/`tickPhase`).
- Verificado headless (2′ comprimido y 90′ completo): kf0 = 22/22 fuera → 0 fuera tras la ventana de entrada; `half_time` en el midpoint; los 22 salen de cuadro durante el walkout (max 22 fuera); '¡Segunda parte!' a t=half_time+walkout; 0 fuera tras la re-entrada. `tsc -b` + eslint limpios. Sandbox intacto (sus escenarios no emiten half_time ni usan teleport de entrada). **Pendiente validación visual** (Pixi).
- ⚠️ **Determinismo**: subir `KICKOFF_INITIAL_TICKS` cambia el consumo de RNG del intro de inicio → la secuencia concreta del partido (goles) cambia respecto a antes. Es una sim seed-based igualmente válida; no es regresión funcional, pero el "guion" exacto del partido validado en sesiones previas ya no coincide.
- **Opcional futuro**: overlay "DESCANSO"/"2ª PARTE" durante salida/entrada (no implementado).

Objetivo original:
- **Descanso (min 45)**: los 22 **salen del campo** (caminan hacia su banda/túnel, fuera de cuadro) y, tras un instante (con el cambio de banda ya aplicado = espejo de render), **vuelven a saltar** y se colocan en formación para el saque de centro de la 2ª parte.
- **Inicio del partido**: misma secuencia de ENTRADA pero **sin salida previa** — los jugadores solo "saltan al campo" desde fuera y se colocan en formación :). (Hoy `resetKickoff(teleport=true)` los teletransporta directos a su slot.)

**Implementación sugerida**:
1. Reusar la animación de caminar/correr existente (la del expulsado `expulsion_walk` sirve de referencia para "salir por la banda"; para "entrar" basta animación de carrera hacia el slot).
2. **Salida** (solo descanso): nueva fase de motor (p.ej. `halftime_walkout`) tras emitir `half_time`: mover a los 22 hacia fuera del campo (y > 1.0 / y < 0.0 o hacia el lateral) con su anim de carrera; al terminar, **entrada**.
3. **Entrada** (inicio y descanso): en vez del teleport instantáneo de `resetKickoff`, arrancar a los jugadores **fuera de cuadro** (p.ej. en la banda más cercana a su slot) y dejar que las fuerzas del `kickoff_setup` (que ya tiran al "home position") los lleven corriendo a su sitio. Es decir: en el branch `teleport` de `kickoff.ts`, en vez de `state.pos[p.id]=slot`, poner `pos` en el borde y subir `KICKOFF_INITIAL_TICKS` para que se vea la carrera de entrada. Para el inicio: igual pero sin la fase de salida.
4. **Render**: el espejo de la 2ª parte (animator `flipped`) ya gestiona el cambio de banda; la secuencia de entrada se reproduce sola al ser posiciones del timeline. Cuidado con que la entrada del descanso ocurra **después** de aplicar el flip (que los jugadores entren ya por su nueva banda).
5. Opcional: overlay "DESCANSO" / "2ª PARTE" durante la salida/entrada.

**Gotcha**: encaja con la decisión arquitectónica (A) y con el Bloque 8 (la salida reusa la mecánica del expulsado; la entrada del suplente en el Bloque 8 es la misma "entrada" que aquí).

Hallazgos originales:
- El motor emite `half_time` (`zoneEngine.ts` ~línea 146) en el tick medio, pero **solo si `durationMs >= 5min`** (`EMIT_HALF_TIME`). Con el modelo nuevo, las duraciones cortas (2/6 min → 90s/270s de motor) NO llegan a 5min → no se emite. **Ajustar**: emitir el descanso siempre a la mitad para partidos de match completo (usar `nominalMatchMs`/proporción, no el umbral fijo de 5 min de motor).
- No hay cambio de lado real: HOME ataca izq→der todo el partido.

**Trabajo**:
1. Implementar el cambio de campo en el motor a mitad: invertir las porterías objetivo de cada equipo y reflejar (mirror) posiciones/slots. Revisar dónde se define la dirección de ataque (probablemente `goalX = side==='home' ? 1 : 0` repartido por el motor — `state.ts resetCarry`, efectores de tiro, `move/gk.ts`). Hace falta una noción de "lado actual" que cambie en el descanso.
2. Mantener alineación/tácticas (y offsets del bloque 4) a través del descanso.
3. En el render, el cambio debe verse (los equipos cambian de banda). Ya hay overlay/lo de `half_time` en el animator si se quiere pausa visual.
4. Encaja con la decisión arquitectónica (A): el descanso es un punto natural de segmentación para permitir cambios (bloque 8).

---

## 8. 🟡 PARCIAL — Pausa + cambios en vivo (sustituciones ✅ + táctica/secuencia ⬜)

**Objetivo**: poder pausar el partido para hacer cambios de alineación y táctica en vivo, reflejados en el motor. Botones de "entrenador". Secuencia visual de cambio (uno sale, otro entra) reutilizando la animación del expulsado para el que sale.

**✅ HECHO — sustituciones en vivo** (sesión 2026-05-27) — **arquitectura por re-simulación determinista** (variante limpia de la (A), sin serializar `MatchState` ni concatenar colas):
- **Decisión clave**: en vez de pausar el motor y continuar desde un `MatchState` serializado, se **re-simula desde cero con el mismo seed inyectando el cambio en su tick**. Como la sim es determinista, todos los ticks anteriores a la pausa se reproducen IDÉNTICOS (cabecera consistente con lo ya visto — verificado: events+keyframes idénticos pre-pausa) y solo se ramifica la cola. No hace falta reconstruir estado.
- **Motor**: `simulateFromState`/`generateTimeline` aceptan `opts.subs: SubInjection[]` (`{atTick, apply(state,t)}`); el bucle aplica los `apply` due en su tick antes de decidir/mover. `half_time` se ubica por el `TOTAL_TICKS` global, así que sigue bien con subs.
- **Mecánica de cambio**: `src/engine/substitution.ts` `applySubstitution(state, t, outId, incoming, log)` — intercambia el `EnginePlayer` en arrays/`playerMap`/`homeSet`, el entrante hereda slot/role/tag/`slotOffset` del saliente (formación intacta) y spawnea fuera de banda (reusa la entrada de 7.b → trota al campo en juego normal, sin fase especial); limpia estado del saliente; si tenía el balón lo suelta (`ballOwner=null`); emite evento `sub` (nuevo `EventKind`/`MatchEvent.type` 'sub', `playerId`=entra, `playerOffId`=sale).
- **Render**: `renderer.ts` reconstruye el roster completo por banda (lineup final ∪ actores/targets de eventos `sub`) y pre-crea sprites de TODOS (suplentes incluidos) con el kit correcto; `animator.ts` oculta cada sprite mientras su id no esté en el keyframe actual (suplente antes de entrar / saliente tras salir). Nuevo `primeResume(scene, toMs)` reposiciona punteros de evento/gol/keyframe + marcador para reanudar en el instante de pausa sin re-disparar la cabecera.
- **UI**: `Match2D` botón **CAMBIOS** (pausa + reporta `gameTime` vía `onRequestChanges`); prop `resumeAtMs` → `primeResume` y sigue a la última velocidad. `App` guarda los inputs de sim en `watch2dRef`, abre `AlignmentView ingame` sobre una copia de trabajo del equipo, `handle2DSubstitute` construye el entrante (mood+fitness vía `engineStatsFromPlayer`) y lo encola, `handle2DContinue` regenera el timeline con TODOS los subs y reanuda. `timelineToMatchResult` mapea `sub`→MatchEvent + `homeSubsUsed/awaySubsUsed` (y arregla la atribución de roster del saliente en faltas/posesión). `handleClose2D` vuelca `subsUsed`.
- Verificado `tsc -b` + eslint limpios (0 errores nuevos en App; los 7 preexistentes siguen). Headless: cabecera idéntica pre-pausa, evento `sub` correcto, suplente entra y saliente desaparece, `subsUsed=2`, posesión 100, lineup final con subs. **Pendiente validación visual** (React/Pixi: overlay, seek, mostrar/ocultar sprites).

**✅ HECHO — cambios de TÁCTICA/formación en vivo** (cableado ya presente; reconciliado + fix de determinismo 2026-05-29):
- `AlignmentView ingame` SÍ permite drag (`draggable={true}`) y cambio de formación (`handleFormationChange` sin gate `ingame`). Su `onUpdate` reescribe la copia de trabajo (`live2dTeam`) y apila una entrada en `inp.tacticalChanges` por tick de pausa (sobrescribe si ya hay una en ese tick).
- `handle2DContinue` reinyecta cada `tacticalChange` como una `SubInjection` que llama `applyFormationChange(state, t, userSide, formation, lineup, offsets)` — DESPUÉS de los subs (la reforma actúa sobre el once ya sustituido). `applyFormationChange` (`substitution.ts`) reasigna `slot/role/tag/slotOffset` de cada jugador del once según la nueva formación (los 11 en campo no cambian; solo sus anclas) y emite evento `'tactic'`.
- **Determinismo arreglado** este sesión (ver fix B4 arriba): antes la regeneración partía de jugadores ya mutados; ahora `createInitialState` clona → la cabecera re-simulada coincide con lo ya visto.
- `tacticalDiscipline` NO lo modela el motor de zonas (toggle no-op, `onToggleDiscipline` vacío). Aceptado.
- ⬜ **Cosmético pendiente**: el evento `'tactic'` existe en el tipo (`types/match.ts`) pero NO se maneja en el animator (no sale línea de log) ni en `timelineToMatchResult`. Añadir una línea de log on-screen (y opcionalmente un overlay "CAMBIO TÁCTICO") sería trivial vía el manejador genérico del animator.
- **Pendiente validación visual** del flujo completo (pausa → arrastrar/cambiar formación → continuar) en navegador.

**✅ HECHO — secuencia visual del que SALE + ejecución diferida a parada** (sesión 2026-05-29):
- **Ejecución diferida** (decisión del usuario, más fiel): el cambio se **ordena** en vivo pero se ejecuta en la **primera pelota parada** a partir de ese instante, no al instante. `App.handle2DContinue` ahora **encola** vía `queueSubstitution(state, outId, incoming, log)` (nuevo, `phases/subWalkout.ts`) en `state.pendingSubs` en vez de `applySubstitution` directo. `tryStartPendingSub` (en el bucle de `zoneEngine`, tras la fatiga) lo dispara cuando `state.phase` es una fase "holding" (foul/throw_in/goal_kick/corner), `celebration` o `gk_holding` — momentos estables — y no hay ya un walk-off/expulsión en curso. Un cambio por parada (varios ordenados → paradas sucesivas).
- **Walk-off** (calco de la expulsión): nueva fase `sub_walkout`. `startSubWalkout` **guarda** la fase interrumpida + sus `phaseTicks` (`subResumePhase/subResumePhaseTicks`), pone `subWalkerId`/`subIncoming` y `phase='sub_walkout'` (`SUB_WALKOUT_TICKS=28`). El saliente camina a la **banda más cercana** (norte si y<0.5, sur si no; `applySubWalkoutForces` spring a y=±0.30/1.30, `MAX_SPEED=0.05`, clamp relajado en `move.ts`); el resto congela (`move.ts inWalkoffPhase` generaliza el gate de la expulsión). Al acabar, `tickSubWalkout` llama `applySubstitution` (el suplente entra trotando como ya hacía) y **restaura** la fase guardada → el saque sigue.
- **Render**: sin cambios — el saliente sigue en los keyframes caminando fuera y desaparece tras el swap; el evento `sub` se sigue emitiendo (roster reconstruido en `renderer.ts` ya incluye actor+target del `sub`).
- **Plumbing**: `sub_walkout` añadido a `MatchPhase` (`types.ts` + `phases/shared.ts`), `isGamePaused` (`state.ts`), y los dos dispatchers de `phases.ts`. Campos nuevos en `MatchState` (`pendingSubs/subWalkerId/subIncoming/subLog/subResumePhase/subResumePhaseTicks/subWalkoutStartMs/clockFrozenSpans`), inicializados en `createInitialState`.
- **Parada de reloj** (Bloque 9, ver allí): cada `sub_walkout` registra `[start,end]` en `state.clockFrozenSpans` → el reloj se congela durante el cambio.
- Verificado headless: cambio ordenado en tick 0.55·T → ejecutado +14.75s después en la siguiente parada; cabecera idéntica pre-orden vs sim sin cambio; determinismo total (mismo sub dos veces → idéntico); reloj congelado Δ=0' durante el tramo y reanuda después; el saliente sale por su banda y desaparece; SUB en la alineación final. `tsc`+eslint limpios (los 5+2 de `App.tsx` son preexistentes). **Pendiente validación visual** (Pixi).
- ⚠️ **Edge sub+formación en la misma pausa**: si en la misma pausa cambias formación Y haces un sub, `applyFormationChange` (inmediato en su tick) no encuentra al entrante (aún no está en campo) y el entrante hereda el slot del saliente (pre-cambio de formación) al ejecutarse. Afecta solo a ese jugador; aceptable v1.
- **Overlay "CAMBIO"** opcional durante la sustitución (no implementado).

Hallazgos:
- `AlignmentView` ya soporta modo `ingame` (`onSubstitute(outId,inId)`, `subsUsed`, `maxSubs`, `injuredIds`, `sentOff`, `htPaused`, `onContinue`). Reutilizable.
- El motor de zona **no tiene sustituciones**; el sim de texto sí (`simEngine.ts`) pero es otra ruta.
- La animación de expulsado existe (`expulsion_walk`, `card`/`expelledIds`) — reutilizar para el jugador que sale.

**Trabajo** (depende de la decisión arquitectónica A):
1. Botón de pausa en `Match2D` → abrir `AlignmentView` en modo `ingame` (ya existe) sobre el equipo del usuario.
2. Al aplicar un cambio/táctica: tomar el `MatchState` del instante de pausa, modificar jugadores/slots/offsets, y **regenerar la cola** de la línea temporal con `simulateFromState(state, restanteMs, seed)`. Concatenar con lo ya reproducido. Hay que poder reconstruir/continuar `MatchState` (ya es el parámetro de entrada de `simulateFromState`).
3. Implementar la **secuencia de sustitución en el motor**: jugador sale (camina fuera, reusar expulsión), entra el suplente en su slot. Nuevo efector/fase o reuso de `phases/`.
4. Reflejar cambios de táctica (formación/offsets del bloque 4) en el `MatchState` regenerado.
5. Respetar `maxSubs` (3) y registrar `sub` en eventos (bloque 6).

**Gotcha**: determinismo/seed — al regenerar la cola, reusar el mismo `seed` o derivar uno para que sea reproducible.

---

## 9. 🟡 PARCIAL — Crono parado / tiempo de descuento

**Objetivo**: cuando el juego se detiene por un evento, o bien el crono se detiene hasta reanudar, o bien sigue y se añade ese tiempo como descuento al final de cada parte.

**✅ HECHO — cálculo + registro del descuento** (sesión 2026-05-27):
- `timelineToMatchResult` calcula `stoppageTime1`/`stoppageTime2` con la MISMA heurística que el sim de texto (`calcStoppage` duplicado en el bridge para no acoplar i18n): base 1ª=1 (tope 3) / 2ª=3 (tope 7) + bonus por goles/cambios/lesiones/rojas del tramo. Opera sobre los MatchEvents (minutos ya remapeados 0–90, incluyen goles/rojas/lesiones del Bloque 6).
- `handleClose2D` los vuelca en `MatchState.stoppageTime1/2` (antes 0) → consistente con los modos de texto. Verificado: st1∈[1,3], st2∈[3,7], escala con goles.

**✅ HECHO — parada de reloj en las sustituciones** (sesión 2026-05-29): el reloj se **detiene** durante cada walk-off de cambio (decisión del usuario: solo los cambios paran el crono, no faltas/banda/córner — esos siguen corriendo). El motor registra cada ventana `sub_walkout` como `[start,end]` en `MatchTimeline.clockFrozenSpans` (`zoneEngine`/`types/match.ts`); `toClockMs` (`layout.ts`) resta el tiempo congelado de cada ancla de tiempo (`frozenBefore(t)`), así el minuto se mantiene fijo durante el cambio y reanuda sin deriva a largo plazo (los tramos son pequeños y disjuntos). Verificado headless: el minuto se congela Δ=0' a lo largo del tramo de ~6.75s y continúa después. **Convención = crono parado** (no "45+X'"): el partido dura un poco más de reloj real, no se muestra añadido. `stoppageTime1/2` del manager sigue como stat aparte (heurístico). **Pendiente validación visual**.

⬜ **PENDIENTE — display en vivo "45+X'/90+X'"** (descuento general, distinto de la parada por cambio de arriba): tras el fix de **B2** (2026-05-27) el reloj YA NO es lineal — `toClockMs` (`layout.ts`) remapea por tramos con **frontera de parte explícita** (0' hasta el saque, `[saque,descanso]→[0',45']`, 45' en el descanso, `[saque 2ª,final]→[45',90']`). Eso desbloquea parte de este punto, pero el "45+X'" sigue pendiente porque el motor **no distingue tiempo reglamentario de descuento**: el medio tiempo cae exacto en `halfTimeMs` (→45') y el final en `durationMs` (→90'), sin región de añadido que mostrar. Para hacerlo de verdad habría que (a) reservar una fracción del tiempo de motor de cada parte como "descuento" y que `toClockMs` mapee `[regulación]→[0',45']` y `[descuento]→[45'+0, 45'+N']`, usando `stoppageTime1/2`; o (b) inyectar `stoppageTime1/2` en el `MatchTimeline` y que el animator, al pasar de 45'/90', muestre "+X" mientras el motor sigue corriendo hasta el pitido. El valor del descuento ya se calcula y se vuelca en `MatchState.stoppageTime1/2`. (Opción "crono se detiene en cada fase muerta" descartada: contar todos los `isGamePaused` —saques de banda/puerta/córner— dispararía el descuento.)

Hallazgos originales:
- `MatchState` (manager) ya tiene `stoppageTime1`/`stoppageTime2`.
- En el motor, `isGamePaused(state)` (`state.ts:190`) detecta las fases sin juego (freeze, celebración, saques, faltas, etc.).

**Trabajo** (fasear): aproximación más simple primero — acumular el tiempo en fases `isGamePaused` y o (a) no avanzar el minuto cosmético durante esas fases, o (b) añadirlo como descuento al final de cada parte. Encaja con el remap de minuto del bloque 1 (descontar/pausar el `toDisplayMs`).

---

## 📋 ESTADO ACTUAL — qué está implementado y qué NO (auditado 2026-05-27)

| Bloque | Estado | Detalle |
|---|---|---|
| 1 — Velocidad/tiempo/layout | ✅ | Falta solo validación visual del scroll. |
| 2 — Stats motor | ✅ | GK ✅, fitness pre-partido ✅, **decaimiento de stamina EN VIVO ✅** (`engine/fatigue.ts`, gated por `opts.fatigue`; suplentes cansan desde su propio reloj). Falta validación visual. |
| 3 — Colores + camiseta + away anti-clash | ✅ | Falta validación visual; ningún equipo trae `kitStyle`/`awayColors` en datos aún. |
| 4 — Formación real + drag alineación | ✅ | Falta validación visual del arrastre. El rival no se arrastra. |
| 5 — Tiempo→minuto | ✅ | (Mejorado por B2: ahora reloj no-lineal con frontera de parte.) |
| 6 — Eventos al manager | ✅ | Falta `kind:'sub'` se emite ✅; posesión por keyframes (no tiempo exacto). |
| 7 — Dos tiempos + cambio de campo + walkout/entrada | ✅ | Falta validación visual. |
| 8 — Pausa + cambios en vivo | ✅ | **Sustituciones ✅** (ejecución diferida a la siguiente parada + walk-off del saliente, 2026-05-29). **Táctica/formación en vivo ✅**. Falta validación visual + línea de log cosmética del evento `tactic`. |
| 9 — Crono / descuento | 🟡 | Cálculo+registro de `stoppageTime1/2` ✅. Reloj no-lineal con frontera ✅ (B2). **Parada de reloj en sustituciones ✅** (`clockFrozenSpans`, 2026-05-29). ⬜ **display "45+X'/90+X'"** (descuento general; el motor no separa reglamentario de descuento). |
| Bugs B1/B2/B3 | ✅ | Arreglados esta sesión; **pendiente revalidación visual del usuario**. |

### Qué queda por hacer (orden sugerido)
1. ✅ **Validación visual** de B1/B2/B3 — hecha por el usuario (2026-05-29; OK, quedan ajustes menores no críticos).
2. ✅ **Bloque 8 — táctica/formación en vivo** — ya estaba cableado; reconciliado + **fix de determinismo** (clonado en `createInitialState`) esta sesión. Falta solo validación visual + línea de log del evento `tactic`.
3. ✅ **Bloque 8 — secuencia visual del cambio + ejecución diferida a parada** — hecho (`phases/subWalkout.ts`, 2026-05-29).
4. ✅ **Bloque 2 — decaimiento de stamina en vivo** — hecho (`engine/fatigue.ts`, 2026-05-29). Falta validación visual.
5. ✅ **Bloque 9 — parada de reloj en sustituciones** — hecho (`clockFrozenSpans` + `toClockMs`, 2026-05-29).
6. ⬜ **Bloque 9 — display "45+X'/90+X'"** (descuento general): requiere que el motor separe reglamentario de descuento (ver nota del Bloque 9).
7. ⬜ **Cosmético**: manejar el evento `'tactic'` en el animator (línea de log on-screen) y opcionalmente un overlay "CAMBIO TÁCTICO" / "CAMBIO".
8. ⬜ **Validación visual** (navegador) de todo lo nuevo: decaimiento de stamina, cambio diferido + walk-off del saliente, reloj congelado durante el cambio, táctica en vivo, fix de determinismo.

## Verificación general
- `npx tsc -b` (debe pasar limpio).
- `npx eslint <archivos>` — OJO: hay errores **preexistentes** en `App.tsx` (efecto changelog, `Math.random` en `finalMatch`, bloque vacío) que NO son de este trabajo.
- Probar a mano: `npm run dev` → jugar un partido del usuario → "VISIONAR 2D". Sandbox: `#sandbox` en la URL (revisar `Sandbox.tsx`).
- No se pudo automatizar la validación visual de Pixi; revisar a ojo.

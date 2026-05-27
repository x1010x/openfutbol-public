# Handoff — Integración motor 2D ↔ Manager

> Documento de self-handoff. Rama: `feature/engine-integration`. Última sesión: 2026-05-26/27.
> Objetivo: terminar de integrar el motor de simulación 2D (Pixi) con el manager (PC-Fútbol-like).
> Hay memorias relacionadas: `2d-speed-time-model`, `engine-hardcoded-slots`.

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

## 2. 🟡 PARCIAL — Stats del motor (goalkeeping ✅ + extras ⬜)

**Objetivo**: que las stats que recoge el manager repercutan en el juego; inyectar las que faltan y decidir el efecto de las que el motor no contempla.

**✅ HECHO — goalkeeping** (sesión 2026-05-27):
- `goalkeeping` añadido a `EnginePlayer` (`zoneEngine.ts`) y mapeado en `teamToEnginePlayers` (`managerBridge.ts`). Sandbox `presets.ts` actualizado (POR 80, def 12, mid 8, del 5) para no romper compile.
- `ballPhysics.ts`: `catchProb` (atrapar a dos manos) usa `p.goalkeeping` en vez de `p.defending`; `diveReach` (radio de estirada) escala con el stat: `0.066 + 0.032*(gk/99)` (~0.072 a 30 → ~0.098 a 99).
- `move/gk.ts`: ganancia de reacción en estirada on-target escala con el stat: `0.24 + 0.16*(gk/99)` (~0.29 a 30 → ~0.40 a 99) → buen portero llega a más tiros.
- Verificado `npx tsc -b` limpio. **Pendiente validación visual** (portero bueno vs malo debe parar más).

⬜ **PENDIENTE — stats adicionales** del manager sin equivalente en el motor: `stamina` (el motor NO modela decaimiento — ver nota en `handleClose2D`), `media`, edad (`peakAge`/`birthYear`). Decidir efecto:
  - `stamina` → podría reducir `speed`/`physical` efectivos a lo largo del partido (pero el motor precomputa; afecta al bloque 8). De momento, al menos un escalado inicial.
  - edad/peakAge → ya influye en `media` del manager; probablemente no haga falta en el motor.
- Mirar `formations.ts` `STAT_WEIGHTS`/`computePositionWeightedMedia` por si conviene reusar la ponderación.

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

**Pendiente menor**: (1) **validación visual** (no se pudo probar Pixi headless). (2) Ningún equipo trae `kitStyle` en los datos todavía → todos lisos; cuando se rellene en la BD hay que mapearlo en `mockTeams.ts` (hoy solo mapea `colors`). (3) No hay manejo de "clash" (dos equipos con colores parecidos): antes se distinguían por sprite liso/rayas, ahora por color.

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
- **Pendiente menor**: el cambio de banda sigue siendo **instantáneo en el pitido** (sin transición "salen y vuelven"); suavizable con overlay/freeze si se quiere.

Hallazgos originales:
- El motor emite `half_time` (`zoneEngine.ts` ~línea 146) en el tick medio, pero **solo si `durationMs >= 5min`** (`EMIT_HALF_TIME`). Con el modelo nuevo, las duraciones cortas (2/6 min → 90s/270s de motor) NO llegan a 5min → no se emite. **Ajustar**: emitir el descanso siempre a la mitad para partidos de match completo (usar `nominalMatchMs`/proporción, no el umbral fijo de 5 min de motor).
- No hay cambio de lado real: HOME ataca izq→der todo el partido.

**Trabajo**:
1. Implementar el cambio de campo en el motor a mitad: invertir las porterías objetivo de cada equipo y reflejar (mirror) posiciones/slots. Revisar dónde se define la dirección de ataque (probablemente `goalX = side==='home' ? 1 : 0` repartido por el motor — `state.ts resetCarry`, efectores de tiro, `move/gk.ts`). Hace falta una noción de "lado actual" que cambie en el descanso.
2. Mantener alineación/tácticas (y offsets del bloque 4) a través del descanso.
3. En el render, el cambio debe verse (los equipos cambian de banda). Ya hay overlay/lo de `half_time` en el animator si se quiere pausa visual.
4. Encaja con la decisión arquitectónica (A): el descanso es un punto natural de segmentación para permitir cambios (bloque 8).

---

## 8. ⬜ Pausa + cambios en vivo (alineación/táctica) + secuencia de sustitución

**Objetivo**: poder pausar el partido para hacer cambios de alineación y táctica en vivo, reflejados en el motor. Botones de "entrenador". Secuencia visual de cambio (uno sale, otro entra) reutilizando la animación del expulsado para el que sale.

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

⬜ **PENDIENTE — display en vivo "45+X'/90+X'"**: el reloj cosmético del 2D es lineal 0→90 (Bloque 1) y no tiene frontera de parte visible, así que mostrar el descuento en pantalla **se acopla al Bloque 7** (que introduce el descanso/medio tiempo real). Hacerlo ahí: cuando el reloj llega a 45'/90', mostrar "+stoppageTimeN". (Opción "crono se detiene en cada fase muerta" descartada por ahora: contar todos los `isGamePaused` —incluye saques de banda/puerta/córner— dispararía el descuento; requeriría además un remap no-lineal que toca el modelo de tiempo validado del Bloque 1.)

Hallazgos originales:
- `MatchState` (manager) ya tiene `stoppageTime1`/`stoppageTime2`.
- En el motor, `isGamePaused(state)` (`state.ts:190`) detecta las fases sin juego (freeze, celebración, saques, faltas, etc.).

**Trabajo** (fasear): aproximación más simple primero — acumular el tiempo en fases `isGamePaused` y o (a) no avanzar el minuto cosmético durante esas fases, o (b) añadirlo como descuento al final de cada parte. Encaja con el remap de minuto del bloque 1 (descontar/pausar el `toDisplayMs`).

---

## Orden sugerido para mañana
1. **Bloque 3 (colores)** y **Bloque 2 (stats GK)** — independientes, visibles, bajo riesgo.
2. **Bloque 4 (formación + drag)** — medio; toca motor + UI + persistencia.
3. **Bloque 6 (eventos al manager)** — necesario para realismo de liga.
4. **Decidir arquitectura (A)** y hacer **Bloque 7 (dos tiempos)** como primer punto de segmentación.
5. **Bloque 8 (cambios en vivo)** sobre esa arquitectura.
6. **Bloque 9 (crono)** al final, faseado.

## Verificación general
- `npx tsc -b` (debe pasar limpio).
- `npx eslint <archivos>` — OJO: hay errores **preexistentes** en `App.tsx` (efecto changelog, `Math.random` en `finalMatch`, bloque vacío) que NO son de este trabajo.
- Probar a mano: `npm run dev` → jugar un partido del usuario → "VISIONAR 2D". Sandbox: `#sandbox` en la URL (revisar `Sandbox.tsx`).
- No se pudo automatizar la validación visual de Pixi; revisar a ojo.

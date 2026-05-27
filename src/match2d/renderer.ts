// Scene construction: loads atlases, builds the pitch + goal-net overlays,
// spawns the 22 player sprites and the ball, and creates the transient event
// overlays (fuera / goal / corner / foul / penalty / card). Returns a `Scene`
// handle holding every sprite map, overlay ref and the mutable runtime cursors
// the animator mutates each frame. Pure setup — no per-frame logic here.

import { Application, Container, Sprite, AnimatedSprite, Texture, Rectangle } from 'pixi.js';
import { remapWithPalette, loadAtlasWithPalette, type SpriteAtlas } from './sprites';
import { BASE_PAL, KIT_MADRID, KIT_BARCA, KIT_GK, KIT_GK_AWAY } from './palette';
import { buildKitPalette, spriteForStyle } from './kit';
import type { KitStyle } from '../types/game.d.ts';
import type { MatchTimeline, PlayerId, TimelineEvent } from '../types/match';
import {
  makePlayerAnim, makeGKAnim, dirFromDelta,
  type PlayerAnim, type GKAnim,
} from './states';
import {
  FIELD_SCALE, PLAYER_SCALE, CANVAS_W, CANVAS_H, BASE, PLAY_X,
  type SpriteEntry,
} from './layout';

// Mutable per-frame cursors and overlay countdown timers. Lives on the Scene so
// the animator (a free function) can advance them without closure state.
export interface SceneRuntime {
  goalIdx: number;
  homeScore: number;
  awayScore: number;
  fueraTimer: number;
  goalTimer: number;
  cornerTimer: number;
  foulTimer: number;
  penaltyTimer: number;
  cardTimer: number;
  gameTime: number;
  kfPointer: number;
  evtPtr: number;
}

export interface Scene {
  timeline: MatchTimeline;
  spriteMap: Map<PlayerId, SpriteEntry>;
  animMap: Map<PlayerId, PlayerAnim>;
  gkAnimMap: Map<PlayerId, GKAnim>;
  playerSideMap: Map<PlayerId, 'home' | 'away'>;
  ballAtlas: SpriteAtlas;
  // Both GK atlases so the animator can swap a keeper's sprite set at the
  // change of ends (second half): the home GK, drawn at the left goal in the
  // first half, must use the right-goal sprite set after the teams switch.
  gkLeftAtlas: SpriteAtlas;
  gkRightAtlas: SpriteAtlas;
  ballSp: AnimatedSprite;
  shadowSp: AnimatedSprite;
  homeGK: PlayerId;
  awayGK: PlayerId;
  // Engine time (ms) of the half-time whistle, or null if none. Past this the
  // animator mirrors the pitch (x → 1-x) so the teams visibly change ends.
  halfTimeMs: number | null;
  goalEvents: TimelineEvent[];
  // Event overlays
  fueraOverlay: Container;
  goalOverlay: Container;
  cornerOverlay: Container;
  foulOverlay: Container;
  penaltyOverlay: Container;
  cardOverlay: Container;
  cardYLeft: Sprite;
  cardYRight: Sprite;
  cardRed: Sprite;
  cardSpacing: number;
  rt: SceneRuntime;
}

// `isAlive` lets the caller cancel an in-flight build (React 19 double-mount /
// unmount during async asset loading). Returns null when cancelled; the caller
// owns the Application lifecycle and destroys it.
// Per-team kit (real colours + shirt pattern) for the two outfield sides. When
// omitted, the viewer falls back to the original Madrid/Barca demo kits.
export interface SceneKits {
  home: { colors?: string[]; style?: KitStyle };
  away: { colors?: string[]; style?: KitStyle };
}

export async function buildScene(
  app: Application,
  timeline: MatchTimeline,
  isAlive: () => boolean,
  kits?: SceneKits,
): Promise<Scene | null> {
  const spriteMap = new Map<PlayerId, SpriteEntry>();
  const animMap = new Map<PlayerId, PlayerAnim>();
  const gkAnimMap = new Map<PlayerId, GKAnim>();
  const playerSideMap = new Map<PlayerId, 'home' | 'away'>();

  // Precompute goal events for score tracking
  const goalEvents = timeline.events.filter(e => e.kind === 'goal');
  // Half-time whistle time (drives the second-half side switch). null = none.
  const halfTimeMs = timeline.events.find(e => e.kind === 'half_time')?.t ?? null;

  const homeSet = new Set(timeline.homeLineup);
  const homeGK = timeline.homeLineup[0];
  const awayGK = timeline.awayLineup[0];

  const fieldTex = await remapWithPalette(
    `${BASE}assets/match2d/base_sprites/CAMP_indexed.png`,
    BASE_PAL,
  );
  const field = new Sprite(fieldTex);
  field.scale.set(FIELD_SCALE);
  app.stage.addChild(field);
  app.stage.sortableChildren = true;

  // Goal-net overlay sprites. Source frames in GRAFICOS_indexed.png:
  // left goal x=[63,81], right goal x=[206,224], both 19×58. Rendered
  // at zIndex 1 so they sit OVER the ball — when the engine clamps the
  // ball inside the goal frame (simulateBallSettling, NET_DEPTH=0.025
  // and y∈[0.44,0.56]) the sprite's netting overlays it, producing the
  // "ball caught in the net" effect.
  const graficosTex = await remapWithPalette(
    `${BASE}assets/match2d/base_sprites/GRAFICOS_indexed.png`,
    BASE_PAL,
  );
  if (!isAlive()) return null;
  const leftGoalTex  = new Texture({ source: graficosTex.source, frame: new Rectangle(63,  0, 19, 58) });
  const rightGoalTex = new Texture({ source: graficosTex.source, frame: new Rectangle(206, 0, 19, 58) });

  // The field's goal posts are physically centered at unscaled y=218
  // in CAMP_indexed.png, which corresponds to scaled y=436.
  // We use an anchor.y of 31/58 because the midpoint of the posts in
  // the GRAFICOS sprite is exactly at row 31 (between row 5 and 57).
  const goalY = 218 * FIELD_SCALE;

  const leftGoalSp = new Sprite(leftGoalTex);
  leftGoalSp.scale.set(FIELD_SCALE);
  leftGoalSp.anchor.set(17 / 19, 31 / 58); // align post correctly on the home goal line
  leftGoalSp.x = PLAY_X[0] - 2 * FIELD_SCALE;
  leftGoalSp.y = goalY;
  leftGoalSp.zIndex = 1;
  app.stage.addChild(leftGoalSp);

  const rightGoalSp = new Sprite(rightGoalTex);
  rightGoalSp.scale.set(FIELD_SCALE);
  rightGoalSp.anchor.set(2 / 19, 31 / 58); // align post correctly on the away goal line
  rightGoalSp.x = PLAY_X[1] + 3 * FIELD_SCALE;
  rightGoalSp.y = goalY;
  rightGoalSp.zIndex = 1;
  app.stage.addChild(rightGoalSp);

  // Resolve each side's kit: real colours + chosen shirt pattern, or the
  // Madrid/Barca demo kits when no kit info was supplied.
  const playerAtlasJson = `${BASE}assets/match2d/atlas/spritesheet_atlas_player.json`;
  const homeSprite = kits ? `${BASE}assets/match2d/base_sprites/${spriteForStyle(kits.home.style)}` : `${BASE}assets/match2d/base_sprites/JUGALISO_indexed.png`;
  const awaySprite = kits ? `${BASE}assets/match2d/base_sprites/${spriteForStyle(kits.away.style)}` : `${BASE}assets/match2d/base_sprites/JUGARAYA_indexed.png`;
  const homePal = kits ? buildKitPalette(kits.home.colors) : KIT_MADRID;
  const awayPal = kits ? buildKitPalette(kits.away.colors) : KIT_BARCA;

  const [homeAtlas, awayAtlas, gkLeftAtlas, gkRightAtlas, ballAtlas, faltasAtlas] = await Promise.all([
    loadAtlasWithPalette(homeSprite, playerAtlasJson, homePal),
    loadAtlasWithPalette(awaySprite, playerAtlasJson, awayPal),
    loadAtlasWithPalette(`${BASE}assets/match2d/base_sprites/PORTEROI_indexed.png`, `${BASE}assets/match2d/atlas/spritesheet_atlas_gk_left.json`, KIT_GK),
    loadAtlasWithPalette(`${BASE}assets/match2d/base_sprites/PORTEROD_indexed.png`, `${BASE}assets/match2d/atlas/spritesheet_atlas_gk_right.json`, KIT_GK_AWAY),
    loadAtlasWithPalette(`${BASE}assets/match2d/base_sprites/BALON_indexed.png`, `${BASE}assets/match2d/atlas/spritesheet_atlas_ball.json`, BASE_PAL),
    loadAtlasWithPalette(`${BASE}assets/match2d/base_sprites/FALTAS_indexed.png`, `${BASE}assets/match2d/atlas/spritesheet_atlas_events.json`, BASE_PAL),
  ]);
  if (!isAlive()) return null;

  const kfs = timeline.keyframes;
  const kf0 = kfs[0];

  function spawnPlayer(id: PlayerId): void {
    const isHomeGK = id === homeGK;
    const isAwayGK = id === awayGK;
    const isGK = isHomeGK || isAwayGK;
    const atlas = isHomeGK ? gkLeftAtlas : isAwayGK ? gkRightAtlas : homeSet.has(id) ? homeAtlas : awayAtlas;
    const initKey = isHomeGK ? 'gk_left_idle_E' : isAwayGK ? 'gk_right_idle_W' : 'player_idle_E';
    const frames = atlas.animations[initKey] ?? atlas.frames.slice(0, 4);
    const sp = new AnimatedSprite(frames);
    sp.scale.set(PLAYER_SCALE);
    // Centered anchor: engine position aligns with the sprite's visual
    // midpoint so north and south players render symmetrically about
    // the field's vertical centre. Previously (0.5, 1.0) put the feet
    // at the engine position and the body extended upward, which made
    // sprites near the north touchline look closer to the line than
    // their south-side mirrors.
    sp.anchor.set(0.5, 0.5);
    sp.animationSpeed = 0.09;
    sp.play();
    app.stage.addChild(sp);
    spriteMap.set(id, { sp, atlas, isGK, isHomeGK, currentKey: initKey });

    const side: 'home' | 'away' = homeSet.has(id) ? 'home' : 'away';
    playerSideMap.set(id, side);
    if (isGK) {
      gkAnimMap.set(id, makeGKAnim());
    } else {
      // Face the ball (or center) on kickoff
      const ppos = kf0.positions[id] || { x: 0.5, y: 0.5 };
      const bpos = kf0.ball || { x: 0.5, y: 0.5 };
      const dir = dirFromDelta(bpos.x - ppos.x, bpos.y - ppos.y);
      animMap.set(id, makePlayerAnim(dir));
    }
  }

  // Spawn in order: home players first, then away
  for (const id of timeline.homeLineup) spawnPlayer(id);
  for (const id of timeline.awayLineup) spawnPlayer(id);

  const ballFrames = ballAtlas.animations['ball_ground'] ?? ballAtlas.frames.slice(0, 4);
  const ballSp = new AnimatedSprite(ballFrames);
  ballSp.scale.set(PLAYER_SCALE);
  // Centered anchor: ball/shadow visual centre at the engine ball
  // position. Makes OOB triggers symmetric — the ball visually crosses
  // the touchline at the same engine y on both sides of the field.
  ballSp.anchor.set(0.5, 0.5);
  ballSp.animationSpeed = 0.18;
  ballSp.play();

  const shadowSp = new AnimatedSprite(ballAtlas.animations['ball_shadow_h1'] ?? ballFrames);
  shadowSp.scale.set(PLAYER_SCALE);
  shadowSp.anchor.set(0.5, 0.5);
  shadowSp.alpha = 0.5;

  app.stage.addChild(shadowSp);
  app.stage.addChild(ballSp);

  // Capa de UI (por encima de jugadores y balón). Uses the FALTAS event atlas
  // ("event_out" = FUERA) which is a 136x32 horizontal strip.
  const fueraOverlay = new Container();
  fueraOverlay.zIndex = 10000;
  fueraOverlay.visible = false;

  const fueraFrames = faltasAtlas.animations['event_out'] ?? faltasAtlas.frames.slice(1, 2);
  if (fueraFrames.length > 0) {
    const fueraSp = new Sprite(fueraFrames[0]);
    fueraSp.scale.set(PLAYER_SCALE * 2);
    fueraSp.anchor.set(0.5);
    fueraOverlay.addChild(fueraSp);
  }

  fueraOverlay.x = CANVAS_W / 2;
  fueraOverlay.y = CANVAS_H / 2;
  app.stage.addChild(fueraOverlay);

  // GOAL overlay — same FALTAS atlas, 'event_goal' frame. Shown during
  // the celebration window after every goal.
  const goalOverlay = new Container();
  goalOverlay.zIndex = 10000;
  goalOverlay.visible = false;
  const goalFrames = faltasAtlas.animations['event_goal'] ?? faltasAtlas.frames.slice(2, 3);
  if (goalFrames.length > 0) {
    const goalSp = new Sprite(goalFrames[0]);
    goalSp.scale.set(PLAYER_SCALE * 2);
    goalSp.anchor.set(0.5);
    goalOverlay.addChild(goalSp);
  }
  goalOverlay.x = CANVAS_W / 2;
  goalOverlay.y = CANVAS_H / 2;
  app.stage.addChild(goalOverlay);

  // CORNER overlay — same atlas, 'event_corner_kick' frame. Shown when
  // a corner is awarded (defender's last touch over their own goal line).
  const cornerOverlay = new Container();
  cornerOverlay.zIndex = 10000;
  cornerOverlay.visible = false;
  const cornerFrames = faltasAtlas.animations['event_corner_kick'] ?? faltasAtlas.frames.slice(5, 6);
  if (cornerFrames.length > 0) {
    const cornerSp = new Sprite(cornerFrames[0]);
    cornerSp.scale.set(PLAYER_SCALE * 2);
    cornerSp.anchor.set(0.5);
    cornerOverlay.addChild(cornerSp);
  }
  cornerOverlay.x = CANVAS_W / 2;
  cornerOverlay.y = CANVAS_H / 2;
  app.stage.addChild(cornerOverlay);

  // FOUL overlay — 'event_foul' frame. Shown when a regular foul is committed.
  const foulOverlay = new Container();
  foulOverlay.zIndex = 10000;
  foulOverlay.visible = false;
  const foulFrames = faltasAtlas.animations['event_foul'] ?? [];
  if (foulFrames.length > 0) {
    const foulSp = new Sprite(foulFrames[0]);
    foulSp.scale.set(PLAYER_SCALE * 2);
    foulSp.anchor.set(0.5);
    foulOverlay.addChild(foulSp);
  }
  foulOverlay.x = CANVAS_W / 2;
  foulOverlay.y = CANVAS_H / 2;
  app.stage.addChild(foulOverlay);

  // PENALTY overlay — 'event_penalty' frame. Shown when a penalty is awarded.
  const penaltyOverlay = new Container();
  penaltyOverlay.zIndex = 10000;
  penaltyOverlay.visible = false;
  const penaltyFrames = faltasAtlas.animations['event_penalty'] ?? [];
  if (penaltyFrames.length > 0) {
    const penaltySp = new Sprite(penaltyFrames[0]);
    penaltySp.scale.set(PLAYER_SCALE * 2);
    penaltySp.anchor.set(0.5);
    penaltyOverlay.addChild(penaltySp);
  }
  penaltyOverlay.x = CANVAS_W / 2;
  penaltyOverlay.y = CANVAS_H / 2;
  app.stage.addChild(penaltyOverlay);

  // CARD overlay — yellow/red card sprites carved out of the last frame
  // of GRAFICOS (bbox 21x23 at x=2510,y=37). The source sprite is drawn
  // with palette index 5 (yellow); we build a second texture under a
  // patched palette where index 5 is swapped for red (index 9) to get
  // the red-card variant without any tinting. Three child sprites:
  //   yellowLeft  — used alone for a single yellow, or as the LH of a
  //                 second-yellow trio.
  //   yellowRight — only shown for second-yellow.
  //   red         — shown for direct red OR second-yellow.
  // The overlay sits just below the foul/penalty overlay (anchor 0.5)
  // and toggles per-child visibility when the 'card' event fires.
  const CARD_W = 21;
  const CARD_H = 23;
  const CARD_FRAME_X = 2510;
  const CARD_FRAME_Y = 37;
  const RED_CARD_PAL = BASE_PAL.map((c, i) => i === 5 ? BASE_PAL[9] : c) as Array<[number, number, number]>;
  const graficosRedTex = await remapWithPalette(
    `${BASE}assets/match2d/base_sprites/GRAFICOS_indexed.png`,
    RED_CARD_PAL,
  );
  if (!isAlive()) return null;
  const cardYellowTex = new Texture({ source: graficosTex.source,    frame: new Rectangle(CARD_FRAME_X, CARD_FRAME_Y, CARD_W, CARD_H) });
  const cardRedTex    = new Texture({ source: graficosRedTex.source, frame: new Rectangle(CARD_FRAME_X, CARD_FRAME_Y, CARD_W, CARD_H) });
  const cardOverlay = new Container();
  cardOverlay.zIndex = 10001;
  cardOverlay.visible = false;
  const cardYLeft  = new Sprite(cardYellowTex);
  const cardYRight = new Sprite(cardYellowTex);
  const cardRed    = new Sprite(cardRedTex);
  const CARD_SCALE = PLAYER_SCALE * 1.5;
  const cardSpacing = CARD_W * CARD_SCALE + 4;
  for (const sp of [cardYLeft, cardYRight, cardRed]) {
    sp.scale.set(CARD_SCALE);
    sp.anchor.set(0.5);
    sp.visible = false;
    cardOverlay.addChild(sp);
  }
  // Sit the cards just under the foul/penalty overlay so all three read
  // as a unit. CARD_OFFSET_Y is in canvas px; tweak if the overlays
  // start to overlap after scale changes.
  const CARD_OFFSET_Y = 56;
  cardOverlay.x = CANVAS_W / 2;
  cardOverlay.y = CANVAS_H / 2 + CARD_OFFSET_Y;
  app.stage.addChild(cardOverlay);

  return {
    timeline,
    spriteMap,
    animMap,
    gkAnimMap,
    playerSideMap,
    ballAtlas,
    gkLeftAtlas,
    gkRightAtlas,
    ballSp,
    shadowSp,
    homeGK,
    awayGK,
    halfTimeMs,
    goalEvents,
    fueraOverlay,
    goalOverlay,
    cornerOverlay,
    foulOverlay,
    penaltyOverlay,
    cardOverlay,
    cardYLeft,
    cardYRight,
    cardRed,
    cardSpacing,
    rt: {
      goalIdx: 0,
      homeScore: 0,
      awayScore: 0,
      fueraTimer: 0,
      goalTimer: 0,
      cornerTimer: 0,
      foulTimer: 0,
      penaltyTimer: 0,
      cardTimer: 0,
      gameTime: 0,
      kfPointer: 0,
      evtPtr: 0,
    },
  };
}

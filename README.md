# OpenFútbol

Un juego de gestión de fútbol retro inspirado en el PC Fútbol de los 90.
Los equipos son inventados, los nombres son chistes malos y los jugadores tampoco existen.
Aun así engancha más de lo que debería. Está probado.

**[Jugar aquí →](https://x1010x.github.io/openfutbol-public/)**

---

Gestionas un equipo de la nada. Pones la alineación, negocias fichajes, te preocupas
por el cansancio de jugadores que ni existen y maldices al árbitro de una simulación.
Los partidos van minuto a minuto y cada estadística de cada jugador influye en lo que pasa.
Hay modo Fantasy para jugar contra amigos, editor para crear tus propios equipos con sus
escudos y sus colores, y una temporada entera con tabla, premios y finanzas siempre al límite.

Todo en el navegador. Gratis. Sin instalación.

## Sobre los nombres

Sí, algunos nombres de jugadores pueden coincidir con personas reales.
Es un juego gratuito, de navegador, en pixel art de 8 bits, sin ánimo de lucro,
donde tu alter ego pixelado tiene una estadística de tiro de 64 sobre 99.

Si alguien tiene tiempo libre para enfadarse por eso,
le enviamos un abrazo y le recomendamos salir más.

## Colaborar

No hace falta saber programar. Hace falta tener un chiste bueno
o ganas de que tu vecino salga en el juego.

**[t.me/openfutbol](https://t.me/openfutbol)** — mandad lo que tengáis, nos encargamos del resto.

Instrucciones detalladas en [CONTRIBUIR.md](CONTRIBUIR.md).

## Arrancar

```bash
git clone https://github.com/x1010x/openfutbol-public.git
cd openfutbol-public
npm install
npm run dev
```

`npm run build` para producción. Si algo falla la culpa es tuya.

## Tecnología

| Capa | Elección |
|---|---|
| UI | React 19, TypeScript, Tailwind CSS v4 |
| Build | Vite 8 (Rolldown), `tsc -b` para tipos |
| Estado | `useState` + `localStorage` — sin store externo, sin excusas |

## Estructura del proyecto

```
src/
  App.tsx                   App principal: rutas, bucle de partido, todo el estado
  types/game.d.ts           Tipos TypeScript compartidos

  engine/
    simEngine.ts            Simulación minuto a minuto (el responsable de tus derrotas)
    formations.ts           Formaciones, penalización fuera de posición, media efectiva
    calendar.ts             Generador de calendario de liga
    playerMood.ts           Sistema de estado de ánimo (tus jugadores también tienen días malos)

  store/
    leagueStore.ts          Estado de liga, estadísticas, fichajes, salarios

  data/
    mockTeams.ts            Carga la BD, construye objetos Team, curvas de edad
    economy.ts              Precios, salarios y el bonus de TV que nunca es suficiente
    db/
      players/              374 jugadores inventados con estadísticas generadas
      teams/                Plantillas y datos de temporada de 21 equipos de broma
      free_agents.json      Jugadores sin equipo, por algo será
      names/                Nombres de jugadores, equipos, entrenadores y estadios por UUID

  components/               Componentes de UI
```

## Los datos

Los jugadores, equipos y nombres están desacoplados para que cualquiera pueda editarlos
sin romper nada (o rompiendo lo mínimo). Cambia un nombre en `names/` y se propaga
a todo el juego en tiempo de ejecución. Si quieres que el Torpedo de Cuenca se llame
de otra manera, ese es el sitio.

## Licencia

PolyForm Noncommercial License 1.0.0

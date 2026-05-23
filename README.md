# OpenFutbol

Juego de gestión de fútbol retro de código abierto inspirado en el PC Fútbol de los 90.
Los equipos son inventados, los nombres son chistes malos, los jugadores no existen
y aun así es probable que te enganches más que a cualquier otra cosa que tengas pendiente.

Juega aquí: https://x1010x.github.io/openfutbol-public/

Mándanos tus ideas aquí: https://t.me/openfutbol

## Qué tiene

- Gestiona un equipo de fútbol imaginario con nombre de broma. Nadie te juzga.
- Configura la alineación, la formación y la táctica como si de verdad importara.
- Partidos simulados minuto a minuto donde las estadísticas de cada jugador
  deciden si ganas o si culpas al árbitro.
- Cansancio, sustituciones, lesiones y sanciones para que no te relajes ni un momento.
- Fichajes, cláusulas de rescisión y finanzas que siempre van peor de lo que parecen.
- Modo Fantasy: snake draft con tus amigos para ver quién entiende menos de fútbol.
- Tabla, Pichichi, Zamora y estadísticas de temporada para regodearte o llorar.
- Premios de fin de temporada y progresión entre temporadas para que el sufrimiento
  tenga continuidad.

## Sobre los nombres

Sí, algunos nombres de jugadores pueden coincidir con personas reales.
Es un juego gratuito, de navegador, en pixel art de 8 bits, sin ánimo de lucro,
donde tu alter ego pixelado tiene una estadística de tiro de 64 sobre 99.

Si alguien tiene tiempo libre para enfadarse por eso,
le enviamos un abrazo y le recomendamos salir más.

## Arrancar

```bash
git clone https://github.com/x1010x/openfutbol-public.git
cd openfutbol-public
npm install
npm run dev
```

`npm run dev` arranca el servidor de desarrollo Vite.
`npm run build` comprueba los tipos y genera el bundle de producción.
Si algo falla la culpa es tuya.

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
  index.css                 Config de Tailwind y estilos del tema

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
      names/
        player_names.json   Nombres de jugadores por UUID
        team_names.json     Nombres de equipos por UUID
        manager_names.json  Entrenadores por UUID_año
        stadium_names.json  Estadios por UUID_año

  components/               Componentes de UI
```

## Los datos

Los jugadores, equipos y nombres están desacoplados para que cualquiera pueda tocarlos
sin romper nada (o rompiendo lo mínimo):

- `players/` — Estadísticas por UUID. Cambia habilidades, edad pico o año de nacimiento.
- `teams/` — Plantillas y configuración de temporada.
- `names/` — Cambia un nombre aquí y se propaga a todo el juego en tiempo de ejecución.
  Si quieres que el Torpedo de Cuenca se llame de otra manera, este es el sitio.

## Colaborar

No hace falta saber programar. No hace falta saber inglés. Hace falta tener un chiste bueno
o ganas de que tu vecino salga en el juego.

**La forma más fácil: [t.me/openfutbol](https://t.me/openfutbol)**

Entráis al canal, mandáis lo que tengáis y nosotros nos encargamos del resto.

### Proponer un equipo

Necesitáis un nombre con su chiste y un escudo. El escudo lo genera una IA gratis —
copiad este prompt en ChatGPT o cualquier generador de imágenes y añadid al final
el nombre y concepto de vuestro equipo:

> Escudo de club de fútbol en pixel art retro, estilo de insignia de videojuego arcade
> auténtico de los años 90 inspirado en los clásicos de SNES y Neo Geo, textura de parche
> bordado muy detallada, contornos de píxeles gruesos, tipografía apilada en negrita con
> el nombre del equipo, club de fútbol parodia con argot español humorístico, mascota o
> icono central que ilustra el chiste, composición de escudo simétrica, paleta de colores
> retro limitada, sombreado y tramado ricos en píxeles, estética de ultras vintage, fondo
> azul marino oscuro, pixel art limpio y nítido, bordes de tela cosida falsos, iluminación
> dramática, energía de caricatura exagerada, proporciones icónicas de escudo de fútbol.

Mandad la imagen al canal con el nombre, el chiste y los colores (vale con decir "rojo y negro").

### Añadir la cara de un jugador

Adjuntad una foto a ChatGPT o cualquier IA multimodal y usad este prompt:

> Icono de retrato en pixel art retro de 8 bits que recrea aproximadamente los rasgos
> faciales, la expresión y el pelo de la foto de referencia proporcionada. Debe llevar
> una camiseta de fútbol sin ningún escudo ni equipo visible. Sin texto de ningún tipo.
> El fondo dentro del retrato es negro sólido y profundo. El icono está enmarcado por
> un grueso borde cuadrado blanco. La imagen puede ser pequeña. Es para un simulador
> de fútbol. Conservar el borde.

Mandad la imagen al canal con el nombre de la persona y en qué equipo queréis que juegue.

Para los más atrevidos: [CONTRIBUIR.md](CONTRIBUIR.md)

## Licencia

PolyForm Noncommercial License 1.0.0

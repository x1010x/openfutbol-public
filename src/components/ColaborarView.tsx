interface Props {
  onBack: () => void;
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-4">
    <h3 className="text-vga-light-green text-[10px] mb-2 border-b border-vga-gray pb-1">
      {title}
    </h3>
    <div className="text-vga-bright-white text-[9px] leading-relaxed space-y-2">
      {children}
    </div>
  </div>
);

const Item = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2">
    <span className="text-vga-yellow shrink-0">›</span>
    <span>{children}</span>
  </div>
);

export const ColaborarView = ({ onBack }: Props) => (
  <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-500">
    <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-vga-yellow text-sm underline decoration-double">
          COLABORAR
        </h2>
        <button
          onClick={onBack}
          className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
        >
          VOLVER
        </button>
      </div>

      <div className="bg-vga-black border border-vga-yellow p-3 text-[9px] text-vga-bright-white leading-relaxed mb-4">
        <span className="text-vga-yellow font-bold">Aviso:</span> esto está en desarrollo.
        Hay bugs, hay cosas feas y hay decisiones de diseño cuestionables.
        Todos los comentarios constructivos son bienvenidos.
        Para decir que el juego es una mierda ya lo sabemos — pero si además
        quieres ayudar a que lo sea menos, este es el sitio.
      </div>

      <p className="text-vga-bright-white text-[9px] leading-relaxed mb-4">
        Queremos que colaboréis todos — aunque no sepáis nada de informática.
        Si tenéis un chiste bueno, una idea para un equipo o queréis que vuestro
        vecino salga en el juego, esto es para vosotros. No hace falta saber
        programar. No hace falta nada más que ganas.
      </p>

      <Section title="LA FORMA MAS FACIL: TELEGRAM">
        <p>
          Mandadnos directamente vuestras ideas, escudos e imágenes de jugadores
          al canal:
        </p>
        <p>
          <a
            href="https://t.me/openfutbol"
            target="_blank"
            rel="noreferrer"
            className="text-vga-cyan underline hover:text-vga-yellow"
          >
            t.me/openfutbol
          </a>
        </p>
        <p>
          Entráis, mandáis lo que tengáis y nosotros nos encargamos del resto.
          Sin cuentas raras, sin tecnicismos, sin complicaciones.
        </p>
      </Section>

      <Section title="PROPONER UN NUEVO EQUIPO">
        <p>
          Solo necesitáis dos cosas: un nombre con su chiste y un escudo.
        </p>
        <p className="text-vga-yellow">El nombre</p>
        <p>
          Tiene que ser un juego de palabras o una broma. Mirad los equipos que
          ya hay en el juego para coger ideas. Cuanto peor el chiste, mejor.
        </p>
        <p className="text-vga-yellow">El escudo</p>
        <p>
          Lo genera una inteligencia artificial gratis. Copiad este texto, pegadlo
          en ChatGPT o cualquier IA que genere imágenes, y añadid al final el
          nombre y concepto de vuestro equipo:
        </p>
        <div className="bg-vga-black border border-vga-gray p-2 text-vga-cyan text-[8px] leading-relaxed mt-1">
          Escudo de club de fútbol en pixel art retro, estilo de insignia de
          videojuego arcade auténtico de los años 90 inspirado en los clásicos
          de SNES y Neo Geo, textura de parche bordado muy detallada, contornos
          de píxeles gruesos, tipografía apilada en negrita con el nombre del
          equipo, club de fútbol parodia con argot español humorístico, mascota
          o icono central que ilustra el chiste, composición de escudo simétrica,
          paleta de colores retro limitada, sombreado y tramado ricos en píxeles,
          estética de ultras vintage, fondo azul marino oscuro, pixel art limpio
          y nítido, bordes de tela cosida falsos, iluminación dramática, energía
          de caricatura exagerada, proporciones icónicas de escudo de fútbol.
        </div>
        <p className="mt-1">
          Mandad la imagen al canal de Telegram junto con el nombre del equipo,
          el chiste y los colores (podéis decir simplemente "rojo y negro",
          no hace falta nada técnico).
        </p>
      </Section>

      <Section title="AÑADIR LA CARA DE UN JUGADOR">
        <p>
          Si queréis que alguien que conocéis aparezca en el juego, adjuntad su
          foto a ChatGPT o cualquier IA y usad este texto:
        </p>
        <div className="bg-vga-black border border-vga-gray p-2 text-vga-cyan text-[8px] leading-relaxed mt-1">
          Icono de retrato en pixel art retro de 8 bits que recrea aproximadamente
          los rasgos faciales, la expresión y el pelo de la foto de referencia
          proporcionada. Debe llevar una camiseta de fútbol sin ningún escudo ni
          equipo visible. Sin texto de ningún tipo. El fondo dentro del retrato
          es negro sólido y profundo. El icono está enmarcado por un grueso borde
          cuadrado blanco. La imagen puede ser pequeña. Es para un simulador de
          fútbol. Conservar el borde.
        </div>
        <p className="mt-1">
          Mandad la imagen al canal de Telegram con el nombre de la persona y en
          qué equipo queréis que juegue.
        </p>
      </Section>

      <Section title="LO QUE VIENE">
        <Item>Crear y editar equipos completos desde dentro del juego</Item>
        <Item>Subir y asignar retratos de jugadores sin tocar código</Item>
        <Item>
          Ajustar las mecánicas del simulador — con qué probabilidad marca un
          delantero según sus habilidades contra el portero contrario, cómo
          influye el cansancio, y muchas cosas más
        </Item>
        <p className="mt-1">
          La idea es que cualquiera pueda personalizar el juego a su gusto sin
          necesidad de saber programar.
        </p>
      </Section>

      <div className="text-center mt-2">
        <a
          href="https://t.me/openfutbol"
          target="_blank"
          rel="noreferrer"
          className="text-vga-cyan text-[9px] underline hover:text-vga-yellow"
        >
          t.me/openfutbol — dudas, ideas, chorradas, todo bienvenido
        </a>
      </div>
    </div>
  </div>
);

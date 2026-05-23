import { useEffect, useRef } from 'react';

interface Props {
  onBack: () => void;
  scrollTo?: 'changelog' | 'engine';
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

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div className="flex gap-2">
    <span className="text-vga-yellow shrink-0">›</span>
    <span>{children}</span>
  </div>
);

export const InstructionsView = ({ onBack, scrollTo }: Props) => {
  const changelogRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollTo === 'changelog' && changelogRef.current) {
      changelogRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (scrollTo === 'engine' && engineRef.current) {
      engineRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollTo]);

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="bg-vga-blue p-4 border-4 border-vga-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-vga-yellow text-sm underline decoration-double">
            AYUDA
          </h2>
          <button
            onClick={onBack}
            className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
          >
            VOLVER
          </button>
        </div>

        <Section title="MODOS DE JUEGO">
          <p>
            <span className="text-vga-yellow">JUGAR</span> — Elige una temporada y un equipo. Ninguno es real.
            Los nombres son chistes malos, los jugadores son inventados y el estadio probablemente no existe.
            Compites en una liga con otros once equipos igual de dudosos. Gana el que menos vergüenza pase.
          </p>
          <p>
            <span className="text-vga-yellow">FANTASY</span> — Crea tu propia liga y haz un draft de jugadores
            como si supieras lo que estás haciendo. Modo <span className="text-vga-cyan">LIBRE</span> para los
            que se creen Florentino, o modo <span className="text-vga-cyan">CON CAP</span> con un límite de
            1350 MED por equipo para los que prefieren sufrir con presupuesto. 18 rondas, muchos arrepentimientos.
          </p>
          <p>
            <span className="text-vga-yellow">EDITOR</span> — Crea equipos desde cero, ponle un nombre ridículo,
            unos colores horribles y compártelo. Los equipos del editor se pueden meter directamente en una liga
            FANTASY para hacerle la vida imposible a tus amigos.
          </p>
        </Section>

        <Section title="CICLO DE JUEGO (LIGA)">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Elige temporada, país y equipo.</li>
            <li>Configura tu ALINEACIÓN (11 titulares + suplentes).</li>
            <li>Ajusta el PRECIO DE ENTRADA en DINERO.</li>
            <li>Juega cada jornada hasta el final de la temporada.</li>
          </ol>
        </Section>

        <Section title="CICLO DE JUEGO (FANTASY)">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Selecciona el año de la liga y los equipos participantes (2–8).</li>
            <li>Indica cuál es tu equipo con el botón <span className="text-vga-cyan">YO</span>.</li>
            <li>El orden del sorteo se decide al azar una vez y no cambia. Si eres el 3.° siempre eliges 3.°.</li>
            <li>Cada ronda indica la posición recomendada. Puedes fichar cualquier jugador del pool.</li>
            <li>Tras 18 rondas la liga arranca con las plantillas que cada equipo ha elegido.</li>
          </ol>
        </Section>

        <div ref={engineRef}>
        <Section title="ESTADÍSTICAS DEL JUGADOR">
          <p>Cada jugador tiene 6 estadísticas base (0-99):</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><span className="text-vga-yellow">VEL</span> — Velocidad. Carrera y aceleración.</li>
            <li><span className="text-vga-yellow">REG</span> — Regate. Capacidad de superar rivales.</li>
            <li><span className="text-vga-yellow">PAS</span> — Pase. Precisión y visión de juego.</li>
            <li><span className="text-vga-yellow">TIR</span> — Tiro. Cuanto más alto, más goles.</li>
            <li><span className="text-vga-yellow">DEF</span> — Defensa. Robos, coberturas y duelos.</li>
            <li><span className="text-vga-yellow">FIS</span> — Físico. Resistencia y aguante.</li>
          </ul>
          <p>
            La <span className="text-vga-yellow">MED</span> no es una media simple — cada posición
            pondera los atributos de forma distinta. El tiro vale mucho más para un delantero que
            para un defensa, y el regate de un extremo pesa más que el de un centrocampista.
            El resultado se ajusta además por condición física y estado de ánimo.
          </p>
          <p>
            Las estadísticas dependen de la POSICIÓN: un mismo jugador tiene
            valores distintos según dónde juegue. Ponerlo fuera de su posición natural
            penaliza su rendimiento.
          </p>
          <p>
            La EDAD también influye. Cerca de su pico (varía por posición) el jugador
            rinde al máximo. Alejarse del prime penaliza el rendimiento, pero nunca por debajo del 70%.
          </p>
        </Section>

        <Section title="SIMULACIÓN DEL PARTIDO">
          <p>
            La MED del equipo es la media de los titulares en el campo. Las expulsiones
            la bajan en directo y se notan en el juego.
          </p>
          <p>
            La posesión depende de la fuerza de cada equipo y de la ventaja del local.
            El equipo con el balón ataca; el otro defiende con sus propias estadísticas.
          </p>
          <p>
            <span className="text-vga-yellow">Disparos:</span> el rematador se enfrenta
            al portero y la defensa rival. Un delantero top contra una zaga floja
            marca mucho más que la media.
          </p>
          <p>
            <span className="text-vga-yellow">Tarjetas:</span> los defensas agresivos
            cometen más faltas. Una segunda amarilla es roja: expulsión inmediata
            y el jugador se pierde el siguiente partido.
          </p>
          <p>
            Antes de cada partido puedes ver ambas alineaciones en la pizarra táctica.
            Toca cualquier jugador — tuyo o rival — para ver su ficha. Toca un círculo
            tuyo para cambiarlo por un suplente sin gastar un cambio oficial.
          </p>
        </Section>

        <Section title="CONDICIÓN FÍSICA (CAN)">
          <p>
            Los jugadores se cansan durante el partido y esa fatiga persiste
            entre jornadas. Un jugador que llega agotado al siguiente partido rinde menos.
          </p>
          <p>
            Cada jornada se recupera parte de la condición, pero no siempre al 100%.
            La barra CAN es visible en PLANTILLA y en ALINEACIÓN.
          </p>
        </Section>

        <Section title="ESTADO DE ÁNIMO (ANI)">
          <p>
            Cada jugador tiene un estado de ánimo entre cinco niveles:
            <span className="text-vga-light-red"> ▼▼ </span>
            <span className="text-vga-bright-white">▼ </span>
            <span className="text-vga-yellow">— </span>
            <span className="text-vga-light-cyan">▲ </span>
            <span className="text-vga-light-green">▲▲</span>.
            Se muestra junto a su MED en la ficha y en la alineación.
          </p>
          <p>
            El ánimo afecta al rendimiento sin modificar los valores permanentes.
            Depende de los minutos jugados, los goles, las asistencias y si el
            jugador es titular habitual.
          </p>
        </Section>

        <Section title="SUSTITUCIONES Y TÁCTICA EN DIRECTO">
          <p>
            Hasta 3 cambios por partido. El juego se pausa al llegar al descanso
            y abre el panel automáticamente. También puedes abrirlo en cualquier momento
            con el botón CAMBIOS. Haz todos los cambios que quieras y pulsa CONTINUAR cuando termines.
          </p>
          <p>
            En el panel también puedes cambiar la <span className="text-vga-yellow">FORMACIÓN</span>,
            usar <span className="text-vga-yellow">AUTO-11</span> para recomponer el mejor XI disponible,
            o alternar entre <span className="text-vga-yellow">TAC:POS</span> y <span className="text-vga-yellow">TAC:LIBRE</span> sin salir del partido.
          </p>
        </Section>

        <Section title="LESIONES Y SANCIONES">
          <p>
            Un jugador puede lesionarse durante el partido. El juego hace una
            sustitución de emergencia automática (cuenta como uno de los 3 cambios).
            El jugador lesionado no puede alinearse hasta que se recupere — verás
            el badge <span className="text-vga-light-red">LES</span> con las jornadas que le quedan.
          </p>
          <p>
            Los jugadores lesionados o sancionados se eliminan automáticamente de la
            alineación dejando su hueco vacío. Toca el hueco en la previa para elegir
            quién entra.
          </p>
        </Section>

        <Section title="FICHAJES Y CLAUSULAZO">
          <p>
            El precio de un jugador depende de su MED y su edad respecto al pico.
            Los jóvenes con proyección valen más que un veterano de la misma media.
          </p>
          <p>
            Los rivales mandan ofertas por tus jugadores y pueden aceptar o rechazar
            las tuyas. Las ofertas se agrupan por jugador en PLANTILLA — ábrelas para
            ver todos los clubes interesados. La bolsa de fichajes rota cada jornada
            con libres y jugadores en venta.
          </p>
          <p>
            <span className="text-vga-yellow">Oferta normal</span> — jugadores en venta o agentes libres.
            Negocias el precio y el club puede rechazarla.
          </p>
          <p>
            <span className="text-vga-light-red font-bold">CLAUSULAZO TEBAS</span> — si quieres fichar
            a un jugador que no está en el mercado, puedes activar su cláusula de rescisión.
            El coste es el doble de su valor base y el traspaso es inmediato sin negociación.
            No aplica a jugadores en venta ni a agentes libres.
          </p>
        </Section>

        <Section title="FINANZAS">
          <p>
            Cada jornada ingresas por taquilla (depende del precio de entrada, el rival
            y tu posición en la tabla) y pagas salarios. Si la caja llega a cero,
            los fichajes se bloquean.
          </p>
        </Section>

        <Section title="PARTIDOS AUTOMÁTICOS">
          <p>
            Los partidos que no juegas tú se resuelven con un modelo simplificado.
            El equipo más fuerte tiene más probabilidades de ganar, pero siempre
            hay margen para sorpresas. La ventaja local se aplica a todos los equipos.
          </p>
        </Section>
        </div>

        <Section title="CONSEJOS PARA GANAR">
          <Tip>Pon siempre a cada jugador en su posición natural. Un delantero de centrocampista es MED tirada.</Tip>
          <Tip>El portero gana partidos por sí solo. No escatimes en el POR.</Tip>
          <Tip>Usa AUTO-FIX 11 si no sabes cómo alinear — te da el mejor XI posible con tu plantilla.</Tip>
          <Tip>Vigila las barras CAN antes de cada partido. Un titular agotado vale menos que un suplente fresco.</Tip>
          <Tip>Haz cambios en el descanso si hay jugadores en rojo — no esperes al 80.</Tip>
          <Tip>Dale minutos a los suplentes en los partidos fáciles. Los jugadores sin minutos se frustran y rinden peor.</Tip>
          <Tip>Un jugador en racha de goles tiene el ánimo alto — mantenlo en el campo.</Tip>
          <Tip>Cuidado con los defensas con tarjeta amarilla. Una segunda = roja y se pierde el siguiente partido.</Tip>
          <Tip>El precio de entrada óptimo no es el máximo — sube demasiado y la taquilla baja. Experimenta.</Tip>
          <Tip>Los jugadores jóvenes cerca de su pico son la mejor inversión a largo plazo.</Tip>
          <Tip>Si juegas fuera de casa contra un rival superior, aguanta bien atrás. La ventaja local funciona en los dos sentidos.</Tip>
          <Tip>El clausulazo cuesta el doble pero es garantizado. Úsalo solo cuando el jugador vale realmente la pena.</Tip>
          <Tip>La IA también rota a sus titulares cuando están cansados — no des por sentado que van a llegar al tope.</Tip>
          <Tip>En FANTASY, los primeros turnos son para portero y defensas. Los rivales también los quieren.</Tip>
          <Tip>En FANTASY, fichar 18 jugadores sin portero es válido, pero sufrirás en los duelos de disparo.</Tip>
          <Tip>Un equipo del EDITOR añadido a una liga FANTASY parte sin plantilla — el sorteo se la da.</Tip>
        </Section>

<div ref={changelogRef} id="changelog">
        <Section title="CAMBIOS RECIENTES">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <span className="text-vga-cyan">v1.0.0</span> — Preparado para repositorio público. 
              Nueva arquitectura modular de datos basada en UUIDs y placeholders. 
              Limpieza de metadatos internos y optimización del motor de carga JSON.
            </li>
            <li>
              <span className="text-vga-cyan">v0.1.0 - v0.14.2</span> — Desarrollo inicial: 
              Simulación de partidos minuto a minuto, sistema de temas (Retrocutre/Retrocool), 
              modo Fantasy Draft, gestión económica, editor de equipos y mercado de fichajes.
            </li>
          </ul>
        </Section>
        </div>
      </div>

      <div className="bg-vga-black p-4 border-2 border-vga-cyan text-[9px] text-vga-bright-white space-y-2">
        <p className="text-vga-cyan font-bold">COLABORA EN EL JUEGO</p>
        <p>
          ¿Tienes una idea para un equipo? ¿Un chiste malo que merece ser un escudo?
          ¿Quieres que tu cara aparezca en un jugador pixelado? Mándanoslo al canal de Telegram:
        </p>
        <p>
          <a href="https://t.me/openfutbol" target="_blank" rel="noreferrer"
            className="text-vga-cyan underline hover:text-vga-yellow">
            t.me/openfutbol
          </a>
          {' '}— sin cuentas raras, sin tecnicismos, sin complicaciones.
        </p>
        <p>
          Para más detalles sobre cómo proponer equipos, generar escudos con IA
          y añadir jugadores, pulsa <span className="text-vga-yellow">COLABORAR</span> en el menú principal.
        </p>
      </div>

      <div className="bg-vga-magenta p-2 text-[8px] text-vga-bright-white text-center border-2 border-vga-white">
        ESTA PÁGINA SE ACTUALIZA A MEDIDA QUE EL JUEGO EVOLUCIONA.
      </div>
    </div>
  );
};

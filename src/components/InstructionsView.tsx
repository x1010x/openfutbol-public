import { useEffect, useRef } from 'react';
import { getLang, useT } from '../i18n';

interface Props {
  onBack: () => void;
  onColaborar: () => void;
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

const ContentES = ({ onColaborar, changelogRef, engineRef }: {
  onColaborar: () => void;
  changelogRef: React.RefObject<HTMLDivElement | null>;
  engineRef: React.RefObject<HTMLDivElement | null>;
}) => (
  <>
    <Section title="MODOS DE JUEGO">
      <p>
        <span className="text-vga-yellow">JUGAR</span> — Elige una temporada y un equipo. Ninguno es real.
        Los nombres son chistes malos, los jugadores son inventados y el estadio probablemente no existe.
        Compites en una liga con otros once equipos igual de dudosos. Gana el que menos vergüenza pase.
      </p>
      <p>
        <span className="text-vga-yellow">PRO MANAGER</span> — El modo difícil. Eres un entrenador con
        carrera propia: eliges año, te pones nombre y recibes ofertas de trabajo según tu reputación.
        La junta te evalúa cada jornada con el{' '}
        <span className="text-vga-cyan">Florentinómetro</span> (0–10). Gana partidos, haz buenos fichajes
        y cúmplete el objetivo marcado para mantenerlos contentos. Si el medidor cae demasiado,
        Florentino llama por teléfono. La primera vez avisa. La segunda avisa más fuerte.
        La tercera… recoges tus cosas. Cuando te echan recibes ofertas de nuevos clubes según tu historial:
        los clubes que ya te despidieron <span className="text-vga-light-red">nunca</span> volverán a llamarte.
        Si nadie quiere saber nada de ti, fin de carrera. Si llegas a 9 puntos en el medidor,
        Florentino te regala Marbella y da bonus a los jugadores. Tu carrera entera vive en una vista
        propia con cada temporada desglosada (posición, W/D/L, puntos, Florentinómetro y balance de fichajes).
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
      <p>
        <span className="text-vga-yellow">VARIAS CARRERAS A LA VEZ</span> — Cualquiera de estos modos
        vive en una partida guardada propia. Puedes tener una Pro Manager en serio, una de prueba
        para experimentar, y una FANTASY con amigos, todas en paralelo. Cambias entre ellas desde
        COPIA → PARTIDAS sin perder nada.
      </p>
    </Section>

    <Section title="PRO MANAGER — FLORENTINÓMETRO">
      <p>
        El Florentinómetro mide la satisfacción de la junta en tiempo real (0–10, empieza en 5).
        Sube con victorias, buenos fichajes y finanzas saneadas. Baja con derrotas, malos fichajes
        y números en rojo.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="text-vga-light-green">≥ 7</span> — La junta está contenta. Recibes mensajes de apoyo.</li>
        <li><span className="text-vga-yellow">5 – 7</span> — Zona neutral. Nadie dice nada (todavía).</li>
        <li><span className="text-vga-light-red">{'< 5'}</span> — Zona de peligro. Cada jornada hay probabilidad de recibir un aviso de la directiva.</li>
        <li><span className="text-vga-light-red font-bold">≥ 9</span> — Florentino te promete Marbella, da bonus a los jugadores y transfiere €2M al club.</li>
      </ul>
      <p>
        Los <span className="text-vga-yellow">avisos</span> acumulan (máximo 3 antes del despido).
        Si recuperas el medidor por encima de 5, los avisos se perdonan de uno en uno.
        Los primeros 5 partidos tras llegar a un club son de gracia — la junta espera a ver cómo respondes.
      </p>
      <p>
        <span className="text-vga-light-red font-bold">Memoria de los clubes:</span> los clubes
        que te despiden no te volverán a ofrecer trabajo. Cada despido reduce tu lista de
        opciones futuras. Si ningún club quiere ya saber de ti, la carrera termina ahí y solo
        queda retirarte.
      </p>
      <p>
        Los mensajes de la junta aparecen después del resultado del partido.
        Puedes releerlos pinchando en el icono de advertencia ⚠ en la barra de estado.
        Tu nombre de entrenador en la barra también es un acceso directo a tu carrera, donde
        verás cada temporada con su posición, W/D/L, puntos, Florentinómetro y balance de fichajes.
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

    <Section title="POSICIONES">
      <p>
        Cada posición pondera las estadísticas de forma distinta, así que un mismo número en
        TIR vale mucho más para un delantero que para un central. Estas son las posiciones que
        usa el motor y los atributos que más pesan en cada una:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="text-vga-yellow">POR</span> — Portero. Solo cuenta su estadística de portero; defender goles es lo único que importa.</li>
        <li><span className="text-vga-yellow">DEF</span> — Defensa. DEF y FIS pesan mucho; PAS y VEL ayudan al juego de salida. Los defensas agresivos cometen más faltas.</li>
        <li><span className="text-vga-yellow">MED</span> — Centrocampista. PAS, REG y FIS equilibrados. La pieza que más toca el balón.</li>
        <li><span className="text-vga-yellow">AML / AMR</span> — Extremos. REG y VEL mandan. Generan ocasiones y pueden rematar. Una de las posiciones más rentables.</li>
        <li><span className="text-vga-yellow">DEL</span> — Delantero. TIR por encima de todo. Cada disparo se enfrenta al portero rival y la defensa.</li>
      </ul>
      <p>
        <span className="text-vga-light-red">Jugar fuera de posición</span> baja todas las
        estadísticas en torno al 82% (ajustable en AJUSTES DEL MOTOR). En el caso del portero
        la penalización es aún mayor: poner un jugador de campo en la portería es prácticamente
        regalar goles. AUTO-FIX 11 elige el mejor XI respetando posiciones naturales siempre que
        puede.
      </p>
      <p>
        Cada jugador puede tener varias posiciones permitidas (por ejemplo, un MED que también
        rinde como AML). Las posiciones permitidas vienen del pack importado o se calculan a
        partir de las stats del jugador. Verás todas las posiciones de un jugador en su ficha.
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
        <span className="text-vga-cyan font-bold">MERCADO DE FICHAJES:</span> la pantalla muestra
        una tabla ordenable con todos los jugadores disponibles (en venta y libres). Filtra por
        tipo o posición, busca por nombre y ordena por edad, OVR, club o precio. Al pinchar
        una fila se abre la ficha del jugador en el panel lateral con foto, estadísticas y
        botones de acción. A su lado tienes el feed de ACTIVIDAD DEL MERCADO con todos los
        movimientos de la temporada (fichajes, clausulazos y retiros).
      </p>
      <p>
        Las ofertas entrantes por tus jugadores se gestionan desde PLANTILLA. Ábrelas para
        ver todos los clubes interesados.
      </p>
      <p>
        <span className="text-vga-yellow">Oferta normal</span> — jugadores en venta o agentes libres.
        Negocias el precio y el club puede rechazarla.
      </p>
      <p>
        <span className="text-vga-light-red font-bold">CLAUSULAZO TEBAS</span> — si quieres fichar
        a un jugador que no está en el mercado, puedes activar su cláusula de rescisión desde
        su ficha en PLANTILLA del rival. El coste es el doble de su valor base y el traspaso
        es inmediato sin negociación.
      </p>
    </Section>

    <Section title="PARTIDAS GUARDADAS">
      <p>
        Puedes tener varias carreras a la vez. En COPIA → pestaña PARTIDAS gestionas todas
        tus partidas: cargar, renombrar, borrar y crear una nueva desde cero. La partida
        activa se autoguarda mientras juegas, así que basta con cambiar de slot para volver
        donde lo dejaste en otra carrera.
      </p>
      <p>
        Para mayor seguridad, exporta tus partidas importantes a un archivo desde la pestaña
        BACKUP. Las partidas se guardan en este navegador, así que un borrado de datos del
        sitio o cambiar de máquina las hace desaparecer.
      </p>
    </Section>

    <Section title="PACKS DE DATOS Y STATS">
      <p>
        OpenFutbol viene con un modelo propio de jugadores. También puedes importar packs
        de datos externos disponibles públicamente (equipos, jugadores) y opcionalmente un
        pack de stats para usar tu base de datos preferida. El motor está pensado para que
        la simulación funcione con cualquier set compatible.
      </p>
      <p>
        Cuando un jugador tiene stats de un pack importado, su año aparece como una pequeña
        etiqueta en la esquina de la ficha.
      </p>
    </Section>

    <Section title="FIN DE TEMPORADA Y RANKINGS">
      <p>
        Al cerrar la temporada se abre un resumen completo: campeón con escudo, Pichichi,
        Zamora y MVP con fotos, clasificación final clicable (cada celda abre un drilldown
        con los partidos que la generaron) y récords del año (goleada, ridículo, partido loco
        y rachas).
      </p>
      <p>
        Debajo hay paneles con datos curiosos de jugadores y equipos (más joven, más veterano,
        Joaquín Award al goleador más mayor, juego limpio, molino de tarjetas, equipo más
        valioso, etc.), un panel de mercado con el fichaje del año, y una lista de BAJAS con
        los jugadores retirados esta temporada — los de campo se retiran sobre los 35–38 y
        los porteros sobre los 38–42 con un poco de aleatoriedad determinista.
      </p>
      <p>
        El drilldown de cada partido muestra los tiros, tarjetas, el MVP del encuentro
        (calculado por goles + asistencias menos tarjetas) y un timeline cronológico con
        autoría de gol y asistente. Pasa el ratón sobre cualquier jugador para ver su tarjeta.
      </p>
      <p>
        ESTADÍSTICAS muestra el podio de máximos goleadores y asistentes con fotos, la tabla
        completa del top 10, micro-rankings de mejor media, G+A, minutos jugados y porterías
        a cero, además del ranking disciplinario con tarjetas de cada infractor.
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

    <Section title="AJUSTES DEL MOTOR">
      <p>
        En COPIA → ENGINE tienes un panel con todas las constantes de equilibrio del juego.
        Cada cambio se guarda en tu navegador y afecta de inmediato a la siguiente
        situación relevante. Puedes exportarlos a un archivo para compartir tu preset, o
        resetear cualquier deslizador a su valor por defecto con el botón ↺.
      </p>
      <p>
        Los grupos disponibles:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="text-vga-cyan">Junta y Presión</span> — recompensas/castigos del Florentinómetro por victoria, empate, derrota, fichajes, semana, objetivo cumplido.</li>
        <li><span className="text-vga-cyan">Reputación</span> — multiplicadores sobre la reputación ganada y perdida en Pro Manager.</li>
        <li><span className="text-vga-cyan">Simulación de Partido</span> — probabilidad de gol, lesiones, decay y recuperación de la condición física, severidad arbitral, exponente de posesión, tasa de eventos y de asistencias, y ventaja del local.</li>
        <li><span className="text-vga-cyan">Jugadores y Táctica</span> — penalización por jugar fuera de posición, bonus/penalización de moral en titulares y suplentes.</li>
        <li><span className="text-vga-cyan">Mercado de Fichajes</span> — agresividad de la IA al activar clausulazos, hacer intercambios y firmar nuevos jugadores.</li>
        <li><span className="text-vga-cyan">Negociaciones</span> — qué tan bajo es "insultante", probabilidad de que una oferta insultante o rechazada bloquee al jugador, umbral de aceptación automática, anchura del rango de negociación y coste del clausulazo.</li>
        <li><span className="text-vga-cyan">Economía</span> — inflación de precios, multiplicador de salarios, ingresos por taquilla y bonus de prima edad para jugadores jóvenes.</li>
        <li><span className="text-vga-cyan">Interfaz</span> — anchura máxima de la pantalla de partido.</li>
      </ul>
      <p>
        Sube las negociaciones al máximo para una experiencia brutal, baja el clausulazo a 1.2× para
        un mercado salvaje, o multiplica los salarios por 3 para arruinarte. Lo que quieras.
      </p>
    </Section>

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
            <span className="text-vga-cyan">v1.7.0</span> — Gran actualización: partidas guardadas,
            fin de temporada totalmente rediseñado, mercado nuevo, rankings con fotos y carrera
            con detalle por temporada.
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li><span className="text-vga-yellow">Partidas guardadas:</span> varias carreras a la vez, con cargar/renombrar/borrar y autoguardado. Pestaña PARTIDAS dentro de COPIA.</li>
              <li><span className="text-vga-yellow">Bug serio arreglado:</span> los equipos ya no se vacían al pasar de temporada. Los jugadores de campo se retiran entre los 35 y 38 años, los porteros entre 38 y 42, con un poco de aleatoriedad determinista por jugador.</li>
              <li><span className="text-vga-yellow">Fin de temporada nuevo:</span> resumen a pantalla completa con campeón y escudo, podio de Pichichi/Zamora/MVP con fotos, clasificación final clicable con drilldown por celda, récords del año (goleada, ridículo, partido loco, rachas), datos curiosos de jugadores y equipos, mercado del año y lista de BAJAS por retiro.</li>
              <li><span className="text-vga-yellow">Drilldown de partido:</span> al pinchar en una celda de la clasificación se abre la lista de partidos. Cada uno muestra tiros, tarjetas, MVP del encuentro (calculado por goles + asistencias menos tarjetas) y un timeline cronológico con autor del gol y asistente. Hover sobre cualquier jugador para ver su tarjeta.</li>
              <li><span className="text-vga-yellow">Mercado de fichajes rediseñado:</span> tabla ordenable con filtros por tipo y posición, búsqueda, badges CHOLLO/★, ficha del jugador con foto en el panel lateral con OFERTAR y feed de ACTIVIDAD DEL MERCADO al lado (todos los movimientos: fichajes, clausulazos, retiros).</li>
              <li><span className="text-vga-yellow">Estadísticas rediseñadas:</span> podio top 3 de goleadores y asistentes con fotos, tabla completa del top 10, micro-rankings de mejor media, G+A, minutos y porterías a cero, ranking disciplinario con glifos de tarjetas.</li>
              <li><span className="text-vga-yellow">Carrera como entrenador:</span> nueva vista detallada por temporada (posición con barra visual, W/D/L con barra, puntos y % victorias, Florentinómetro con rango min→peak, balance fichajes), tarjetas de campeón/despido/descenso, mejor y peor temporada destacadas.</li>
              <li><span className="text-vga-yellow">Pro Manager:</span> los clubes que te despiden no vuelven a ofrecerte trabajo. Si todos te han descartado, la carrera termina y solo queda retirarte.</li>
              <li><span className="text-vga-yellow">Packs de stats:</span> OpenFutbol acepta packs de datos públicos de terceros para usar tu base de datos preferida. El año del pack aparece como etiqueta junto al jugador.</li>
            </ul>
          </li>
          <li>
            <span className="text-vga-cyan">v1.5.1</span> — Reglas Tebas y carrera en tiempo real.
            Límite Tebas de clausulazos recibidos por equipo (máx. 2 por temporada). En Pro Manager,
            Florentino veta tus clausulazos con probabilidad creciente después del segundo — con
            mensajes cada vez más agresivos sobre el gasto. Los jugadores ya traspasados no pueden
            volver a ser clausulazados. La pantalla de carrera ahora muestra la temporada en curso
            en tiempo real (posición, W/D/L y Florentinómetro actualizados cada jornada).
            Las ofertas de trabajo filtran por reputación y objetivo del club: si no llegas a 70
            no te llaman equipos que van a ganar la liga.
          </li>
          <li>
            <span className="text-vga-cyan">v1.3.0</span> — Modo Pro Manager.
            Nuevo modo de carrera completo: nombre de entrenador, reputación acumulada entre temporadas
            y ofertas de trabajo según tu historial. Florentinómetro (0–10) que mide la satisfacción
            de la junta en tiempo real — avisos con mensajes graciosos, despidos dramáticos y premios
            si llegas a lo más alto (incluida Marbella). Modal de Florentino con su pixel art al teléfono.
            Período de gracia los primeros partidos, avisos que se perdonan con buen rendimiento,
            y pantalla de fin de temporada con estadísticas burlonas y fichas de clubes expandibles.
            Entrenadores de la IA renombrados con técnicos de la NBA. Equipos ordenados por fuerza.
          </li>
          <li>
            <span className="text-vga-cyan">v1.2.0</span> — Idiomas.
            Selector de idioma en la cabecera (ES / EN). Toda la interfaz traducida al inglés:
            navegación, fichas de jugador, mercado de fichajes, alineación, finanzas, clasificación,
            configuración de liga, Fantasy Draft y nombres de países.
            Sistema de i18n propio sin dependencias externas.
          </li>
          <li>
            <span className="text-vga-cyan">v1.1.0</span> — Comunidad y países.
            Pantalla COLABORAR con canal de Telegram para proponer equipos y jugadores.
            Banderas por país en las pantallas de selección.
            Base de datos actualizada con equipos nuevos.
          </li>
          <li>
            <span className="text-vga-cyan">v1.0.0</span> — Primera versión pública.
            Arquitectura modular de datos basada en UUIDs. Simulación de partidos minuto a minuto,
            sistema de temas (Retrocutre/Retrocool), modo Fantasy Draft, gestión económica,
            editor de equipos y mercado de fichajes.
          </li>
        </ul>
      </Section>
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
        y añadir jugadores,{' '}
        <button onClick={onColaborar} className="text-vga-cyan underline hover:text-vga-yellow">
          visita COLABORAR
        </button>.
      </p>
    </div>
  </>
);

const ContentEN = ({ onColaborar, changelogRef, engineRef }: {
  onColaborar: () => void;
  changelogRef: React.RefObject<HTMLDivElement | null>;
  engineRef: React.RefObject<HTMLDivElement | null>;
}) => (
  <>
    <Section title="GAME MODES">
      <p>
        <span className="text-vga-yellow">PLAY</span> — Pick a season and a team. None of it is real.
        The names are bad puns, the players are made up, and the stadium probably doesn't exist.
        You compete in a league against eleven other equally dubious clubs. May the least embarrassing team win.
      </p>
      <p>
        <span className="text-vga-yellow">PRO MANAGER</span> — Hard mode. You're a manager with a real career:
        pick a year, give yourself a name, and receive job offers based on your reputation.
        The board evaluates you every round with the{' '}
        <span className="text-vga-cyan">Florentinometer</span> (0–10). Win matches, make smart signings,
        and meet your objective to keep them happy. If the meter drops too low, Florentino calls.
        First time he warns you. Second time he's blunter. Third time — pack your things.
        When you're sacked you get new offers based on your track record, but any club that already
        fired you <span className="text-vga-light-red">never</span> calls again. If nobody wants you
        anymore, career's over. Hit 9 on the meter and Florentino gives you Marbella,
        hands out bonuses, and wires €2M to the club. Your full career lives in a dedicated view
        with every season broken down (position, W/D/L, points, Florentinometer and transfer balance).
      </p>
      <p>
        <span className="text-vga-yellow">FANTASY</span> — Build your own league and run a player draft
        as if you know what you're doing. <span className="text-vga-cyan">FREE</span> mode for those who
        think they're Florentino, or <span className="text-vga-cyan">CAP</span> mode with a 1350 MED
        limit per team for those who prefer to suffer on a budget. 18 rounds, many regrets.
      </p>
      <p>
        <span className="text-vga-yellow">EDITOR</span> — Create teams from scratch, give them a ridiculous
        name, horrible colours, and share them. Editor teams can be dropped straight into a FANTASY league
        to ruin your friends' evenings.
      </p>
      <p>
        <span className="text-vga-yellow">MULTIPLE CAREERS</span> — Each of the modes above lives in
        its own save. Run a serious Pro Manager, a sandbox PLAY save and a FANTASY league with friends
        in parallel. Switch between them in BACKUP → PARTIDAS without losing anything.
      </p>
    </Section>

    <Section title="PRO MANAGER — FLORENTINOMETER">
      <p>
        The Florentinometer tracks board satisfaction in real time (0–10, starts at 5).
        It rises with wins, smart transfers, and healthy finances. It falls with defeats,
        bad signings, and running at a loss.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="text-vga-light-green">≥ 7</span> — Board is pleased. You get encouraging messages.</li>
        <li><span className="text-vga-yellow">5 – 7</span> — Neutral zone. Nobody says anything (yet).</li>
        <li><span className="text-vga-light-red">{'< 5'}</span> — Danger zone. Each round there's a chance of a board warning.</li>
        <li><span className="text-vga-light-green font-bold">≥ 9</span> — Florentino promises you Marbella, gives bonuses to players, and transfers €2M to the club.</li>
      </ul>
      <p>
        <span className="text-vga-yellow">Warnings</span> accumulate (3 strikes and you're fired).
        If you recover the meter above 5, warnings are forgiven one per round.
        Your first 5 matches at a new club are a grace period — the board waits to see how you respond.
      </p>
      <p>
        <span className="text-vga-light-red font-bold">Clubs remember:</span> any club that fires
        you will never offer you a job again. Each firing shrinks your future options. If no club
        wants you anymore, your career ends and you can only retire.
      </p>
      <p>
        Board messages appear after the match result screen.
        You can re-read them by tapping the ⚠ warning icon in the status bar.
        Your manager name in the status bar is also a shortcut to your career stats, where every
        season is broken down by position, W/D/L, points, Florentinometer and transfer balance.
      </p>
    </Section>

    <Section title="HOW TO PLAY (LEAGUE)">
      <ol className="list-decimal pl-5 space-y-1">
        <li>Choose a season, country, and team.</li>
        <li>Set your LINEUP (11 starters + substitutes).</li>
        <li>Adjust the TICKET PRICE in FINANCES.</li>
        <li>Play each round until the end of the season.</li>
      </ol>
    </Section>

    <Section title="HOW TO PLAY (FANTASY)">
      <ol className="list-decimal pl-5 space-y-1">
        <li>Select the league year and participating teams (2–8).</li>
        <li>Mark your team with the <span className="text-vga-cyan">ME</span> button.</li>
        <li>Draft order is randomised once and stays fixed. If you pick 3rd, you always pick 3rd.</li>
        <li>Each round suggests a position. You can pick any player from the pool.</li>
        <li>After 18 rounds the league kicks off with each team's chosen squad.</li>
      </ol>
    </Section>

    <div ref={engineRef}>
    <Section title="PLAYER STATS">
      <p>Each player has 6 base stats (0–99):</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="text-vga-yellow">VEL</span> — Speed. Sprint and acceleration.</li>
        <li><span className="text-vga-yellow">REG</span> — Dribbling. Ability to beat opponents.</li>
        <li><span className="text-vga-yellow">PAS</span> — Passing. Accuracy and vision.</li>
        <li><span className="text-vga-yellow">TIR</span> — Shooting. The higher, the more goals.</li>
        <li><span className="text-vga-yellow">DEF</span> — Defending. Tackles, covers, and duels.</li>
        <li><span className="text-vga-yellow">FIS</span> — Physical. Stamina and strength.</li>
      </ul>
      <p>
        <span className="text-vga-yellow">MED</span> is not a simple average — each position weights
        stats differently. Shooting matters far more for a striker than a defender, and dribbling
        counts more for a winger than a central midfielder. The result is also adjusted for fitness and morale.
      </p>
      <p>
        Stats depend on <span className="text-vga-yellow">POSITION</span>: the same player gets different
        values depending on where they play. Playing out of position penalises their rating.
      </p>
      <p>
        <span className="text-vga-yellow">AGE</span> matters too. Near their peak (which varies by position)
        a player performs at their best. Drifting from their prime hurts performance, but never below 70%.
      </p>
    </Section>

    <Section title="POSITIONS">
      <p>
        Each position weights the base stats differently, so the same TIR number is far more
        valuable to a striker than to a centre-back. These are the positions the engine uses
        and what matters most in each:
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="text-vga-yellow">POR</span> — Goalkeeper. Only the goalkeeping stat matters; stopping goals is the only job.</li>
        <li><span className="text-vga-yellow">DEF</span> — Defender. DEF and FIS dominate; PAS and VEL help with build-up. Aggressive defenders commit more fouls.</li>
        <li><span className="text-vga-yellow">MED</span> — Midfielder. Balanced PAS, REG and FIS. The most-on-the-ball role.</li>
        <li><span className="text-vga-yellow">AML / AMR</span> — Wingers. REG and VEL rule. They create chances and can finish — one of the highest-value roles.</li>
        <li><span className="text-vga-yellow">DEL</span> — Striker. TIR above all. Every shot duels the rival keeper and defence.</li>
      </ul>
      <p>
        <span className="text-vga-light-red">Playing out of position</span> cuts every stat to
        about 82% (tunable in ENGINE SETTINGS). The penalty is even harsher for goalkeepers —
        slotting an outfielder in goal is basically gifting goals. AUTO-FIX 11 picks the best XI
        respecting natural positions whenever possible.
      </p>
      <p>
        Each player can have several allowed positions (e.g. a MED who can also play AML).
        Allowed positions come from the imported pack or are derived from the player's stats.
        You'll see every position a player can fill on their card.
      </p>
    </Section>

    <Section title="MATCH SIMULATION">
      <p>
        A team's MED is the average of its starters on the pitch. Red cards lower it in real time
        and you'll feel it immediately.
      </p>
      <p>
        Possession depends on each team's strength and home advantage.
        The team with the ball attacks; the other defends with their own stats.
      </p>
      <p>
        <span className="text-vga-yellow">Shots:</span> the shooter goes up against the goalkeeper
        and the opposing defence. A top striker against a weak backline scores far more than average.
      </p>
      <p>
        <span className="text-vga-yellow">Cards:</span> aggressive defenders commit more fouls.
        A second yellow means a red: immediate dismissal and the player misses the next match.
      </p>
      <p>
        Before each match you can see both lineups on the tactical board. Tap any player —
        yours or the opponent's — to view their profile. Tap one of your circles to swap them
        for a substitute without spending an official change.
      </p>
    </Section>

    <Section title="FITNESS (CAN)">
      <p>
        Players get tired during a match and that fatigue carries over between rounds.
        A player who arrives exhausted performs below their usual level.
      </p>
      <p>
        Some fitness recovers each round, but not always to 100%.
        The CAN bar is visible in SQUAD and in LINEUP.
      </p>
    </Section>

    <Section title="MORALE (ANI)">
      <p>
        Each player has a morale level across five tiers:
        <span className="text-vga-light-red"> ▼▼ </span>
        <span className="text-vga-bright-white">▼ </span>
        <span className="text-vga-yellow">— </span>
        <span className="text-vga-light-cyan">▲ </span>
        <span className="text-vga-light-green">▲▲</span>.
        It's shown alongside their MED in their profile and in the lineup.
      </p>
      <p>
        Morale affects performance without changing permanent values.
        It depends on minutes played, goals, assists, and whether the player is a regular starter.
      </p>
    </Section>

    <Section title="SUBSTITUTIONS & LIVE TACTICS">
      <p>
        Up to 3 substitutions per match. The game pauses at half-time and opens the panel automatically.
        You can also open it at any time with the SUBS button. Make as many changes as you like,
        then press CONTINUE when you're done.
      </p>
      <p>
        From the panel you can also change the <span className="text-vga-yellow">FORMATION</span>,
        use <span className="text-vga-yellow">AUTO-11</span> to rebuild the best available XI,
        or switch between <span className="text-vga-yellow">TAC:POS</span> and <span className="text-vga-yellow">TAC:FREE</span> without leaving the match.
      </p>
    </Section>

    <Section title="INJURIES & SUSPENSIONS">
      <p>
        A player can get injured during a match. The game makes an automatic emergency substitution
        (it counts as one of your 3 changes). The injured player can't be selected until they recover —
        you'll see the <span className="text-vga-light-red">INJ</span> badge with the rounds remaining.
      </p>
      <p>
        Injured or suspended players are automatically removed from the lineup, leaving their slot empty.
        Tap the empty slot in the pre-match screen to choose a replacement.
      </p>
    </Section>

    <Section title="TRANSFERS & BUYOUT CLAUSE">
      <p>
        A player's price depends on their MED and their age relative to their peak.
        Young players with potential are worth more than an older player at the same rating.
      </p>
      <p>
        <span className="text-vga-cyan font-bold">TRANSFER MARKET:</span> a sortable table of every
        available player (listed and free agents). Filter by type or position, search by name, and
        sort by age, OVR, club or price. Click a row to open the player file in the side inspector
        with photo, season stats and action buttons. Next to it, a live MARKET ACTIVITY feed lists
        every move of the season — signings, buyouts and retirements.
      </p>
      <p>
        Incoming offers for your players are managed from SQUAD. Open a player to see all
        interested clubs grouped together.
      </p>
      <p>
        <span className="text-vga-yellow">Standard offer</span> — for listed players or free agents.
        You negotiate the price and the club can turn it down.
      </p>
      <p>
        <span className="text-vga-light-red font-bold">BUYOUT CLAUSE</span> — if you want a player
        who isn't on the market, trigger their release clause from their card on the rival's SQUAD
        view. The cost is double their base value and the transfer is instant — no negotiation.
      </p>
    </Section>

    <Section title="SAVE SLOTS">
      <p>
        You can keep several careers at once. In BACKUP → PARTIDAS tab you can load, rename,
        delete and create new save slots. The active save autosaves while you play, so switching
        slots takes you straight back where you left off in another career.
      </p>
      <p>
        For safety, export important saves to a file from the BACKUP tab. Saves live in this
        browser, so clearing site data or moving machine will lose them.
      </p>
    </Section>

    <Section title="DATA & STATS PACKS">
      <p>
        OpenFutbol ships with its own player model. You can also import external, publicly
        available data packs (teams, players) and optionally a stats pack to use your preferred
        database. The engine is designed to run the simulation on any compatible dataset.
      </p>
      <p>
        When a player has stats from an imported pack, the pack year shows as a small badge
        in the corner of their file.
      </p>
    </Section>

    <Section title="END OF SEASON & RANKINGS">
      <p>
        Closing a season opens a full summary: champion with crest, Pichichi, Zamora and MVP
        with photos, clickable final standings (each cell opens a drilldown of the matches it
        came from) and the year's records (biggest win, heaviest defeat, craziest match,
        unbeaten and winning runs).
      </p>
      <p>
        Below that, player and team curiosities (youngest, oldest, Joaquín Award for the oldest
        scorer, fair play, card mill, richest squad, etc.), a transfer-of-the-year panel, and a
        RETIROS list with every player who retired this season — outfielders retire between 35
        and 38, goalkeepers between 38 and 42, with a small deterministic random band.
      </p>
      <p>
        The per-match drilldown shows shots, cards, the match MVP (computed from goals +
        assists minus cards) and a chronological timeline with goal scorer and assist provider.
        Hover any player to pop their card.
      </p>
      <p>
        RANKINGS shows a top-3 podium for scorers and assisters with photos, the full top-10
        table, micro-rankings for best average rating, G+A, minutes and clean sheets, plus a
        disciplinary ranking with card glyphs for each offender.
      </p>
    </Section>

    <Section title="FINANCES">
      <p>
        Each round you earn gate receipts (based on ticket price, the opponent, and your league position)
        and pay wages. If your balance hits zero, transfers are blocked.
      </p>
    </Section>

    <Section title="SIMULATED MATCHES">
      <p>
        Matches you don't play are resolved with a simplified model. The stronger team is more likely
        to win, but upsets always happen. Home advantage applies to every team.
      </p>
    </Section>
    </div>

    <Section title="ENGINE SETTINGS">
      <p>
        Under BACKUP → ENGINE you'll find a panel with every balance constant in the game.
        Changes are persisted in your browser and take effect immediately on the next relevant
        event. Export your tweaks to a file to share a preset, or reset any individual slider
        with the ↺ button.
      </p>
      <p>Available groups:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li><span className="text-vga-cyan">Board & Pressure</span> — Florentinometer rewards/penalties for win, draw, loss, signings, weekly drift, season objective.</li>
        <li><span className="text-vga-cyan">Reputation</span> — multipliers on reputation gained and lost in Pro Manager.</li>
        <li><span className="text-vga-cyan">Match Simulation</span> — goal chance, injuries, stamina decay and recovery, referee strictness, possession exponent, event and assist rates, plus home advantage.</li>
        <li><span className="text-vga-cyan">Player & Tactics</span> — out-of-position penalty, mood lineup bonus and bench penalty.</li>
        <li><span className="text-vga-cyan">Transfer Market</span> — AI aggressiveness on buyouts, trades and new signings.</li>
        <li><span className="text-vga-cyan">Negotiations</span> — what counts as insulting, chance an insulting/rejected offer blocks the player, auto-accept multiplier, negotiation window width and buyout-clause cost.</li>
        <li><span className="text-vga-cyan">Economy</span> — price inflation, salary multiplier, ticket revenue and the prime-age bonus.</li>
        <li><span className="text-vga-cyan">Interface</span> — match screen max width.</li>
      </ul>
      <p>
        Crank negotiations to max for brutal mode, drop the buyout multiplier to 1.2× for a wild
        market, or triple salaries to go bankrupt on purpose. Knock yourself out.
      </p>
    </Section>

    <Section title="TIPS TO WIN">
      <Tip>Always play each player in their natural position. A striker in midfield is wasted MED.</Tip>
      <Tip>A good goalkeeper wins matches on their own. Don't cut corners on GK.</Tip>
      <Tip>Use AUTO-11 if you're unsure — it picks the best available XI from your squad.</Tip>
      <Tip>Check CAN bars before each match. A tired starter is worth less than a fresh sub.</Tip>
      <Tip>Make changes at half-time if anyone is in the red — don't wait until the 80th minute.</Tip>
      <Tip>Give substitutes minutes in easy matches. Benched players lose morale and perform worse.</Tip>
      <Tip>A player on a scoring streak has high morale — keep them on the pitch.</Tip>
      <Tip>Watch defenders on a yellow card. A second one means a red and they miss the next match.</Tip>
      <Tip>The optimal ticket price isn't the maximum — raise it too high and attendance drops. Experiment.</Tip>
      <Tip>Young players near their peak are the best long-term investment.</Tip>
      <Tip>Playing away against a stronger side? Sit deep. Home advantage cuts both ways.</Tip>
      <Tip>The buyout clause costs double but is guaranteed. Only use it when the player is truly worth it.</Tip>
      <Tip>The AI also rotates tired players — don't assume they'll always field their best eleven.</Tip>
      <Tip>In FANTASY, early picks should go to goalkeeper and defenders. Your rivals want them too.</Tip>
      <Tip>In FANTASY, picking 18 outfield players is valid, but you'll struggle in shooting duels.</Tip>
      <Tip>An EDITOR team added to a FANTASY league starts with no squad — the draft fills it.</Tip>
    </Section>

    <div ref={changelogRef} id="changelog">
      <Section title="RECENT CHANGES">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="text-vga-cyan">v1.7.0</span> — Massive update: save slots,
            end-of-season fully redesigned, new market, rankings with photos and a detailed
            per-season manager career.
            <ul className="list-disc pl-5 mt-1 space-y-1">
              <li><span className="text-vga-yellow">Save slots:</span> keep several careers at once with load/rename/delete and autosave. PARTIDAS tab inside BACKUP.</li>
              <li><span className="text-vga-yellow">Critical bug fix:</span> teams no longer empty out at season's end. Outfielders retire between 35 and 38, goalkeepers between 38 and 42, with a small deterministic random band per player.</li>
              <li><span className="text-vga-yellow">New end-of-season screen:</span> full-width summary with champion + crest, Pichichi/Zamora/MVP podium with photos, clickable final standings with per-cell drilldown, year records (biggest win, heaviest defeat, craziest match, runs), player and team curiosities, a market panel and a RETIROS list.</li>
              <li><span className="text-vga-yellow">Match drilldown:</span> clicking any cell of the standings opens its match list. Each one shows shots, cards, the match MVP (computed from goals + assists minus cards) and a chronological timeline with goal scorer and assist provider. Hover any name for the player card.</li>
              <li><span className="text-vga-yellow">Redesigned transfer market:</span> sortable table with type and position filters, search, CHOLLO/★ badges, side-panel player file with photo and OFERTAR, and a live MARKET ACTIVITY feed (every signing, buyout and retirement).</li>
              <li><span className="text-vga-yellow">Redesigned rankings:</span> top-3 podium for scorers and assisters with photos, full top-10 table, micro-rankings for best avg rating, G+A, minutes and clean sheets, disciplinary ranking with card glyphs.</li>
              <li><span className="text-vga-yellow">Manager career view:</span> new detailed per-season view (position with visual bar, W/D/L bar, points and win %, Florentinometer range min→peak, transfer balance), champion/fired/relegation chips, best and worst season highlighted.</li>
              <li><span className="text-vga-yellow">Pro Manager:</span> clubs that fire you never offer you another job. If every club has dropped you, your career ends and you can only retire.</li>
              <li><span className="text-vga-yellow">Stats packs:</span> OpenFutbol supports publicly available third-party data packs so you can use your preferred database. The pack year shows as a small badge next to a player.</li>
            </ul>
          </li>
          <li>
            <span className="text-vga-cyan">v1.5.1</span> — Tebas rules and live career screen.
            Tebas buyout limit: each team can only receive 2 buyout clauses per season. In Pro Manager
            mode, Florentino vetoes your buyout attempts with increasing probability after the second —
            his messages get progressively more insulting about your spending habits. Players already
            transferred can't be bought out again. The career screen now shows the current season live
            (position, W/D/L and Florentinometer updated every jornada). Job offers are now filtered
            by reputation and club objective: below 70 rep, title-chasing clubs won't call you.
          </li>
          <li>
            <span className="text-vga-cyan">v1.3.0</span> — Pro Manager mode.
            Full career mode: manager name, reputation that carries across seasons, and job offers
            based on your track record. Florentinometer (0–10) tracks board satisfaction in real time —
            funny warning messages, dramatic sackings, and rewards if you reach the top (including Marbella).
            Florentino pixel art modal on the phone. Grace period for new managers, warnings forgiven
            by good form, end-of-season screen with mocking stats and expandable club offer cards.
            AI managers renamed with NBA coaches. Teams sorted by strength.
          </li>
          <li>
            <span className="text-vga-cyan">v1.2.0</span> — Languages.
            Language selector in the header (ES / EN). Full English translation of the UI:
            navigation, player profiles, transfers, lineup, finances, league table,
            league setup, Fantasy Draft, and country names.
            Custom i18n system with no external dependencies.
          </li>
          <li>
            <span className="text-vga-cyan">v1.1.0</span> — Community and countries.
            COLLABORATE screen with a Telegram channel to propose teams and players.
            Country flags on selection screens. Database updated with new teams.
          </li>
          <li>
            <span className="text-vga-cyan">v1.0.0</span> — First public release.
            UUID-based modular data architecture. Minute-by-minute match simulation,
            theme system (Retrocutre/Retrocool), Fantasy Draft mode, financial management,
            team editor, and transfer market.
          </li>
        </ul>
      </Section>
    </div>

    <div className="bg-vga-black p-4 border-2 border-vga-cyan text-[9px] text-vga-bright-white space-y-2">
      <p className="text-vga-cyan font-bold">CONTRIBUTE TO THE GAME</p>
      <p>
        Got an idea for a team? A terrible pun that deserves to be a badge?
        Want your face on a pixelated player? Send it to the Telegram channel:
      </p>
      <p>
        <a href="https://t.me/openfutbol" target="_blank" rel="noreferrer"
          className="text-vga-cyan underline hover:text-vga-yellow">
          t.me/openfutbol
        </a>
        {' '}— no weird accounts, no technical know-how, no hassle.
      </p>
      <p>
        For more details on how to propose teams, generate badges with AI,
        and add players,{' '}
        <button onClick={onColaborar} className="text-vga-cyan underline hover:text-vga-yellow">
          visit COLLABORATE
        </button>.
      </p>
    </div>
  </>
);

export const InstructionsView = ({ onBack, onColaborar, scrollTo }: Props) => {
  useT(); // subscribe to language changes
  const changelogRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<HTMLDivElement>(null);
  const isEN = getLang() === 'en';

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
            {isEN ? 'HELP' : 'AYUDA'}
          </h2>
          <button
            onClick={onBack}
            className="text-[8px] bg-vga-gray text-vga-black px-2 py-1 border border-vga-white hover:bg-vga-red hover:text-vga-bright-white"
          >
            {isEN ? 'BACK' : 'VOLVER'}
          </button>
        </div>

        {isEN
          ? <ContentEN onColaborar={onColaborar} changelogRef={changelogRef} engineRef={engineRef} />
          : <ContentES onColaborar={onColaborar} changelogRef={changelogRef} engineRef={engineRef} />
        }
      </div>

      <div className="bg-vga-magenta p-2 text-[8px] text-vga-bright-white text-center border-2 border-vga-white">
        {isEN ? 'THIS PAGE IS UPDATED AS THE GAME EVOLVES.' : 'ESTA PÁGINA SE ACTUALIZA A MEDIDA QUE EL JUEGO EVOLUCIONA.'}
      </div>
    </div>
  );
};

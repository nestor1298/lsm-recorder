/**
 * acuerdo.ts — el acuerdo de participación, en una página y en lenguaje
 * llano. Se muestra completo al unirse (paso 3) y en /acuerdo; la firma es
 * la palomita más el nombre escrito, o el video de consentimiento en LSM.
 *
 * Cambiar el texto = subir la versión: cada consentimiento guarda la
 * versión que firmó.
 */

export const ACUERDO_VERSION = "1.0";
export const ACUERDO_FECHA = "28 de octubre de 2026";

/** Correo de contacto del equipo. VALIDAR: confirmar la cuenta con OtherAI. */
export const CONTACTO_SIGNALAB = "signalab@other-ai.com";

export interface SeccionAcuerdo {
  titulo: string;
  parrafos: string[];
}

export const ACUERDO_SECCIONES: SeccionAcuerdo[] = [
  {
    titulo: "1. Qué haces",
    parrafos: [
      "Grabas videos cortos de señas de la Lengua de Señas Mexicana con tu propia cámara, siguiendo las listas de SignaLab. Tú decides cuándo grabas y cuánto. Puedes parar en cualquier momento, sin avisar y sin consecuencias. Los videos que ya guardaste siguen cubiertos por este acuerdo mientras no los retires.",
    ],
  },
  {
    titulo: "2. Es gratis y sin pago",
    parrafos: [
      "Participas de forma voluntaria. No hay pago por tus videos, ni ahora ni después. Lo que sí hay es el juego del estudio: niveles, cofres de señas, medallas, el tablero de la semana y tu tarjeta de señante. En todo eso apareces con tu apodo, nunca con tu nombre real.",
    ],
  },
  {
    titulo: "3. Tu rostro es parte de tu lengua",
    parrafos: [
      "En los videos se ven tu cara y tus manos, porque las dos son parte de la seña. No borramos ni difuminamos tu rostro: hacerlo borraría parte de lo que señas. A cambio, tú decides quién puede ver cada video con un nivel de acceso.",
      "Abierto: cualquier persona puede verlo en el corpus público. Investigación: solo personas investigadoras registradas, con un acuerdo de uso. Restringido: solo el equipo de anotación de SignaLab. Eliges un nivel al unirte y lo puedes cambiar video por video cuando quieras.",
    ],
  },
  {
    titulo: "4. Para qué se usan tus videos",
    parrafos: [
      "Para describir cómo se forma cada seña con la notación de Cruz Aldrete y construir el corpus de la LSM; para el modo Aprender de SignaLab; para las lecciones de SignaPlay, la app con la que niñas y niños aprenden LSM; y para entrenar modelos que reconozcan señas. Siempre dentro del nivel de acceso que elegiste para cada video.",
    ],
  },
  {
    titulo: "5. Tus derechos",
    parrafos: [
      "En cualquier momento puedes ver tus videos, cambiar su nivel de acceso o retirar cualquiera de ellos, o retirar todo tu consentimiento, desde «Mis grabaciones». No tienes que explicar por qué.",
      "Cuando retiras un video, sale del corpus en el siguiente ciclo de procesamiento y deja de usarse para producir nuevos materiales. Las copias que ya se hayan publicado en el nivel abierto antes de retirarlo pueden seguir circulando: por eso el nivel abierto se elige con calma.",
    ],
  },
  {
    titulo: "6. Tus datos",
    parrafos: [
      "Guardamos tu nombre (solo para este acuerdo), tu correo (solo para que entres con un código) y lo que respondes en «Un poco de ti» (edad, región, desde cuándo señas). Esos datos describen el corpus, no se venden ni se comparten con tu nombre. Otras personas solo ven tu apodo.",
      `Puedes pedir ver, corregir o borrar tus datos escribiendo a ${CONTACTO_SIGNALAB} desde el correo con el que entras.`,
    ],
  },
  {
    titulo: "7. No es un empleo",
    parrafos: [
      "Participas como persona voluntaria e independiente. Este acuerdo no crea una relación laboral ni de servicios con OtherAI.",
    ],
  },
  {
    titulo: "8. Edad y firma",
    parrafos: [
      "Para participar necesitas tener 18 años o más. Firmas marcando la casilla y escribiendo tu nombre, o grabando un video corto en LSM en el que dices tu nombre, la fecha y que aceptas participar. Las dos formas valen igual.",
    ],
  },
];

/** Resumen de tres líneas que acompaña a la palomita. */
export const ACUERDO_RESUMEN = [
  "Gratis: participas sin pago; a cambio hay niveles, cofres y medallas.",
  "Tuyo: tú decides quién ve cada video y lo retiras cuando quieras.",
  "Tu rostro no se borra: es parte de la seña; el nivel de acceso te protege.",
];

export const ACUERDO_ACEPTO =
  "Leí y acepto el acuerdo. Tengo 18 años o más y participo sin pago.";

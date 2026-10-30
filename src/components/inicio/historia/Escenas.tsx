/**
 * Escenas — los dibujos animados de la intro, uno por diapositiva. La
 * historia sigue a una seña, MAÑANA: alguien la busca y no la encuentra
 * descrita; una persona no basta; nueve manos sí; tú puedes ser una; tu
 * cara se queda; la novena cierra el círculo; y la seña sigue su camino.
 *
 * Todo sale de `p` (0…1): sin temporizadores ni CSS, para que Pausa,
 * Saltar y el movimiento reducido funcionen igual en cada escena.
 */

import {
  ALTO,
  ANCHO,
  bezier,
  C,
  CX,
  CY,
  colorDe,
  entraSale,
  lugar,
  mezcla,
  rebota,
  sale,
  tramo,
} from "./dibujo";

export const SENA = "MAÑANA";

const ESTADOS = ["Oaxaca", "Jalisco", "Yucatán", "CDMX", "Nuevo León", "Puebla", "Chiapas", "Sonora"];
const APODOS = ["Colibrí", "Ajolote", "Ceiba", "Quetzal", "Jaguar", "Nopal", "Cenzontle", "Tlacuache", "Tú"];

// ── Piezas ──────────────────────────────────────────────────────

/** Una persona en un cuadro de video: cabeza, hombros y una mano. */
function Persona({
  x,
  y,
  escala = 1,
  color,
  mano = [0, 0],
}: {
  x: number;
  y: number;
  escala?: number;
  color: string;
  /** desplazamiento de la mano (variación de cada quien) */
  mano?: [number, number];
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${escala})`}>
      <circle cx="0" cy="-8" r="9" fill={color} />
      <path d="M -20 22 Q -20 4 0 4 Q 20 4 20 22 Z" fill={color} />
      <circle cx={13 + mano[0]} cy={12 + mano[1]} r="5" fill={C.paper} stroke={C.ink} strokeWidth="2" />
    </g>
  );
}

/** Mano abierta: palma, cuatro dedos que se extienden y pulgar. */
function ManoAbierta({ p, x, y }: { p: number; x: number; y: number }) {
  const largos = [50, 58, 54, 42];
  const pulgar = sale(tramo(p, 0.3, 0.55));
  return (
    <g transform={`translate(${x} ${y}) scale(1.3)`}>
      <rect
        x="-50"
        y="18"
        width="34"
        height="15"
        rx="7.5"
        fill={C.paper}
        transform={`rotate(${mezcla(-5, -42, pulgar)} -22 26)`}
      />
      <rect x="-30" y="-6" width="64" height="66" rx="22" fill={C.paper} />
      {largos.map((h, i) => {
        const t = sale(tramo(p, 0.08 + i * 0.07, 0.32 + i * 0.07));
        const alto = h * mezcla(0.3, 1, t);
        return (
          <rect
            key={i}
            x={-26 + i * 15.5}
            y={2 - alto}
            width="13"
            height={alto + 6}
            rx="6.5"
            fill={C.paper}
          />
        );
      })}
    </g>
  );
}

function Fragmento({ t, x, y, texto, color }: { t: number; x: number; y: number; texto: string; color: string }) {
  const w = texto.length * 6.6 + 22;
  return (
    <g opacity={t} transform={`translate(${x} ${y + (1 - t) * 6})`}>
      <rect x={-w / 2} y="-12" width={w} height="24" rx="12" fill="none" stroke={color} strokeWidth="1.5" />
      <text x="0" y="4" textAnchor="middle" fontSize="11" fill={C.g300}>
        {texto}
      </text>
    </g>
  );
}

/** El círculo de nueve: base, puntos llenos y el lugar libre. */
function Circulo({
  cx,
  cy,
  r,
  llenas,
  radio = 12,
  late = 0,
  cerrado = 0,
  texto,
  tamTexto = 16,
}: {
  cx: number;
  cy: number;
  r: number;
  /** cuántas llenas (puede ser fraccional: la última entra creciendo) */
  llenas: number;
  radio?: number;
  /** 0…1: el lugar libre late */
  late?: number;
  /** 0…1: el trazo que cierra el círculo */
  cerrado?: number;
  texto?: string;
  tamTexto?: number;
}) {
  const largo = 2 * Math.PI * r;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.g700} strokeWidth="1.5" />
      {cerrado > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={C.paper}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={largo}
          strokeDashoffset={largo * (1 - cerrado)}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      )}
      {Array.from({ length: 9 }, (_, i) => {
        const { x, y } = lugar(i, r, cx, cy);
        const llena = Math.max(0, Math.min(1, llenas - i));
        const escalaLate = i === Math.floor(llenas) && llena === 0 ? 1 + 0.18 * late : 1;
        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={radio * escalaLate}
              fill={C.ink}
              stroke={C.g500}
              strokeWidth="1.5"
              strokeDasharray="3.5 3"
            />
            {llena > 0 && <circle cx={x} cy={y} r={radio * rebota(llena)} fill={colorDe(i)} />}
          </g>
        );
      })}
      {texto && (
        <text
          x={cx}
          y={cy + tamTexto * 0.35}
          textAnchor="middle"
          fontSize={tamTexto}
          fontWeight="700"
          letterSpacing="0.5"
          fill={C.paper}
        >
          {texto}
        </text>
      )}
    </g>
  );
}

// ── 1. Piensa en una seña ───────────────────────────────────────

function Escena1({ p }: { p: number }) {
  // la mano recorre un arco: el movimiento de la seña
  const t = mezcla(0.12, 0.88, entraSale(tramo(p, 0, 1)));
  const p0: [number, number] = [CX - 130, 236];
  const pc: [number, number] = [CX, 120];
  const p2: [number, number] = [CX + 130, 236];
  const u = 1 - t;
  const ax = u * u * p0[0] + 2 * u * t * pc[0] + t * t * p2[0];
  const ay = u * u * p0[1] + 2 * u * t * pc[1] + t * t * p2[1];
  return (
    <g>
      <path
        d={`M ${p0[0]} ${p0[1]} Q ${pc[0]} ${pc[1]} ${p2[0]} ${p2[1]}`}
        fill="none"
        stroke={C.g700}
        strokeWidth="2"
        strokeDasharray="4 6"
      />
      <path
        d={`M ${p0[0]} ${p0[1]} Q ${pc[0]} ${pc[1]} ${p2[0]} ${p2[1]}`}
        fill="none"
        stroke={C.accent}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray="1"
        pathLength={1}
        strokeDashoffset={1 - t}
      />
      {[0, 1, 2].map((k) => {
        const o = tramo(p, 0.5 + k * 0.14, 0.9 + k * 0.14);
        return (
          <circle
            key={k}
            cx={ax}
            cy={ay - 70}
            r={56 + o * 46}
            fill="none"
            stroke={C.g600}
            strokeWidth="1.5"
            opacity={o > 0 ? 1 - o : 0}
          />
        );
      })}
      <ManoAbierta p={p} x={ax - 2} y={ay - 92} />
    </g>
  );
}

// ── 2. Búscala en internet ──────────────────────────────────────

function Escena2({ p }: { p: number }) {
  const busqueda = `cómo se seña «mañana» en LSM`;
  const n = Math.round(busqueda.length * tramo(p, 0.04, 0.34));
  const parpadeo = Math.floor(p * 12) % 2 === 0;
  const dudas = tramo(p, 0.58, 0.7);
  const canales = ["mano", "lugar", "orientación", "movimiento", "cara"];
  const anchos = canales.map((c) => (c + " ?").length * 6.6 + 22);
  const total = anchos.reduce((a, b) => a + b, 0) + (canales.length - 1) * 8;
  let cursor = CX - total / 2;
  return (
    <g>
      <rect x="64" y="22" width="352" height="42" rx="21" fill={C.g800} stroke={C.g600} strokeWidth="1.5" />
      <circle cx="90" cy="43" r="7" fill="none" stroke={C.g400} strokeWidth="2" />
      <path d="M 95 48 L 100 53" stroke={C.g400} strokeWidth="2" strokeLinecap="round" />
      <text x="110" y="48" fontSize="14" fill={C.paper}>
        {busqueda.slice(0, n)}
        {p < 0.4 && parpadeo ? "|" : ""}
      </text>
      {[0, 1, 2].map((i) => {
        const o = sale(tramo(p, 0.36 + i * 0.06, 0.46 + i * 0.06));
        const y = 84 + i * 40;
        return (
          <g key={i} opacity={o * mezcla(1, 0.45, dudas)} transform={`translate(0 ${(1 - o) * 8})`}>
            <rect
              x="64"
              y={y}
              width="46"
              height="30"
              rx="6"
              fill={dudas > 0 ? "none" : C.g700}
              stroke={C.g500}
              strokeWidth="1.5"
              strokeDasharray={dudas > 0 ? "4 3" : undefined}
            />
            {dudas > 0 && (
              <text x="87" y={y + 20} textAnchor="middle" fontSize="14" fontWeight="700" fill={C.g400} opacity={dudas}>
                ?
              </text>
            )}
            <rect x="122" y={y + 4} width={[210, 170, 240][i]} height="8" rx="4" fill={C.g600} />
            <rect x="122" y={y + 18} width={[140, 190, 110][i]} height="6" rx="3" fill={C.g700} />
          </g>
        );
      })}
      {canales.map((c, i) => {
        const w = anchos[i];
        const x = cursor + w / 2;
        cursor += w + 8;
        return (
          <Fragmento
            key={c}
            t={sale(tramo(p, 0.66 + i * 0.05, 0.76 + i * 0.05))}
            x={x}
            y={232}
            texto={`${c} ?`}
            color={C.coral}
          />
        );
      })}
    </g>
  );
}

// ── 3. Una sola persona no basta ────────────────────────────────

const VARIA: [number, number][] = [
  [0, 0],
  [3, -6],
  [-4, 2],
  [5, 3],
  [-2, -8],
  [6, -3],
  [-5, -4],
  [2, 5],
  [-3, 6],
];

/** Centro del cuadro i en la rejilla de 3 × 3 (el 4 es el del centro). */
function enRejilla(i: number): { x: number; y: number } {
  const orden = [4, 0, 1, 2, 3, 5, 6, 7, 8][i];
  return { x: CX + ((orden % 3) - 1) * 104, y: CY + (Math.floor(orden / 3) - 1) * 76 };
}

function Escena3({ p }: { p: number }) {
  const t = entraSale(tramo(p, 0.22, 0.62));
  return (
    <g>
      {[1, 2, 3, 4, 5, 6, 7, 8, 0].map((i) => {
        const fin = enRejilla(i);
        const x = mezcla(CX, fin.x, t);
        const y = mezcla(CY, fin.y, t);
        const escala = i === 0 ? mezcla(1.9, 1, t) : mezcla(0.5, 1, t);
        const o = i === 0 ? 1 : tramo(p, 0.22, 0.34);
        const vaiven = Math.sin(p * 9 + i * 1.7) * 2;
        return (
          <g key={i} opacity={o} transform={`translate(${x} ${y}) scale(${escala})`}>
            <rect x="-46" y="-31" width="92" height="62" rx="8" fill={C.g800} stroke={C.g700} strokeWidth="1.5" />
            <Persona
              x={0}
              y={4}
              escala={0.95}
              color={i === 0 ? C.paper : colorDe(i - 1)}
              mano={[VARIA[i][0] + vaiven, VARIA[i][1]]}
            />
          </g>
        );
      })}
    </g>
  );
}

// ── 4. Nueve manos por seña ─────────────────────────────────────

function Escena4({ p }: { p: number }) {
  const t = entraSale(tramo(p, 0, 0.3));
  const r = 84;
  const llenas = Array.from({ length: 8 }, (_, i) => tramo(p, 0.34 + i * 0.065, 0.42 + i * 0.065));
  const late = p > 0.88 ? (Math.sin(p * 40) + 1) / 2 : 0;
  return (
    <g>
      <circle cx={CX} cy={CY} r={r} fill="none" stroke={C.g700} strokeWidth="1.5" opacity={t} />
      <text
        x={CX}
        y={CY + 6}
        textAnchor="middle"
        fontSize="17"
        fontWeight="700"
        letterSpacing="0.5"
        fill={C.paper}
        opacity={tramo(p, 0.2, 0.34)}
      >
        {SENA}
      </text>
      {Array.from({ length: 9 }, (_, i) => {
        const ini = enRejilla(i);
        const fin = lugar(i, r);
        const x = mezcla(ini.x, fin.x, t);
        const y = mezcla(ini.y, fin.y, t);
        const w = mezcla(92, 24, t);
        const h = mezcla(62, 24, t);
        const llena = i < 8 ? llenas[i] : 0;
        const escala = i === 8 ? 1 + 0.18 * late : 1;
        return (
          <g key={i}>
            <rect
              x={x - (w * escala) / 2}
              y={y - (h * escala) / 2}
              width={w * escala}
              height={h * escala}
              rx={mezcla(8, 12, t) * escala}
              fill={C.g800}
              stroke={C.g500}
              strokeWidth="1.5"
              strokeDasharray={t > 0.9 ? "3.5 3" : undefined}
            />
            {llena > 0 && <circle cx={fin.x} cy={fin.y} r={12 * rebota(llena)} fill={colorDe(i)} />}
          </g>
        );
      })}
      {ESTADOS.map((e, i) => {
        const o = tramo(p, 0.38 + i * 0.065, 0.46 + i * 0.065);
        const { x, y } = lugar(i, r + 26);
        const ancla = Math.abs(x - CX) < 8 ? "middle" : x > CX ? "start" : "end";
        return (
          <text key={e} x={x} y={y + 4} textAnchor={ancla} fontSize="11" fill={C.g300} opacity={o}>
            {e}
          </text>
        );
      })}
    </g>
  );
}

// ── 5. Tú puedes ser una ────────────────────────────────────────

function Escena5({ p }: { p: number }) {
  const t = entraSale(tramo(p, 0, 0.22));
  const cx = mezcla(CX, 118, t);
  const r = mezcla(84, 62, t);
  const late = (Math.sin(p * 30) + 1) / 2;
  const nueve = lugar(8, r, cx, CY);
  const marco = sale(tramo(p, 0.16, 0.34));
  const linea = tramo(p, 0.22, 0.38);
  const rec = p > 0.38 && Math.floor(p * 14) % 2 === 0;
  const pasos = ["Lees", "Señas", "Sigues"];
  return (
    <g>
      <Circulo cx={cx} cy={CY} r={r} llenas={8} radio={mezcla(12, 10, t)} late={late} texto={SENA} tamTexto={mezcla(17, 13, t)} />
      <path
        d={`M ${nueve.x + 12} ${nueve.y} C ${nueve.x + 60} ${nueve.y}, 220 70, 254 78`}
        fill="none"
        stroke={C.g400}
        strokeWidth="1.5"
        strokeDasharray="4 4"
        opacity={linea}
      />
      <g opacity={marco} transform={`translate(${mezcla(40, 0, marco)} 0)`}>
        <rect x="254" y="42" width="196" height="138" rx="14" fill={C.g800} stroke={C.paper} strokeWidth="2" />
        <Persona x={352} y={118} escala={2.1} color={C.g300} mano={[Math.sin(p * 14) * 3, Math.cos(p * 14) * 3 - 4]} />
        <circle cx="274" cy="60" r="5" fill={C.coral} opacity={rec ? 1 : 0.25} />
        <text x="284" y="64" fontSize="10" fontWeight="700" fill={C.g300}>
          REC
        </text>
      </g>
      {pasos.map((paso, k) => {
        const encendido = tramo(p, 0.42 + k * 0.15, 0.5 + k * 0.15);
        const x = 256 + k * 66;
        return (
          <g key={paso} opacity={tramo(p, 0.3, 0.4)}>
            <rect
              x={x}
              y="196"
              width="60"
              height="28"
              rx="14"
              fill={encendido > 0 ? C.paper : "none"}
              fillOpacity={encendido}
              stroke={C.g600}
              strokeWidth="1.5"
            />
            <text
              x={x + 30}
              y="214"
              textAnchor="middle"
              fontSize="12"
              fontWeight="600"
              fill={encendido > 0.5 ? C.ink : C.g400}
            >
              {paso}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── 6. Tu cara se queda ─────────────────────────────────────────

function Escena6({ p }: { p: number }) {
  const cejas = Math.max(0, Math.sin(p * Math.PI * 3)) * 5;
  const aro = sale(tramo(p, 0.08, 0.34));
  const niveles = ["Abierto", "Investigación", "Restringido"];
  // el selector pasa por los tres y se queda en uno: tú eliges
  const elegido = p < 0.42 ? -1 : p < 0.56 ? 2 : p < 0.7 ? 0 : 1;
  const retira = sale(tramo(p, 0.82, 0.92));
  const mano = Math.sin(p * 16) * 6;
  return (
    <g>
      <rect x="52" y="34" width="176" height="186" rx="16" fill={C.g800} stroke={C.g700} strokeWidth="1.5" />
      {/* hombros y manos */}
      <path d="M 82 220 Q 82 168 140 168 Q 198 168 198 220 Z" fill={C.g600} />
      <circle cx={98 + mano} cy={176 - Math.abs(mano)} r="10" fill={C.g300} />
      <circle cx={184 - mano * 0.6} cy="182" r="10" fill={C.g300} />
      {/* la cara */}
      <circle cx="140" cy="112" r="34" fill={C.paper} />
      <circle cx="128" cy="108" r="3.5" fill={C.ink} />
      <circle cx="152" cy="108" r="3.5" fill={C.ink} />
      <path d={`M 120 ${98 - cejas} L 134 ${96 - cejas}`} stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      <path d={`M 146 ${96 - cejas} L 160 ${98 - cejas}`} stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      <path d={`M 128 126 Q 140 ${132 + cejas * 0.8} 152 126`} fill="none" stroke={C.ink} strokeWidth="3" strokeLinecap="round" />
      <circle
        cx="140"
        cy="112"
        r="46"
        fill="none"
        stroke={C.gold}
        strokeWidth="2.5"
        strokeDasharray="1"
        pathLength={1}
        strokeDashoffset={1 - aro}
        transform="rotate(-90 140 112)"
      />
      <text x="140" y="244" textAnchor="middle" fontSize="11" fill={C.gold} opacity={tramo(p, 0.28, 0.4)}>
        la cara también seña
      </text>

      {niveles.map((n, i) => {
        const o = sale(tramo(p, 0.3 + i * 0.04, 0.4 + i * 0.04));
        const activo = elegido === i;
        const y = 54 + i * 44;
        return (
          <g key={n} opacity={o} transform={`translate(${(1 - o) * 12} 0)`}>
            <rect
              x="262"
              y={y}
              width="170"
              height="34"
              rx="17"
              fill={activo ? C.paper : "none"}
              stroke={activo ? C.paper : C.g600}
              strokeWidth="1.5"
            />
            <circle cx="280" cy={y + 17} r="5" fill={activo ? C.accent : "none"} stroke={activo ? C.accent : C.g500} strokeWidth="1.5" />
            <text x="294" y={y + 21} fontSize="13" fontWeight="600" fill={activo ? C.ink : C.g300}>
              {n}
            </text>
          </g>
        );
      })}
      <g opacity={tramo(p, 0.72, 0.8)}>
        <rect x="262" y="196" width="44" height="24" rx="12" fill={retira > 0.5 ? C.coral : C.g700} />
        <circle cx={mezcla(274, 294, retira)} cy="208" r="9" fill={C.paper} />
        <text x="316" y="212" fontSize="12" fill={C.g300}>
          Retirar cuando quieras
        </text>
      </g>
    </g>
  );
}

// ── 7. La novena mano cierra el círculo ─────────────────────────

function Escena7({ p }: { p: number }) {
  const r = 84;
  const novena = tramo(p, 0.1, 0.26);
  const cerrado = sale(tramo(p, 0.28, 0.66));
  const estallido = tramo(p, 0.64, 0.86);
  return (
    <g>
      {cerrado >= 1 &&
        Array.from({ length: 18 }, (_, k) => {
          const a = (k / 18) * Math.PI * 2;
          const r1 = r + 18 + estallido * 10;
          const r2 = r1 + 10 * (1 - estallido) + 4;
          return (
            <line
              key={k}
              x1={CX + r1 * Math.cos(a)}
              y1={CY + r1 * Math.sin(a)}
              x2={CX + r2 * Math.cos(a)}
              y2={CY + r2 * Math.sin(a)}
              stroke={colorDe(k)}
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity={1 - estallido}
            />
          );
        })}
      <Circulo cx={CX} cy={CY} r={r} llenas={8 + novena} cerrado={cerrado} />
      <text x={CX} y={CY + 2} textAnchor="middle" fontSize="17" fontWeight="700" letterSpacing="0.5" fill={C.paper}>
        {SENA}
      </text>
      <text x={CX} y={CY + 20} textAnchor="middle" fontSize="11" fill={C.green} opacity={tramo(p, 0.62, 0.72)}>
        completa
      </text>
      {APODOS.map((a, i) => {
        const o = sale(tramo(p, 0.5 + i * 0.035, 0.6 + i * 0.035));
        const { x, y } = lugar(i, r + 30);
        const tu = i === 8;
        const w = a.length * 6.4 + 14;
        const dx = Math.abs(x - CX) < 8 ? 0 : x > CX ? w / 2 - 8 : -(w / 2 - 8);
        return (
          <g key={a} opacity={o} transform={`translate(${x + dx} ${y})`}>
            <rect x={-w / 2} y="-10" width={w} height="20" rx="10" fill={tu ? C.paper : C.g800} />
            <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight={tu ? 700 : 500} fill={tu ? C.ink : C.g300}>
              {a}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── 8. La seña sigue su camino ──────────────────────────────────

const DESTINOS = [
  { y: 58, color: C.accent, titulo: "Investigación", sub: "el corpus de la LSM" },
  { y: 135, color: C.green, titulo: "Aprender", sub: "cómo se forma" },
  { y: 212, color: C.gold, titulo: "SignaPlay", sub: "para niñas y niños" },
];

function Icono({ i, x, y }: { i: number; x: number; y: number }) {
  if (i === 0)
    return (
      <g fill={C.ink}>
        <rect x={x - 9} y={y} width="5" height="8" rx="1" />
        <rect x={x - 2.5} y={y - 6} width="5" height="14" rx="1" />
        <rect x={x + 4} y={y - 3} width="5" height="11" rx="1" />
      </g>
    );
  if (i === 1)
    return (
      <g fill="none" stroke={C.ink} strokeWidth="2" strokeLinejoin="round">
        <path d={`M ${x} ${y - 6} L ${x - 10} ${y - 9} L ${x - 10} ${y + 7} L ${x} ${y + 10} Z`} />
        <path d={`M ${x} ${y - 6} L ${x + 10} ${y - 9} L ${x + 10} ${y + 7} L ${x} ${y + 10} Z`} />
      </g>
    );
  return <path d={`M ${x - 6} ${y - 9} L ${x + 9} ${y} L ${x - 6} ${y + 9} Z`} fill={C.ink} />;
}

function Escena8({ p }: { p: number }) {
  const t = entraSale(tramo(p, 0, 0.16));
  const cx = mezcla(CX, 96, t);
  const r = mezcla(84, 54, t);
  return (
    <g>
      <Circulo cx={cx} cy={CY} r={r} llenas={9} radio={mezcla(12, 8, t)} cerrado={1} texto={SENA} tamTexto={mezcla(17, 11, t)} />
      {DESTINOS.map((d, k) => {
        const ini: [number, number] = [cx + r + 10, CY];
        const fin: [number, number] = [286, d.y];
        const c1: [number, number] = [ini[0] + 70, CY];
        const c2: [number, number] = [fin[0] - 70, d.y];
        const avance = sale(tramo(p, 0.16 + k * 0.17, 0.38 + k * 0.17));
        const nodo = rebota(tramo(p, 0.36 + k * 0.17, 0.46 + k * 0.17));
        const [px, py] = bezier(avance, ini, c1, c2, fin);
        return (
          <g key={d.titulo}>
            <path
              d={`M ${ini[0]} ${ini[1]} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${fin[0]} ${fin[1]}`}
              fill="none"
              stroke={d.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="1"
              pathLength={1}
              strokeDashoffset={1 - avance}
              opacity={avance > 0 ? t : 0}
            />
            {avance > 0 && avance < 1 && <circle cx={px} cy={py} r="5" fill={C.paper} />}
            <g opacity={tramo(p, 0.36 + k * 0.17, 0.42 + k * 0.17)}>
              <circle cx={fin[0] + 20} cy={d.y} r={20 * nodo} fill={d.color} />
              {nodo > 0.8 && <Icono i={k} x={fin[0] + 20} y={d.y} />}
              <text x={fin[0] + 50} y={d.y - 2} fontSize="15" fontWeight="700" fill={C.paper}>
                {d.titulo}
              </text>
              <text x={fin[0] + 50} y={d.y + 15} fontSize="11" fill={C.g400}>
                {d.sub}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

export const ESCENAS = [Escena1, Escena2, Escena3, Escena4, Escena5, Escena6, Escena7, Escena8];

export function Lienzo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className={className}
      aria-hidden
      fontFamily="var(--font-display, inherit)"
    >
      {children}
    </svg>
  );
}

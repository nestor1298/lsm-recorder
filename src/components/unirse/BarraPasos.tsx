/**
 * BarraPasos — tres segmentos: quién eres, un poco de ti, cómo participas.
 */
export const PASOS_UNIRSE = [
  { n: 1, titulo: "Quién eres" },
  { n: 2, titulo: "Un poco de ti" },
  { n: 3, titulo: "Cómo participas" },
] as const;

export default function BarraPasos({ paso }: { paso: 1 | 2 | 3 }) {
  return (
    <ol className="flex gap-2" aria-label={`Paso ${paso} de 3`}>
      {PASOS_UNIRSE.map((p) => {
        const hecho = p.n < paso;
        const actual = p.n === paso;
        return (
          <li key={p.n} className="flex-1" aria-current={actual ? "step" : undefined}>
            <span
              className={`block h-1.5 rounded-full ${
                hecho ? "bg-green" : actual ? "bg-ink" : "bg-gray-200"
              }`}
            />
            <span
              className={`mt-2 block text-xs font-semibold ${
                actual ? "text-ink" : hecho ? "text-green-deep" : "text-gray-600"
              }`}
            >
              {p.n}. {p.titulo}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Modo experto: línea de tiempo multicanal

En `/annotate` la anotación se lee como canales apilados (una proyección
de `PSHRSegment[]` por matriz) con zoom y desplazamiento continuos y
edición de fronteras al milisegundo. Ver
[docs/timeline-multicanal.md](docs/timeline-multicanal.md).

## Dos corpus en Grabar

Grabar empieza eligiendo entre el LSM Corpus (101 configuraciones de mano) y el corpus para SignaPlay (121 señas del nivel preescolar). Datos, llaves y compatibilidad en [docs/dos-corpus.md](docs/dos-corpus.md).

## El camino del señante

Portada → la historia de una seña en 40 s (dibujos animados) → Unirse en
tres pasos (correo y apodo, un poco de ti, nivel de acceso y acuerdo) →
elegir lista → estudio → **nueve manos**: cada seña busca nueve personas
distintas; ves qué mano eres, la novena cierra el círculo, llenas tu atlas
de la mano y ganas sellos de ruta; `/comunidad` muestra a qué señas les
falta poco y el mapa de manos por estado, sin posiciones. El camino se
inspira en Huddle (Play With ASL); la historia y el juego son propios, con
la esencia de SignaLab: el corpus de la LSM, el rostro como parte de la
lengua y los videos siempre de quien los graba. Ver [docs/camino-senante.md](docs/camino-senante.md).

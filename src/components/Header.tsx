"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import ChipSesion from "@/components/ChipSesion";

/**
 * El encabezado sigue el camino: Señar (las listas y el estudio) es la
 * acción principal; Aprender y Anotar son lo que sale del corpus; Mis
 * grabaciones es donde cada persona manda sobre sus videos. A la derecha,
 * la sesión (apodo y nivel) o Entrar.
 */
const NAV_ITEMS = [
  { href: "/", label: "Inicio", activa: (p: string) => p === "/" },
  {
    href: "/listas",
    label: "Señar",
    activa: (p: string) =>
      p.startsWith("/listas") || p.startsWith("/estudio") || p.startsWith("/record"),
  },
  { href: "/learn", label: "Aprender", activa: (p: string) => p.startsWith("/learn") },
  {
    href: "/annotate",
    label: "Anotar",
    activa: (p: string) => p.startsWith("/annotate") || p.startsWith("/anotar"),
  },
  {
    href: "/mis-grabaciones",
    label: "Mis grabaciones",
    activa: (p: string) => p.startsWith("/mis-grabaciones"),
  },
  {
    href: "/preguntas",
    label: "Preguntas",
    activa: (p: string) => p.startsWith("/preguntas") || p.startsWith("/acuerdo"),
  },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-200 bg-paper">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/otherai-mark.png"
              alt=""
              width={32}
              height={32}
              priority
            />
            <span className="font-display text-xl font-bold tracking-[-0.02em]">
              <span className="text-gold">signa</span>
              <span className="text-coral">lab</span>
            </span>
          </Link>
          <nav className="flex min-w-0 gap-1 overflow-x-auto" aria-label="Principal">
            {NAV_ITEMS.map((item) => {
              const isActive = item.activa(pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-ink underline decoration-accent decoration-2 underline-offset-8"
                      : "text-gray-600 hover:bg-gray-50 hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0">
            <ChipSesion />
          </div>
        </div>
      </div>
    </header>
  );
}

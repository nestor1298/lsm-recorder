"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/learn", label: "Aprender" },
  { href: "/inventario", label: "Inventario" },
  { href: "/record", label: "Grabar" },
  { href: "/anotar", label: "Anotar" },
  { href: "/mis-grabaciones", label: "Mis grabaciones" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-gray-200 bg-paper">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
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
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
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
        </div>
      </div>
    </header>
  );
}

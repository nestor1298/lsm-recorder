"use client";

/** Lee ?id= y trae la ficha publicada en public/lexico/e/<id>.json */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FichaSena from "@/components/lexico/FichaSena";
import type { LexiconEntry } from "@/lib/lexicon/types";

const ID_VALIDO = /^wsl-[A-Za-z0-9_-]+$/;

type Estado = { id: string; entry: LexiconEntry | null; error: boolean };

export default function CargaFicha() {
  const id = useSearchParams().get("id") ?? "";
  const valido = ID_VALIDO.test(id);
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    if (!valido) return;
    const ctrl = new AbortController();
    fetch(`/lexico/e/${id}.json`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((entry: LexiconEntry) => {
        setEstado({ id, entry, error: false });
        document.title = `${entry.gloss} · Léxico de la LSM`;
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setEstado({ id, entry: null, error: true });
      });
    return () => ctrl.abort();
  }, [id, valido]);

  const actual = estado?.id === id ? estado : null;
  if (!valido || actual?.error) {
    return (
      <div className="space-y-3 py-12 text-center">
        <p className="text-gray-600">No encontramos esa seña.</p>
        <Link href="/lexico" className="font-medium text-accent-deep underline">
          Volver al léxico
        </Link>
      </div>
    );
  }
  if (!actual?.entry) {
    return (
      <div className="flex justify-center py-24" aria-label="Cargando la seña">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }
  const e = actual.entry;
  return <FichaSena key={e.id} entry={e} trackUrl={e.tracks ? `/lexico/${e.tracks}` : null} />;
}

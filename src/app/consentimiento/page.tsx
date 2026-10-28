"use client";

/**
 * /consentimiento → /unirse?paso=3. El acuerdo y el nivel de acceso se
 * firman en el paso 3 de Unirse (también para volver a otorgar el
 * consentimiento después de retirarlo). Se conserva la ruta por los
 * enlaces antiguos.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { rutaUnirse } from "@/lib/camino";

export default function ConsentimientoPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace(rutaUnirse(3));
  }, [router]);
  return <p className="py-12 text-center text-gray-500">Redirigiendo al acuerdo...</p>;
}

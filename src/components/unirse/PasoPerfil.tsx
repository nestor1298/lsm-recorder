"use client";

/**
 * PasoPerfil — «Un poco de ti»: lo mínimo para que el corpus sea justo y
 * variado (edad, dónde vives, audición, desde cuándo señas). El
 * cuestionario largo sigue en /perfil para quien quiera completarlo.
 */

import { useState } from "react";
import { postJson } from "@/lib/api-client";
import { ESTADOS_MX, FUERA_DE_MEXICO } from "@/lib/estados_mx";
import type {
  AcquisitionAge,
  AgeBand,
  DeafFamily,
  DeafSince,
  HearingStatus,
} from "@/lib/types";
import { BotonPrincipal, Campo, claseInput, ErrorForm, Segmento } from "./campos";

const EDADES: { value: AgeBand; label: string }[] = [
  { value: "18-30", label: "18 a 30" },
  { value: "31-45", label: "31 a 45" },
  { value: "46-60", label: "46 a 60" },
  { value: "60+", label: "Más de 60" },
];

const AUDICION: { value: HearingStatus; label: string }[] = [
  { value: "sorde", label: "Persona sorda" },
  { value: "hipoacusique", label: "Persona hipoacúsica" },
  { value: "oyente", label: "Persona oyente" },
];

const DESDE: { value: DeafSince; label: string }[] = [
  { value: "nacimiento", label: "Desde que nací" },
  { value: "infancia", label: "En la infancia" },
  { value: "adolescencia", label: "En la adolescencia" },
  { value: "adultez", label: "En la adultez" },
];

const LSM_DESDE: { value: AcquisitionAge; label: string }[] = [
  { value: "desde_nacimiento", label: "Desde que nací" },
  { value: "antes_de_7", label: "Antes de los 7" },
  { value: "entre_7_y_12", label: "Entre los 7 y los 12" },
  { value: "adolescencia", label: "En la adolescencia" },
  { value: "adultez", label: "En la adultez" },
];

const FAMILIA: { value: DeafFamily; label: string }[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no_se", label: "No sé" },
];

export default function PasoPerfil({ onListo }: { onListo: () => void }) {
  const [edad, setEdad] = useState<AgeBand | "">("");
  const [estado, setEstado] = useState("");
  const [audicion, setAudicion] = useState<HearingStatus | "">("");
  const [desde, setDesde] = useState<DeafSince | "">("");
  const [lsmDesde, setLsmDesde] = useState<AcquisitionAge | "">("");
  const [familia, setFamilia] = useState<DeafFamily | "">("");
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!edad) return setError("Dinos tu edad.");
    if (!lsmDesde) return setError("Dinos desde cuándo señas LSM.");
    setError(null);
    setOcupado(true);
    try {
      await postJson("/api/profile", {
        edad,
        edad_adquisicion: lsmDesde,
        region_vive: estado || undefined,
        audicion: audicion || undefined,
        sorda_desde: audicion && audicion !== "oyente" && desde ? desde : undefined,
        personas_sordas_familia: familia || undefined,
      });
      onListo();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="aparece space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-[-0.02em] text-ink">
          Un poco de ti
        </h1>
        <p className="mt-2 text-gray-600">
          Para personas sordas e hipoacúsicas señantes, y para quien seña LSM
          con ellas. Ayuda a que el corpus sea justo y variado. Solo la edad
          y desde cuándo señas son obligatorias.
        </p>
      </div>
      <form onSubmit={guardar} className="space-y-6">
        <Segmento etiqueta="Edad" valor={edad} opciones={EDADES} onChange={setEdad} />

        <Campo etiqueta="¿Dónde vives?" htmlFor="estado">
          <select
            id="estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className={claseInput}
          >
            <option value="">Elige tu estado</option>
            {ESTADOS_MX.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={FUERA_DE_MEXICO}>{FUERA_DE_MEXICO}</option>
          </select>
        </Campo>

        <Segmento etiqueta="Soy" valor={audicion} opciones={AUDICION} onChange={setAudicion} />

        {audicion && audicion !== "oyente" && (
          <Segmento
            etiqueta={audicion === "sorde" ? "Sorda o sordo desde" : "Hipoacúsica o hipoacúsico desde"}
            valor={desde}
            opciones={DESDE}
            onChange={setDesde}
          />
        )}

        <Segmento
          etiqueta="Seño LSM desde"
          valor={lsmDesde}
          opciones={LSM_DESDE}
          onChange={setLsmDesde}
        />

        <Segmento
          etiqueta="¿Hay personas sordas en tu familia?"
          valor={familia}
          opciones={FAMILIA}
          onChange={setFamilia}
        />

        <ErrorForm>{error}</ErrorForm>
        <BotonPrincipal disabled={ocupado}>{ocupado ? "Guardando..." : "Continuar"}</BotonPrincipal>
      </form>
    </section>
  );
}

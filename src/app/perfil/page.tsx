"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import LSMVideoSlot from "@/components/LSMVideoSlot";
import { useAuth } from "@/hooks/useAuth";
import { postJson, fetchMe } from "@/lib/api-client";
import type {
  AgeBand,
  AcquisitionAge,
  LearnedHow,
  DeafFamily,
  HearingStatus,
  CommunityParticipation,
} from "@/lib/types";

const AGE_BANDS: { value: AgeBand; label: string }[] = [
  { value: "18-30", label: "18 a 30 años" },
  { value: "31-45", label: "31 a 45 años" },
  { value: "46-60", label: "46 a 60 años" },
  { value: "60+", label: "Más de 60 años" },
];

const ACQUISITION: { value: AcquisitionAge; label: string }[] = [
  { value: "desde_nacimiento", label: "Desde el nacimiento" },
  { value: "antes_de_7", label: "Antes de los 7 años" },
  { value: "entre_7_y_12", label: "Entre los 7 y los 12 años" },
  { value: "adolescencia", label: "En la adolescencia" },
  { value: "adultez", label: "En la adultez" },
];

const LEARNED: { value: LearnedHow; label: string }[] = [
  { value: "familia", label: "En la familia" },
  { value: "escuela", label: "En la escuela" },
  { value: "amistades", label: "Con amistades" },
  { value: "asociacion", label: "En una asociación" },
  { value: "otro", label: "Otro" },
];

const DEAF_FAMILY: { value: DeafFamily; label: string }[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
  { value: "no_se", label: "No sé" },
];

const HEARING: { value: HearingStatus; label: string }[] = [
  { value: "sorde", label: "Persona sorda" },
  { value: "hipoacusique", label: "Persona hipoacúsica" },
  { value: "oyente", label: "Persona oyente" },
];

const COMMUNITY: { value: CommunityParticipation; label: string }[] = [
  { value: "frecuente", label: "Frecuente" },
  { value: "ocasional", label: "Ocasional" },
  { value: "poca", label: "Poca" },
];

export default function PerfilPage() {
  const router = useRouter();
  const { state } = useAuth();

  const [edad, setEdad] = useState<AgeBand | "">("");
  const [adquisicion, setAdquisicion] = useState<AcquisitionAge | "">("");
  const [genero, setGenero] = useState("");
  const [regionVive, setRegionVive] = useState("");
  const [aniosEnRegion, setAniosEnRegion] = useState("");
  const [lugarCrecio, setLugarCrecio] = useState("");
  const [comoAprendio, setComoAprendio] = useState<LearnedHow | "">("");
  const [sordosFamilia, setSordosFamilia] = useState<DeafFamily | "">("");
  const [lenguaCasa, setLenguaCasa] = useState("");
  const [lenguaEscuela, setLenguaEscuela] = useState("");
  const [audicion, setAudicion] = useState<HearingStatus | "">("");
  const [comunidad, setComunidad] = useState<CommunityParticipation | "">("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state === "loading") return;
    if (state === "signedOut") {
      router.replace("/auth");
      return;
    }
    let active = true;
    fetchMe()
      .then((me) => {
        if (active && me.consentStatus !== "granted") {
          router.replace("/consentimiento");
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [state, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!edad || !adquisicion) {
      setError("La edad y la edad de adquisición de la LSM son obligatorias.");
      return;
    }
    setBusy(true);
    try {
      await postJson("/api/profile", {
        edad,
        edad_adquisicion: adquisicion,
        genero: genero || undefined,
        region_vive: regionVive || undefined,
        anios_en_region: aniosEnRegion ? Number(aniosEnRegion) : undefined,
        lugar_crecio: lugarCrecio || undefined,
        como_aprendio: comoAprendio || undefined,
        personas_sordas_familia: sordosFamilia || undefined,
        lengua_casa: lenguaCasa || undefined,
        lengua_escuela: lenguaEscuela || undefined,
        audicion: audicion || undefined,
        participacion_comunidad: comunidad || undefined,
      });
      router.push("/record");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Tu perfil</h1>
        <p className="text-sm text-gray-500">
          Estos datos ayudan a documentar el corpus. Solo la edad y la edad de
          adquisición de la LSM son obligatorias.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Edad" required>
          <Select
            value={edad}
            onChange={(v) => setEdad(v as AgeBand)}
            options={AGE_BANDS}
          />
        </Field>

        <Field label="Género">
          <input
            type="text"
            value={genero}
            onChange={(e) => setGenero(e.target.value)}
            placeholder="texto libre o prefiero no decir"
            className={inputClass}
          />
        </Field>

        <Field label="Región donde vives">
          <input
            type="text"
            value={regionVive}
            onChange={(e) => setRegionVive(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Años viviendo ahí">
          <input
            type="number"
            min={0}
            value={aniosEnRegion}
            onChange={(e) => setAniosEnRegion(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Lugar donde creciste">
          <input
            type="text"
            value={lugarCrecio}
            onChange={(e) => setLugarCrecio(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Edad de adquisición de la LSM" required>
          <Select
            value={adquisicion}
            onChange={(v) => setAdquisicion(v as AcquisitionAge)}
            options={ACQUISITION}
          />
        </Field>

        <Field label="Cómo aprendiste la LSM">
          <Select
            value={comoAprendio}
            onChange={(v) => setComoAprendio(v as LearnedHow)}
            options={LEARNED}
          />
        </Field>

        <Field label="¿Hay personas sordas en tu familia?">
          <Select
            value={sordosFamilia}
            onChange={(v) => setSordosFamilia(v as DeafFamily)}
            options={DEAF_FAMILY}
          />
        </Field>

        <Field label="Lengua que se usa en casa">
          <input
            type="text"
            value={lenguaCasa}
            onChange={(e) => setLenguaCasa(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Lengua que se usa en la escuela">
          <input
            type="text"
            value={lenguaEscuela}
            onChange={(e) => setLenguaEscuela(e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Audición">
          <Select
            value={audicion}
            onChange={(v) => setAudicion(v as HearingStatus)}
            options={HEARING}
          />
        </Field>

        <Field label="Participación en la comunidad sorda">
          <Select
            value={comunidad}
            onChange={(v) => setComunidad(v as CommunityParticipation)}
            options={COMMUNITY}
          />
        </Field>

        {error && (
          <p className="rounded-lg bg-coral-tint px-4 py-3 text-sm text-coral-deep">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-ink py-3 font-semibold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
        >
          {busy ? "Guardando..." : "Guardar y continuar"}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-accent";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-paper p-4">
      <LSMVideoSlot compact />
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-1 text-coral">*</span>}
      </label>
      {children}
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | "";
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={inputClass}
    >
      <option value="">Selecciona una opción</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

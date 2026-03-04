"use client";

import type {
  PSHRSegment,
  ContourMovement,
  LocalMovement,
  MovementPlane,
  PalmFacing,
  FingerPointing,
  BodyRegion,
  ContactType,
  Laterality,
  EyebrowPosition,
  MouthShape,
  HeadMovement,
} from "@/lib/types";
import { UB_LOCATIONS } from "@/lib/ub_inventory";
import BodySilhouette from "./BodySilhouette";

interface AnnotationFormProps {
  segment: PSHRSegment;
  onUpdate: (updates: Partial<PSHRSegment>) => void;
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (val: T | undefined) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-gray-500">
        {label}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange((e.target.value || undefined) as T | undefined)}
        className="w-full rounded border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-indigo-500 focus:outline-none"
      >
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt.replace(/_/g, " ").toLowerCase()}
          </option>
        ))}
      </select>
    </div>
  );
}

const CONTOUR_MOVEMENTS: ContourMovement[] = ["STRAIGHT", "ARC", "CIRCLE", "ZIGZAG", "SEVEN"];
const LOCAL_MOVEMENTS: LocalMovement[] = [
  "WIGGLE", "CIRCULAR", "TWIST", "SCRATCH", "NOD",
  "OSCILLATE", "RELEASE", "FLATTEN", "PROGRESSIVE", "VIBRATE", "RUB",
];
const MOVEMENT_PLANES: MovementPlane[] = ["HORIZONTAL", "VERTICAL", "SAGITTAL", "OBLIQUE"];
const PALM_FACINGS: PalmFacing[] = ["UP", "DOWN", "FORWARD", "BACK", "LEFT", "RIGHT", "NEUTRAL"];
const FINGER_POINTINGS: FingerPointing[] = ["UP", "DOWN", "FORWARD", "BACK", "LEFT", "RIGHT", "NEUTRAL"];
const BODY_REGIONS: BodyRegion[] = ["HEAD", "FACE", "NECK", "TRUNK", "ARM", "FOREARM", "HAND", "NEUTRAL_SPACE"];
const EYEBROW_POSITIONS: EyebrowPosition[] = ["NEUTRAL", "RAISED", "FURROWED"];
const MOUTH_SHAPES: MouthShape[] = ["NEUTRAL", "OPEN", "CLOSED", "ROUNDED", "STRETCHED"];
const HEAD_MOVEMENTS: HeadMovement[] = ["NONE", "NOD", "SHAKE", "TILT_LEFT", "TILT_RIGHT", "TILT_BACK", "TILT_DOWN"];

export default function AnnotationForm({ segment, onUpdate }: AnnotationFormProps) {
  const isMovement = segment.phase === "STROKE";
  const isHold = segment.phase === "HOLD";

  return (
    <div className="space-y-4">
      {/* Location (UB) — Interactive Body Silhouette */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-gray-700">
          Location (UB)
        </h4>
        <BodySilhouette
          selectedCode={segment.location_code}
          contact={segment.contact}
          laterality={segment.laterality}
          onSelect={(code) => {
            const loc = code ? UB_LOCATIONS.find((l) => l.code === code) : undefined;
            onUpdate({
              location_code: code,
              location: loc?.name,
              body_region: loc?.region as BodyRegion | undefined,
            });
          }}
          onContactChange={(v) => onUpdate({ contact: v })}
          onLateralityChange={(v) => onUpdate({ laterality: v })}
        />
      </div>

      {/* Movement (only for STROKE segments) */}
      {isMovement && (
        <div>
          <h4 className="mb-2 text-xs font-semibold text-gray-700">
            Movement (MV)
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <SelectField
              label="Contour"
              value={segment.contour_movement}
              options={CONTOUR_MOVEMENTS}
              onChange={(v) => onUpdate({ contour_movement: v })}
            />
            <SelectField
              label="Local"
              value={segment.local_movement}
              options={LOCAL_MOVEMENTS}
              onChange={(v) => onUpdate({ local_movement: v })}
            />
            <SelectField
              label="Plane"
              value={segment.movement_plane}
              options={MOVEMENT_PLANES}
              onChange={(v) => onUpdate({ movement_plane: v })}
            />
          </div>
        </div>
      )}

      {/* Orientation */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-gray-700">
          Orientation (OR)
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <SelectField
            label="Palm Facing"
            value={segment.palm_facing}
            options={PALM_FACINGS}
            onChange={(v) => onUpdate({ palm_facing: v })}
          />
          <SelectField
            label="Fingers Pointing"
            value={segment.finger_pointing}
            options={FINGER_POINTINGS}
            onChange={(v) => onUpdate({ finger_pointing: v })}
          />
        </div>
      </div>

      {/* Non-Manual (RNM) */}
      <div>
        <h4 className="mb-2 text-xs font-semibold text-gray-700">
          Non-Manual (RNM)
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <SelectField
            label="Eyebrows"
            value={segment.eyebrows}
            options={EYEBROW_POSITIONS}
            onChange={(v) => onUpdate({ eyebrows: v })}
          />
          <SelectField
            label="Mouth"
            value={segment.mouth}
            options={MOUTH_SHAPES}
            onChange={(v) => onUpdate({ mouth: v })}
          />
          <SelectField
            label="Head"
            value={segment.head_movement}
            options={HEAD_MOVEMENTS}
            onChange={(v) => onUpdate({ head_movement: v })}
          />
        </div>
      </div>
    </div>
  );
}

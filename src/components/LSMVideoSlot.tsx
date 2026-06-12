interface LSMVideoSlotProps {
  /** When provided, plays the LSM video; otherwise shows a labelled placeholder. */
  videoSrc?: string;
  caption?: string;
}

/**
 * Prominent video slot shown at the top of each consent/profile step. The LSM
 * videos are recorded later, so until `videoSrc` is set this renders a clearly
 * marked placeholder.
 */
export default function LSMVideoSlot({ videoSrc, caption }: LSMVideoSlotProps) {
  if (videoSrc) {
    return (
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-black">
        <video src={videoSrc} controls className="aspect-video w-full" />
        {caption && (
          <p className="bg-gray-50 px-3 py-2 text-xs text-gray-500">{caption}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-center">
      <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-500">
        video en LSM próximamente
      </span>
      {caption && <p className="mt-2 px-4 text-sm text-gray-400">{caption}</p>}
    </div>
  );
}

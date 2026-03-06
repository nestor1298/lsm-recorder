"use client";

interface ChannelNavProps {
  channels: Array<{ id: string; label: string; color: string }>;
  activeChannel: string;
  onNavigate: (id: string) => void;
}

export default function ChannelNav({ channels, activeChannel, onNavigate }: ChannelNavProps) {
  return (
    <nav className="fixed right-3 top-1/2 z-50 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
      {channels.map((ch) => {
        const isActive = activeChannel === ch.id;
        return (
          <button
            key={ch.id}
            onClick={() => onNavigate(ch.id)}
            className="group relative flex items-center justify-end"
            aria-label={`Ir a ${ch.label}`}
          >
            {/* Label tooltip */}
            <span className="absolute right-7 whitespace-nowrap rounded-md bg-gray-900/80 px-2 py-1 text-xs font-medium text-white backdrop-blur opacity-0 translate-x-2 transition-all group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none">
              {ch.label}
            </span>

            {/* Dot */}
            <span
              className={`h-3 w-3 rounded-full border-2 transition-all duration-300 ${
                isActive ? "scale-125" : "scale-100 border-white/40 bg-white/20"
              }`}
              style={
                isActive
                  ? {
                      backgroundColor: ch.color,
                      borderColor: ch.color,
                      boxShadow: `0 0 8px ${ch.color}80`,
                    }
                  : {}
              }
            />
          </button>
        );
      })}
    </nav>
  );
}

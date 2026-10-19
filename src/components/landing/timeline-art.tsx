/**
 * Decorative illustration of a tabletop timeline: six injects on a line, the fourth live.
 * Pure SVG, deep blue on paper, hidden from assistive tech.
 */
const NODES = [
  { x: 60, label: "Start" },
  { x: 220, label: "+15 min" },
  { x: 380, label: "+30 min" },
  { x: 540, label: "+50 min", live: true },
  { x: 700, label: "+70 min" },
  { x: 860, label: "Wrap-up" },
];

export function TimelineArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 920 160"
      className={className}
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <defs>
        <linearGradient id="tl-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="oklch(0.36 0.13 262)" stopOpacity="0.15" />
          <stop offset="0.5" stopColor="oklch(0.36 0.13 262)" stopOpacity="0.9" />
          <stop offset="1" stopColor="oklch(0.36 0.13 262)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <line x1="20" y1="80" x2="900" y2="80" stroke="url(#tl-line)" strokeWidth="1.5" />
      {NODES.map((node) => (
        <g key={node.x}>
          {node.live && (
            <>
              <circle cx={node.x} cy="80" r="22" fill="oklch(0.36 0.13 262)" fillOpacity="0.08">
                <animate attributeName="r" values="18;30;18" dur="4s" repeatCount="indefinite" />
                <animate
                  attributeName="fill-opacity"
                  values="0.12;0.02;0.12"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx={node.x} cy="80" r="11" fill="oklch(0.36 0.13 262)" />
              <circle cx={node.x} cy="80" r="4" fill="oklch(0.99 0.004 262)" />
            </>
          )}
          {!node.live && (
            <circle
              cx={node.x}
              cy="80"
              r="6"
              fill={node.x < 540 ? "oklch(0.36 0.13 262)" : "oklch(0.993 0.003 80)"}
              stroke="oklch(0.36 0.13 262)"
              strokeWidth="1.5"
            />
          )}
          <text
            x={node.x}
            y={node.live ? 124 : 112}
            textAnchor="middle"
            fontFamily="var(--font-display), Georgia, serif"
            fontStyle="italic"
            fontSize={node.live ? 15 : 13}
            fill={node.live ? "oklch(0.36 0.13 262)" : "oklch(0.46 0.035 262)"}
          >
            {node.label}
          </text>
          <line
            x1={node.x}
            y1="48"
            x2={node.x}
            y2="70"
            stroke="oklch(0.36 0.13 262)"
            strokeWidth="1"
            strokeOpacity={node.x <= 540 ? 0.5 : 0.2}
          />
        </g>
      ))}
      <text
        x="60"
        y="38"
        fontSize="11"
        fill="oklch(0.46 0.035 262)"
        letterSpacing="2"
        fontFamily="var(--font-sans)"
      >
        INJECT 1
      </text>
      <text
        x="540"
        y="38"
        textAnchor="middle"
        fontSize="11"
        fill="oklch(0.36 0.13 262)"
        letterSpacing="2"
        fontFamily="var(--font-sans)"
      >
        INJECT 4 · DECISION LOGGED 10:42
      </text>
    </svg>
  );
}

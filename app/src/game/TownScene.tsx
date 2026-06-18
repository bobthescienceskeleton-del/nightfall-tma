// The town backdrop, behind the game UI. A cozy little village that breathes
// between a moonlit night (deep indigo, a glowing moon, twinkling stars,
// flickering windows, drifting mist) and a warm dawn (rising sun, soft sky).
// Same cinematic-lighting technique as the other games' room scenes.
export function TownScene({ mode }: { mode: 'night' | 'day' }) {
  const night = mode === 'night'
  return (
    <svg className="townscene" viewBox="0 0 375 720" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="tw-sky-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2b3270" />
          <stop offset="55%" stopColor="#1d2150" />
          <stop offset="100%" stopColor="#141733" />
        </linearGradient>
        <linearGradient id="tw-sky-day" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd98a" />
          <stop offset="55%" stopColor="#f6c074" />
          <stop offset="100%" stopColor="#e9a663" />
        </linearGradient>
        <radialGradient id="tw-moon" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#fffae6" />
          <stop offset="70%" stopColor="#f6e6a6" />
          <stop offset="100%" stopColor="#e9c863" />
        </radialGradient>
        <radialGradient id="tw-moonhalo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f6e6a6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f6e6a6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="tw-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6db" />
          <stop offset="60%" stopColor="#ffd98a" />
          <stop offset="100%" stopColor="#ffb454" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tw-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={night ? '#222a52' : '#caa14e'} />
          <stop offset="100%" stopColor={night ? '#141733' : '#b07f33'} />
        </linearGradient>
        <linearGradient id="tw-house" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={night ? '#39305a' : '#e7c98f'} />
          <stop offset="100%" stopColor={night ? '#251c40' : '#cfa869'} />
        </linearGradient>
        <linearGradient id="tw-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={night ? '#4a3a6a' : '#a86b3c'} />
          <stop offset="100%" stopColor={night ? '#2e2348' : '#8a5329'} />
        </linearGradient>
        <radialGradient id="tw-vign" cx="50%" cy="42%" r="70%">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="72%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000" stopOpacity={night ? 0.5 : 0.28} />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect x="0" y="0" width="375" height="720" fill={night ? 'url(#tw-sky-night)' : 'url(#tw-sky-day)'} />

      {night ? (
        <>
          {/* stars */}
          <g className="ts-stars" fill="#fdf6d8">
            {STARS.map((s, i) => (
              <circle key={i} cx={s[0]} cy={s[1]} r={s[2]} style={{ ['--td' as never]: `${(i % 6) * 1.1}s` }} />
            ))}
          </g>
          {/* moon + halo, upper right */}
          <circle cx="288" cy="118" r="96" fill="url(#tw-moonhalo)" className="ts-moon" />
          <circle cx="288" cy="118" r="46" fill="url(#tw-moon)" />
          <circle cx="304" cy="104" r="7" fill="#e6cf86" opacity="0.45" />
          <circle cx="276" cy="128" r="5" fill="#e6cf86" opacity="0.4" />
          <circle cx="298" cy="136" r="4" fill="#e6cf86" opacity="0.35" />
        </>
      ) : (
        <>
          {/* warm sun low on the horizon */}
          <circle cx="187" cy="240" r="160" fill="url(#tw-sun)" />
          <circle cx="187" cy="232" r="54" fill="#fff3cf" opacity="0.9" />
        </>
      )}

      {/* rolling hills */}
      <path d="M-20 360 Q120 318 200 350 Q300 388 395 352 L395 720 L-20 720 Z" fill="url(#tw-hill)" opacity="0.55" />

      {/* the village rooftops along the lower third */}
      <g>
        {HOUSES.map((h, i) => (
          <g key={i}>
            <rect x={h.x} y={h.y} width={h.w} height={720 - h.y} fill="url(#tw-house)" />
            <path d={`M${h.x - 6} ${h.y} L${h.x + h.w / 2} ${h.y - h.r} L${h.x + h.w + 6} ${h.y} Z`} fill="url(#tw-roof)" />
            {/* windows: glowing at night, dim by day */}
            <rect
              x={h.x + h.w / 2 - 8}
              y={h.y + 18}
              width="16"
              height="20"
              rx="3"
              fill={night ? '#f6b65a' : '#7c5a2e'}
              className={night ? 'ts-window' : undefined}
              style={night ? { ['--wd' as never]: `${(i % 5) * 1.3}s` } : undefined}
              opacity={night ? 0.92 : 0.5}
            />
          </g>
        ))}
      </g>

      {/* night mist hugging the street */}
      {night && (
        <>
          <ellipse cx="120" cy="612" rx="220" ry="40" fill="#aeb8e6" opacity="0.10" className="ts-moon" />
          <ellipse cx="280" cy="660" rx="240" ry="44" fill="#aeb8e6" opacity="0.08" />
        </>
      )}

      {/* cobbled foreground */}
      <rect x="0" y="690" width="375" height="30" fill={night ? '#0f1126' : '#7a5226'} />

      {/* corner vignette for depth */}
      <rect x="0" y="0" width="375" height="720" fill="url(#tw-vign)" />
    </svg>
  )
}

const STARS: [number, number, number][] = [
  [40, 60, 1.6], [90, 40, 1.2], [150, 80, 1.4], [60, 120, 1.1], [200, 50, 1.3],
  [120, 150, 1.5], [340, 200, 1.2], [30, 200, 1.3], [170, 30, 1.0], [240, 150, 1.4],
  [350, 90, 1.5], [20, 280, 1.1], [330, 280, 1.2], [110, 250, 1.0], [200, 220, 1.3],
]

const HOUSES = [
  { x: -10, y: 560, w: 70, r: 36 },
  { x: 70, y: 596, w: 78, r: 40 },
  { x: 158, y: 566, w: 66, r: 34 },
  { x: 232, y: 600, w: 84, r: 42 },
  { x: 322, y: 574, w: 72, r: 36 },
]

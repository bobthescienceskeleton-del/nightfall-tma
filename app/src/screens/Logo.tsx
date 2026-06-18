// The Nightfall mark: a full moon rising over a little row of village rooftops,
// a few lit windows glowing in the dark. Warm, cozy, and unmistakably "night".
export function Logo({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 160 160" className="brand-logo" aria-label="Nightfall">
      <defs>
        <radialGradient id="lg-moon" cx="42%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#fffae6" />
          <stop offset="70%" stopColor="#f6e6a6" />
          <stop offset="100%" stopColor="#e9c863" />
        </radialGradient>
        <linearGradient id="lg-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b4488" />
          <stop offset="100%" stopColor="#1c2050" />
        </linearGradient>
        <linearGradient id="lg-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2c55" />
          <stop offset="100%" stopColor="#241a3a" />
        </linearGradient>
      </defs>

      {/* sky disc */}
      <circle cx="80" cy="80" r="74" fill="url(#lg-sky)" />
      <circle cx="80" cy="80" r="74" fill="none" stroke="#f6e6a6" strokeWidth="3" opacity="0.85" />

      {/* moon glow + moon */}
      <circle cx="62" cy="58" r="40" fill="#f6e6a6" opacity="0.18" />
      <circle cx="62" cy="58" r="27" fill="url(#lg-moon)" />
      <circle cx="74" cy="50" r="4.5" fill="#e6cf86" opacity="0.5" />
      <circle cx="55" cy="64" r="3" fill="#e6cf86" opacity="0.45" />
      <circle cx="68" cy="68" r="2.2" fill="#e6cf86" opacity="0.4" />

      {/* stars */}
      <g fill="#fdf6d8">
        <circle cx="112" cy="40" r="1.8" opacity="0.9" />
        <circle cx="124" cy="64" r="1.4" opacity="0.7" />
        <circle cx="100" cy="28" r="1.2" opacity="0.6" />
        <circle cx="34" cy="36" r="1.3" opacity="0.7" />
      </g>

      {/* clip rooftops to the lower disc */}
      <clipPath id="lg-clip"><circle cx="80" cy="80" r="74" /></clipPath>
      <g clipPath="url(#lg-clip)">
        {/* back row of houses */}
        <path d="M8 128 L8 108 L26 92 L44 108 L44 128 Z" fill="#2b2046" />
        <path d="M116 128 L116 104 L134 88 L152 104 L152 128 Z" fill="#2b2046" />
        {/* front houses */}
        <path d="M30 134 L30 104 L52 86 L74 104 L74 134 Z" fill="url(#lg-roof)" />
        <path d="M86 134 L86 100 L108 82 L130 100 L130 134 Z" fill="url(#lg-roof)" />
        {/* lit windows */}
        <rect x="46" y="110" width="12" height="14" rx="2" fill="#f6b65a" />
        <rect x="100" y="106" width="12" height="14" rx="2" fill="#f6b65a" />
        <rect x="20" y="116" width="9" height="11" rx="2" fill="#f6b65a" opacity="0.85" />
        {/* ground */}
        <rect x="0" y="132" width="160" height="28" fill="#181228" />
      </g>
    </svg>
  )
}

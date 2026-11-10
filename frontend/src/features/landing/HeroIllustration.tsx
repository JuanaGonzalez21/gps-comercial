/**
 * Decorative product illustration (inline SVG: no image request, no external asset). It reuses the
 * map's marker language: teal circle with heading arrow = moving, grey square = stopped, red
 * diamond with "!" = no signal. Hidden from assistive tech because the copy next to it says it all.
 */
export function HeroIllustration() {
  return (
    <svg
      className="hero-illustration"
      viewBox="0 0 520 404"
      aria-hidden="true"
      focusable="false"
    >
      {/* Map surface */}
      <rect x="16" y="16" width="488" height="292" rx="14" fill="#f7f4f9" />
      <rect x="300" y="40" width="150" height="86" rx="12" fill="#e6f3f4" />
      <rect x="54" y="206" width="120" height="74" rx="12" fill="#eee8f2" />
      <g fill="none" stroke="#e2dbe7" strokeLinecap="round" strokeWidth="14">
        <path d="M16 170 H504" />
        <path d="M240 16 V308" />
        <path d="M60 16 L200 308" />
        <path d="M330 308 L504 200" />
      </g>
      <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="2" strokeDasharray="6 10">
        <path d="M16 170 H504" />
        <path d="M240 16 V308" />
      </g>

      {/* Travelled route */}
      <path
        d="M78 70 C 130 90, 150 150, 240 170 S 360 150, 400 220 S 450 270, 470 260"
        fill="none"
        stroke="#1e8c93"
        strokeOpacity="0.18"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M78 70 C 130 90, 150 150, 240 170 S 360 150, 400 220 S 450 270, 470 260"
        fill="none"
        stroke="#1e8c93"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="78" cy="70" r="7" fill="#ffffff" stroke="#176f75" strokeWidth="4" />

      {/* Destination pin (brand mark) */}
      <path d="M470 222 a17 17 0 0 0 -17 17 c0 13 17 30 17 30 s17 -17 17 -30 a17 17 0 0 0 -17 -17z" fill="#eb162c" />
      <circle cx="470" cy="239" r="6" fill="#ffffff" />

      {/* Moving vehicle with a soft pulse */}
      <circle className="hero-illustration__pulse" cx="240" cy="170" r="13" fill="#1e8c93" />
      <circle cx="240" cy="170" r="13" fill="#1e8c93" stroke="#ffffff" strokeWidth="3" />
      <path d="M240 162 l6 11 h-12 z" fill="#ffffff" transform="rotate(60 240 170)" />

      {/* Stopped vehicle */}
      <rect x="111" y="129" width="22" height="22" rx="4" fill="#6b6b6b" stroke="#ffffff" strokeWidth="3" />

      {/* Vehicle without signal */}
      <rect
        x="372"
        y="83"
        width="22"
        height="22"
        rx="3"
        fill="#a81a2b"
        stroke="#ffffff"
        strokeWidth="3"
        transform="rotate(45 383 94)"
      />
      <path d="M383 87 v8 M383 100 v1" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />

      {/* Popup of the selected vehicle */}
      <g>
        <rect x="160" y="188" width="164" height="62" rx="10" fill="#ffffff" stroke="#e2dbe7" />
        <path d="M232 188 l8 -9 l8 9 z" fill="#ffffff" stroke="#e2dbe7" />
        <rect x="231" y="186" width="18" height="4" fill="#ffffff" />
        <text x="176" y="212" fill="#125a5f" fontSize="14" fontWeight="700">
          En movimiento
        </text>
        <text x="176" y="235" fill="#57525c" fontSize="13">
          48 km/h · rumbo noreste
        </text>
      </g>

      {/* Status summary strip */}
      <g fontSize="13" fill="#1f1a24">
        <rect x="16" y="324" width="152" height="64" rx="12" fill="#ffffff" stroke="#e2dbe7" />
        <circle cx="38" cy="346" r="7" fill="#1e8c93" />
        <text x="52" y="351">En movimiento</text>
        <rect x="30" y="364" width="120" height="8" rx="4" fill="#e6f3f4" />
        <rect x="30" y="364" width="84" height="8" rx="4" fill="#1e8c93" />

        <rect x="184" y="324" width="152" height="64" rx="12" fill="#ffffff" stroke="#e2dbe7" />
        <rect x="199" y="339" width="14" height="14" rx="3" fill="#6b6b6b" />
        <text x="222" y="351">Detenido</text>
        <rect x="198" y="364" width="120" height="8" rx="4" fill="#efefef" />
        <rect x="198" y="364" width="48" height="8" rx="4" fill="#6b6b6b" />

        <rect x="352" y="324" width="152" height="64" rx="12" fill="#ffffff" stroke="#e2dbe7" />
        <rect x="368" y="339" width="13" height="13" rx="2" fill="#a81a2b" transform="rotate(45 374.5 345.5)" />
        <text x="390" y="351">Sin señal</text>
        <rect x="366" y="364" width="120" height="8" rx="4" fill="#fbeaec" />
        <rect x="366" y="364" width="22" height="8" rx="4" fill="#a81a2b" />
      </g>
    </svg>
  )
}

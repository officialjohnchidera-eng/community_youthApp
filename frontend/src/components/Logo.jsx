export default function Logo({ size = 'md', showText = true }) {
  const sizes = {
    sm: { img: 32, text: 'text-sm', sub: 'text-xs' },
    md: { img: 44, text: 'text-base', sub: 'text-xs' },
    lg: { img: 80, text: 'text-2xl', sub: 'text-sm' },
    xl: { img: 120, text: 'text-4xl', sub: 'text-base' },
  }

  const s = sizes[size]

  return (
    <div className="flex items-center gap-3">
      {/* Logo Emblem */}
      <div className="relative flex-shrink-0" style={{ width: s.img, height: s.img }}>
        <svg viewBox="0 0 100 100" width={s.img} height={s.img} xmlns="http://www.w3.org/2000/svg">
          {/* Outer Ring */}
          <circle cx="50" cy="50" r="48" fill="none" stroke="#10b981" strokeWidth="1.5" opacity="0.6" />
          
          {/* Inner Ring */}
          <circle cx="50" cy="50" r="42" fill="#111827" />
          
          {/* Gradient Background */}
          <defs>
            <radialGradient id="bgGrad" cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#064e3b" />
              <stop offset="100%" stopColor="#111827" />
            </radialGradient>
            <clipPath id="circleClip">
              <circle cx="50" cy="50" r="41" />
            </clipPath>
          </defs>
          <circle cx="50" cy="50" r="41" fill="url(#bgGrad)" />

          {/* Bottom Arc Label */}
          <path id="bottomArc" d="M 15,65 A 38,38 0 0,0 85,65" fill="none" />
          <path id="topArc" d="M 18,48 A 35,35 0 0,1 82,48" fill="none" />

          {/* Leopard Silhouette */}
          <g clipPath="url(#circleClip)" transform="translate(18, 14) scale(0.64)">
            {/* Head */}
            <ellipse cx="50" cy="35" rx="22" ry="20" fill="#d97706" />
            {/* Face markings */}
            <ellipse cx="50" cy="38" rx="14" ry="12" fill="#fbbf24" opacity="0.6" />
            {/* Eyes */}
            <ellipse cx="43" cy="31" rx="4" ry="5" fill="#1f2937" />
            <ellipse cx="57" cy="31" rx="4" ry="5" fill="#1f2937" />
            <circle cx="43" cy="31" r="2" fill="#10b981" />
            <circle cx="57" cy="31" r="2" fill="#10b981" />
            <circle cx="44" cy="30" r="1" fill="white" />
            <circle cx="58" cy="30" r="1" fill="white" />
            {/* Nose */}
            <ellipse cx="50" cy="38" rx="3" ry="2" fill="#92400e" />
            {/* Mouth */}
            <path d="M 47,40 Q 50,44 53,40" fill="none" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" />
            {/* Ears */}
            <polygon points="32,20 26,8 40,16" fill="#d97706" />
            <polygon points="68,20 74,8 60,16" fill="#d97706" />
            <polygon points="33,19 28,11 39,17" fill="#92400e" />
            <polygon points="67,19 72,11 61,17" fill="#92400e" />
            {/* Whiskers */}
            <line x1="30" y1="38" x2="46" y2="38" stroke="#fbbf24" strokeWidth="1" opacity="0.8" />
            <line x1="30" y1="41" x2="46" y2="40" stroke="#fbbf24" strokeWidth="1" opacity="0.8" />
            <line x1="70" y1="38" x2="54" y2="38" stroke="#fbbf24" strokeWidth="1" opacity="0.8" />
            <line x1="70" y1="41" x2="54" y2="40" stroke="#fbbf24" strokeWidth="1" opacity="0.8" />
            {/* Spots */}
            <ellipse cx="38" cy="28" rx="2.5" ry="2" fill="#92400e" opacity="0.5" />
            <ellipse cx="62" cy="28" rx="2.5" ry="2" fill="#92400e" opacity="0.5" />
            <ellipse cx="36" cy="34" rx="2" ry="1.5" fill="#92400e" opacity="0.4" />
            <ellipse cx="64" cy="34" rx="2" ry="1.5" fill="#92400e" opacity="0.4" />
            {/* Body */}
            <ellipse cx="50" cy="70" rx="20" ry="25" fill="#d97706" />
            <ellipse cx="50" cy="72" rx="12" ry="18" fill="#fbbf24" opacity="0.5" />
            {/* Body spots */}
            <ellipse cx="40" cy="65" rx="3" ry="2.5" fill="#92400e" opacity="0.5" />
            <ellipse cx="60" cy="65" rx="3" ry="2.5" fill="#92400e" opacity="0.5" />
            <ellipse cx="43" cy="75" rx="3" ry="2" fill="#92400e" opacity="0.5" />
            <ellipse cx="57" cy="75" rx="3" ry="2" fill="#92400e" opacity="0.5" />
          </g>

          {/* Emerald shine dots */}
          <circle cx="50" cy="8" r="2" fill="#10b981" opacity="0.8" />
          <circle cx="8" cy="50" r="1.5" fill="#10b981" opacity="0.5" />
          <circle cx="92" cy="50" r="1.5" fill="#10b981" opacity="0.5" />
        </svg>
      </div>

      {/* Text */}
      {showText && (
        <div className="flex flex-col">
          <span className={`font-black text-white tracking-tight leading-none ${s.text}`}
            style={{ fontFamily: "'Georgia', serif", letterSpacing: '-0.5px' }}>
            UMUAGU
          </span>
          <span className={`font-semibold tracking-widest uppercase leading-tight ${s.sub}`}
            style={{ color: '#10b981', letterSpacing: '3px', fontSize: size === 'sm' ? '8px' : size === 'md' ? '9px' : '11px' }}>
            Youth • Association
          </span>
        </div>
      )}
    </div>
  )
}
interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

/**
 * Isotipo + wordmark de RepairOS según la identidad de marca:
 * ícono "R" con acento de circuito en cyan sobre superficie oscura,
 * wordmark "Repair" + "OS" en cyan, tipografía Space Grotesk.
 */
export function Logo({ size = 32, showText = true, className }: LogoProps) {
  return (
    <span className={`d-inline-flex align-items-center gap-2 ${className ?? ''}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="1.5"
          y="1.5"
          width="37"
          height="37"
          rx="10"
          fill="#141820"
          stroke="#00C9FF"
          strokeWidth="1.5"
        />
        <path
          d="M13 28V12h6.5a4.5 4.5 0 0 1 0 9H16l6.5 7"
          stroke="#00C9FF"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path d="M26 15.5l2.8-2.8" stroke="#00C9FF" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="29.5" cy="11.8" r="1.7" fill="#00C9FF" />
      </svg>
      {showText && (
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: size * 0.56 }}>
          Repair<span style={{ color: '#00C9FF' }}>OS</span>
        </span>
      )}
    </span>
  );
}

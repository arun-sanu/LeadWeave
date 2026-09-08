interface LeadWeaveLogoProps {
  size?: number;
  className?: string;
  withText?: boolean;
  textColor?: string;
  glow?: boolean;
}

export function LeadWeaveLogo({
  size = 32,
  className = '',
  withText = false,
  textColor = '#ffffff',
  glow = true,
}: LeadWeaveLogoProps) {
  // Height/width aspect ratio from authentic 476x405 asset (~1.175)
  const height = size;
  const width = Math.round(size * 1.175);

  return (
    <div
      className={`leadweave-logo-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: withText ? Math.max(8, Math.round(size * 0.28)) : 0,
        verticalAlign: 'middle',
      }}
    >
      <img
        src="/leadweave-logo.png"
        alt="LeadWeave"
        width={width}
        height={height}
        style={{
          display: 'block',
          objectFit: 'contain',
          filter: glow ? 'drop-shadow(0 2px 10px rgba(103, 235, 216, 0.45))' : 'none',
          userSelect: 'none',
          pointerEvents: 'none',
          flexShrink: 0,
        }}
      />

      {withText && (
        <span
          style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: `${Math.round(size * 0.72)}px`,
            letterSpacing: '-0.03em',
            color: textColor,
            lineHeight: 1,
            userSelect: 'none',
          }}
        >
          LeadWeave
        </span>
      )}
    </div>
  );
}

export default LeadWeaveLogo;

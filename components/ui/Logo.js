/**
 * DeelMap wordmark — built in code, no image asset (Brand Guidelines §02).
 * "Deel" + map-pin glyph + "Map" in Space Grotesk 700, -.025em tracking.
 * Pin: square rotated -45° with border-radius 50% 50% 50% 0 (teardrop),
 * holding a white house (CSS triangle roof + rect body + ink window).
 *
 * size: 'header' (18px pin / 17px text) | 'footer' (15px / 14.5px) | number (pin px)
 * onDark: white wordmark for dark surfaces (pin geometry unchanged)
 */
export function Logo({ size = 'header', onDark = false, className = '' }) {
  const pin = typeof size === 'number' ? size : size === 'footer' ? 15 : 18
  const text = size === 'footer' ? 14.5 : pin * (17 / 18)
  const roof = pin * (4.5 / 18)
  const bodyW = pin * (7 / 18)
  const bodyH = pin * (5 / 18)
  const win = pin * (2.5 / 18)

  return (
    <span
      className={`inline-flex items-center select-none ${className}`}
      style={{
        fontFamily: 'var(--font-logo)',
        fontWeight: 700,
        fontSize: text,
        letterSpacing: '-0.025em',
        gap: pin >= 17 ? 4 : 3,
        color: onDark ? '#ffffff' : '#171717',
        lineHeight: 1,
      }}
      aria-label="DeelMap"
    >
      <span>Deel</span>
      <span
        style={{
          width: pin,
          height: pin,
          borderRadius: '50% 50% 50% 0',
          background: '#111111',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: 'rotate(-45deg)',
          flex: 'none',
        }}
      >
        <span style={{ transform: 'rotate(45deg)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span
            style={{
              width: 0,
              height: 0,
              borderLeft: `${roof}px solid transparent`,
              borderRight: `${roof}px solid transparent`,
              borderBottom: `${roof}px solid #ffffff`,
            }}
          />
          <span
            style={{
              width: bodyW,
              height: bodyH,
              background: '#ffffff',
              marginTop: '-0.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ width: win, height: win, background: '#111111' }} />
          </span>
        </span>
      </span>
      <span>Map</span>
    </span>
  )
}

export default Logo

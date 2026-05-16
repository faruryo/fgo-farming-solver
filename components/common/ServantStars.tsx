import React from 'react'

// 5-pointed star: outer radius 10, inner radius 4.6, centered at 0,0
const STAR_PATH =
  'M 0,-10 L 2.704,-3.721 L 9.511,-3.090 L 4.375,1.421 L 5.878,8.090 L 0,4.6 L -5.878,8.090 L -4.375,1.421 L -9.511,-3.090 L -2.704,-3.721 Z'

// Gradient ID is shared across all instances — all definitions are identical so the result is consistent
const GRAD_ID = 'servant-star-grad'

type Props = React.HTMLAttributes<HTMLSpanElement> & {
  rarity: number
}

export const ServantStars = ({ rarity, style, ...props }: Props) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 1, ...style }} {...props}>
    {Array.from({ length: rarity }, (_, i) => (
      <svg
        key={i}
        width="1em"
        height="1em"
        viewBox="-12 -12 24 24"
        aria-hidden="true"
        style={{
          position: 'relative',
          zIndex: i + 1,
          marginLeft: i === 0 ? 0 : '-0.5em',
          flexShrink: 0,
          filter: 'drop-shadow(0px 1px 1.5px rgba(0,0,0,0.35))',
        }}
      >
        <defs>
          <linearGradient id={GRAD_ID} x1="0" y1="-10" x2="0" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#e8c040" />
            <stop offset="55%"  stopColor="#c09030" />
            <stop offset="100%" stopColor="#8a6018" />
          </linearGradient>
        </defs>
        <path
          d={STAR_PATH}
          fill={`url(#${GRAD_ID})`}
          stroke="rgba(38,18,0,0.7)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </svg>
    ))}
  </span>
)

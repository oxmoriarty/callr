import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CallrLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  linkToHome?: boolean;
}

const sizes = {
  sm: { width: 80, height: 24 },
  md: { width: 110, height: 33 },
  lg: { width: 160, height: 48 },
};

export function CallrLogo({ size = 'md', className, linkToHome = true }: CallrLogoProps) {
  const { width, height } = sizes[size];

  const logo = (
    <div
      className={cn('flex items-center', className)}
      style={{ width, height }}
    >
      {/* Inline the SVG logo scaled appropriately */}
      <svg
        viewBox="0 0 1500 700"
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Callr"
      >
        {/* Football emblem */}
        <g transform="translate(0, 100)">
          <circle cx="330" cy="210" r="185" fill="none" stroke="#ffffff" strokeWidth="12"/>
          <polygon points="330,85 420,160 390,270 270,270 240,160" fill="#1800AD" stroke="#000" strokeWidth="5"/>
          {/* Panel lines */}
          <line x1="330" y1="85" x2="240" y2="160" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>
          <line x1="330" y1="85" x2="420" y2="160" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>
          <line x1="240" y1="160" x2="160" y2="210" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>
          <line x1="420" y1="160" x2="500" y2="210" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>
          <line x1="270" y1="270" x2="200" y2="340" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>
          <line x1="390" y1="270" x2="460" y2="340" stroke="#fff" strokeWidth="8" strokeLinecap="round"/>
        </g>
        {/* "callr" text */}
        <g transform="translate(580, 117)">
          {/* C */}
          <text x="0" y="320" fontFamily="Inter, sans-serif" fontSize="280" fontWeight="700" fill="#ffffff">callr</text>
        </g>
      </svg>
    </div>
  );

  if (linkToHome) {
    return (
      <Link href="/" className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg">
        {logo}
      </Link>
    );
  }

  return logo;
}

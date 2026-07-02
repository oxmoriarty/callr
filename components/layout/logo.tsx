import Link from 'next/link';
import Image from 'next/image';
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
    <div className={cn('flex items-center shrink-0', className)}>
      <Image
        src="/callr-logo.svg"
        alt="Callr"
        width={width}
        height={height}
        priority
        className="object-contain"
      />
    </div>
  );

  if (linkToHome) {
    return (
      <Link
        href="/"
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
      >
        {logo}
      </Link>
    );
  }

  return logo;
}

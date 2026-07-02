'use client';

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-8">
        {/* Logo */}
        <svg viewBox="0 0 160 48" width="160" height="48" aria-label="Callr">
          <circle cx="24" cy="24" r="18" fill="none" stroke="#fff" strokeWidth="2" strokeOpacity="0.9"/>
          <polygon points="24,10 32,16 29,26 19,26 16,16" fill="#1800AD"/>
          <line x1="24" y1="10" x2="16" y2="16" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="24" y1="10" x2="32" y2="16" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="16" y1="16" x2="8"  y2="24" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="32" y1="16" x2="40" y2="24" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="19" y1="26" x2="14" y2="36" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="29" y1="26" x2="34" y2="36" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
          <text x="52" y="33" fontFamily="Inter,sans-serif" fontSize="26" fontWeight="700" fill="#fff">callr</text>
        </svg>

        {/* Loading dots */}
        <div className="flex gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-[bounce_1.2s_ease-in-out_0s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-[bounce_1.2s_ease-in-out_0.2s_infinite]" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-[bounce_1.2s_ease-in-out_0.4s_infinite]" />
        </div>
      </div>
    </div>
  );
}

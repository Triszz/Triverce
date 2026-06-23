import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10", showText = true }) => {
  return (
    <div className="flex items-center gap-3 select-none">
      <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path 
          d="M 14 32 L 50 48 L 86 32 L 88 36 L 53 52 L 53 88 L 47 88 L 47 52 L 12 36 Z" 
          fill="#3B82F6" 
        />
        
        <path d="M50 12 L86 32 L50 48 L14 32 Z" fill="#031140" />

        <path d="M12 36 L47 52 L47 88 L12 68 Z" fill="#031140" />

        <path d="M88 36 L53 52 L53 88 L88 68 Z" fill="#031140" />
      </svg>

      {showText && (
        <span className="text-3xl font-extrabold tracking-tight">
          <span style={{ color: '#031140' }}>Tri</span>
          <span className="text-blue-500">verce</span>
        </span>
      )}
    </div>
  );
};
import React from 'react';
import { cn } from '../lib/utils';

interface LogoProps {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
  textClassName?: string;
}

export const Logo: React.FC<LogoProps> = ({ 
  className, 
  imageClassName,
  showText = false,
  textClassName
}) => {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("relative flex items-center justify-center overflow-hidden", imageClassName)}>
        <img 
          src="/logo.png" 
          alt="QuizNova Logo" 
          className="w-full h-full object-contain"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback to a placeholder if logo.png is missing
            const target = e.target as HTMLImageElement;
            target.src = "https://picsum.photos/seed/quiz/200/200";
          }}
        />
      </div>
      {showText && (
        <span className={cn("text-xl font-bold tracking-tight", textClassName)}>
          QuizNova
        </span>
      )}
    </div>
  );
};

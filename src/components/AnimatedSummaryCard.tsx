import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AnimatedSummaryCardProps {
  title: string;
  value: number;
  prefix?: string;
  variant?: 'deduction' | 'reimbursement' | 'neutral';
  showSign?: boolean;
}

function useAnimatedValue(value: number, duration = 400) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const previousValue = useRef(value);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (previousValue.current === value) return;

    setIsAnimating(true);
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
        previousValue.current = endValue;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return { displayValue, isAnimating };
}

export function AnimatedSummaryCard({
  title,
  value,
  prefix = '$',
  variant = 'neutral',
  showSign = true,
}: AnimatedSummaryCardProps) {
  const { displayValue, isAnimating } = useAnimatedValue(value);
  const previousValue = useRef(value);
  const [flash, setFlash] = useState(false);

  // Trigger flash animation when value changes
  useEffect(() => {
    if (previousValue.current !== value) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 300);
      previousValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value]);

  const borderClass = {
    deduction: 'border-red-200 dark:border-red-900',
    reimbursement: 'border-green-200 dark:border-green-900',
    neutral: '',
  }[variant];

  const titleClass = {
    deduction: 'text-red-700 dark:text-red-400',
    reimbursement: 'text-green-700 dark:text-green-400',
    neutral: 'text-muted-foreground',
  }[variant];

  const valueClass = {
    deduction: 'text-red-600 dark:text-red-400',
    reimbursement: 'text-green-600 dark:text-green-400',
    neutral: value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
  }[variant];

  const flashClass = {
    deduction: 'ring-2 ring-red-400/50',
    reimbursement: 'ring-2 ring-green-400/50',
    neutral: value >= 0 ? 'ring-2 ring-green-400/50' : 'ring-2 ring-red-400/50',
  }[variant];

  const getSign = () => {
    if (!showSign) return '';
    if (variant === 'deduction') return '−';
    if (variant === 'reimbursement') return '+';
    return value >= 0 ? '+' : '−';
  };

  const formattedValue = Math.abs(displayValue).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <Card
      className={cn(
        borderClass,
        'transition-all duration-300',
        flash && flashClass,
        isAnimating && 'scale-[1.02]'
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className={cn('text-sm font-medium', titleClass)}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            'text-2xl font-bold tabular-nums transition-transform duration-200',
            valueClass,
            isAnimating && 'scale-105'
          )}
        >
          {getSign()}{prefix}{formattedValue}
        </div>
      </CardContent>
    </Card>
  );
}

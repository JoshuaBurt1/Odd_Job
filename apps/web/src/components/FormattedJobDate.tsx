// web/src/components/FormattedJobDate.tsx
"use client";
import { parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

interface Props {
  date: string;
  timezone: string;
  label?: string;
  className?: string;
  formatStr?: string;
}

export default function FormattedJobDate({ 
  date, 
  timezone, 
  label, 
  className,
  formatStr = "MMM d, h:mm a zzz" 
}: Props) {
  if (!date) return null;

  try {
    const dateObj = parseISO(date);
    const formatted = formatInTimeZone(dateObj, timezone || 'UTC', formatStr);

    return (
      <div className={className}>
        {label && <span className="text-zinc-400 mr-1">{label}</span>}
        <span>{formatted}</span>
      </div>
    );
  } catch (error) {
    return <span className="text-red-500 text-[9px]">Invalid Date</span>;
  }
}
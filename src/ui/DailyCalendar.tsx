import { useState } from 'react';
import { utcDateKey } from '../engine';

interface DailyCalendarProps {
  completedKeys: Set<string>;
  onPick: (date: Date) => void;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function DailyCalendar({ completedKeys, onPick }: DailyCalendarProps) {
  const today = new Date();
  const todayKey = utcDateKey(today);
  const todayYear = today.getUTCFullYear();
  const todayMonth = today.getUTCMonth();

  const [view, setView] = useState({ year: todayYear, month: todayMonth });

  const firstWeekday = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();

  const isCurrentMonth = view.year === todayYear && view.month === todayMonth;

  const prevMonth = () =>
    setView((v) =>
      v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 },
    );
  const nextMonth = () =>
    setView((v) =>
      v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 },
    );

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="calendar">
      <div className="calendar__header">
        <button className="btn btn--ghost calendar__nav" onClick={prevMonth} aria-label="Previous month">
          ‹
        </button>
        <span className="calendar__title">
          {MONTHS[view.month]} {view.year}
        </span>
        <button
          className="btn btn--ghost calendar__nav"
          onClick={nextMonth}
          disabled={isCurrentMonth}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="calendar__grid">
        {WEEKDAYS.map((w, i) => (
          <span key={`wd${i}`} className="calendar__weekday">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} className="calendar__cell calendar__cell--empty" />;
          const mm = String(view.month + 1).padStart(2, '0');
          const dd = String(day).padStart(2, '0');
          const key = `${view.year}-${mm}-${dd}`;
          const isFuture = key > todayKey;
          const isToday = key === todayKey;
          const done = completedKeys.has(key);
          return (
            <button
              key={key}
              className={[
                'calendar__cell',
                done ? 'calendar__cell--done' : '',
                isToday ? 'calendar__cell--today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={isFuture}
              onClick={() => onPick(new Date(Date.UTC(view.year, view.month, day)))}
              aria-label={`${key}${done ? ', completed' : ''}`}
            >
              {day}
              {done && <span className="calendar__check" aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

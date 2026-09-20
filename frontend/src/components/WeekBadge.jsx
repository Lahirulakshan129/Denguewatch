import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { formatWeekDetailed, formatWeekRange, getIsoWeekRange } from '../utils/dateUtils';

export default function WeekBadge({ 
  week, 
  year, 
  showYear = true, 
  compact = false,
  prefix = 'W',
  className = '',
  style = {}
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const w = parseInt(week, 10);
  const y = parseInt(year, 10);

  // Close on outside click for mobile
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  if (!w) return <span>—</span>;

  const weekStr = `${prefix}${String(w).padStart(2, '0')}`;
  const displayLabel = showYear && y ? `${weekStr} ${y}` : weekStr;
  const detailedDates = formatWeekDetailed(w, y);
  const rangeSummary = formatWeekRange(w, y);

  return (
    <span
      ref={containerRef}
      className={`week-badge-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        verticalAlign: 'middle',
        ...style
      }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsOpen(prev => !prev);
      }}
      aria-label={`Week ${w}, ${y}: ${detailedDates}`}
    >
      <span
        className="tag"
        style={{
          cursor: 'pointer',
          userSelect: 'none',
          gap: 4,
          padding: compact ? '1px 6px' : '2px 8px',
          fontSize: compact ? '11px' : '12px',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: 'var(--text-primary, #e2e8f0)',
          borderRadius: '6px',
          transition: 'all 0.15s ease-in-out',
          boxShadow: isOpen ? '0 0 0 1px var(--accent, #3b82f6)' : 'none',
        }}
      >
        <Calendar size={compact ? 10 : 11} style={{ opacity: 0.65 }} />
        <span>{displayLabel}</span>
      </span>

      {/* Floating Info Pill */}
      {isOpen && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            minWidth: '200px',
            padding: '7px 10px',
            background: 'rgba(18, 20, 29, 0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.4)',
            color: '#f8fafc',
            fontSize: '11px',
            lineHeight: 1.35,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            textAlign: 'center',
            animation: 'fadeInScale 0.15s ease-out forwards',
          }}
        >
          <div style={{ fontWeight: 600, color: '#60a5fa', marginBottom: 2 }}>
            🗓️ {detailedDates}
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8' }}>
            ISO Week {w} {y ? `· ${y}` : ''} (Starts Monday)
          </div>
          {/* Subtle triangle arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              borderWidth: '5px 5px 0 5px',
              borderStyle: 'solid',
              borderColor: 'rgba(18, 20, 29, 0.96) transparent transparent transparent',
            }}
          />
        </div>
      )}
    </span>
  );
}

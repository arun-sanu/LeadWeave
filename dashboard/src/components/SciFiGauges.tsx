import { useEffect, useState, useMemo } from 'react';
import { Lock, Send, Users, Timer } from 'lucide-react';
import './SciFiGauges.css';

interface SciFiGaugesProps {
  messagesSentToday?: number;
  dailyMessageLimit?: number;
  usersReachedToday?: number;
  dailyUserLimit?: number;
  currentMsgsPerMin?: number;
  maxMessagesPerMinute?: number;
  isRateLocked?: boolean;
  lockCountdown?: number;
  totalLockDuration?: number;
}

export function SciFiGauges({
  messagesSentToday = 0,
  dailyMessageLimit = 5000,
  usersReachedToday = 0,
  dailyUserLimit = 2500,
  currentMsgsPerMin = 0,
  maxMessagesPerMinute = 30,
  isRateLocked = false,
  lockCountdown = 0,
  totalLockDuration = 45,
}: SciFiGaugesProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Safe percentages
  const pctMsg = Math.min(100, Math.max(0, (messagesSentToday / Math.max(1, dailyMessageLimit)) * 100)) || 0;
  const pctAud = Math.min(100, Math.max(0, (usersReachedToday / Math.max(1, dailyUserLimit)) * 100)) || 0;

  // Rate or Cooldown percentage
  let pctRate = Math.min(100, Math.max(0, (currentMsgsPerMin / Math.max(1, maxMessagesPerMinute)) * 100)) || 0;
  if (isRateLocked && totalLockDuration > 0) {
    pctRate = Math.min(100, Math.max(0, ((totalLockDuration - lockCountdown) / totalLockDuration) * 100));
  }

  const dPctMsg = mounted ? pctMsg : 0;
  const dPctAud = mounted ? pctAud : 0;
  const dPctRate = mounted ? pctRate : 0;

  const overallScore = Math.round((pctMsg + pctAud + pctRate) / 3);

  // SVG Geometry
  const size = 190;
  const cx = size / 2;
  const cy = size / 2;
  const strokeWidth = 10;
  const gap = 3;

  const radius1 = 58; // Outer
  const radius2 = radius1 - strokeWidth - gap; // Middle
  const radius3 = radius2 - strokeWidth - gap; // Inner
  const radiusOuter = radius1 + strokeWidth + gap; // Outer faint ring

  const circ1 = 2 * Math.PI * radius1;
  const circ2 = 2 * Math.PI * radius2;
  const circ3 = 2 * Math.PI * radius3;

  const offset1 = circ1 - (dPctMsg / 100) * circ1;
  const offset2 = circ2 - (dPctAud / 100) * circ2;
  const offset3 = circ3 - (dPctRate / 100) * circ3;

  // Colors
  const color1 = '#38bdf8'; // Cyan (Messages)
  const color2 = '#25d366'; // Green (Audience)
  const color3 = isRateLocked ? '#ef4444' : '#f59e0b'; // Amber/Red (Rate)

  const formatNumber = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  const outerRingTicks = useMemo(() => {
    return Array.from({ length: 21 }).map((_, i) => {
      const val = i * 5; // 0, 5, 10 ... 100
      const angle = -Math.PI / 2 + (val / 100) * 2 * Math.PI;
      const isMajor = val % 10 === 0;

      const tickOuter = radiusOuter;
      const tickInner = radiusOuter - (isMajor ? 4 : 2);

      let tickColor = 'rgba(255, 255, 255, 0.3)';

      if (val >= 80) {
        tickColor = 'rgba(239, 68, 68, 0.7)'; // Tailwind red-500
      } else if (val >= 60) {
        tickColor = 'rgba(245, 158, 11, 0.7)'; // Tailwind amber-500
      }

      return (
        <g key={val}>
          <line
            x1={cx + tickInner * Math.cos(angle)}
            y1={cy + tickInner * Math.sin(angle)}
            x2={cx + tickOuter * Math.cos(angle)}
            y2={cy + tickOuter * Math.sin(angle)}
            stroke={tickColor}
            strokeWidth={isMajor ? 2 : 1}
          />
        </g>
      );
    });
  }, [cx, cy, radiusOuter]);

  const timelineBars = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => (
      <div
        key={i}
        className="ar-time-bar"
        style={{
          height: i % 6 === 0 ? '12px' : '6px',
          background: i > 12 && i < 18 ? color3 : i > 6 && i < 12 ? color2 : 'rgba(255,255,255,0.2)',
        }}
      />
    ));
  }, [color2, color3]);

  return (
    <div className="activity-rings-container">
      {/* LEFT PANEL - GAUGE */}
      <div className="ar-left-panel">
        <div className="ar-header">
          <span className="ar-title">OVERALL SCORE</span>
        </div>

        <div className="ar-svg-wrapper">
          <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="ar-svg">
            <defs>
              <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>
              <linearGradient id="grad2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <linearGradient id="grad3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={isRateLocked ? '#b91c1c' : '#d97706'} />
                <stop offset="100%" stopColor={isRateLocked ? '#ef4444' : '#f59e0b'} />
              </linearGradient>
            </defs>

            {/* Background Tracks */}
            <circle
              cx={cx}
              cy={cy}
              r={radiusOuter}
              fill="none"
              stroke="rgba(255, 255, 255, 0.03)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <circle
              cx={cx}
              cy={cy}
              r={radius1}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={cx}
              cy={cy}
              r={radius2}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx={cx}
              cy={cy}
              r={radius3}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth={strokeWidth}
            />

            {/* Outer Ring Speedometer Scale */}
            {outerRingTicks}

            {/* Active Rings (rotated -90deg so they start at 12 o'clock) */}
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              <circle
                cx={cx}
                cy={cy}
                r={radius1}
                fill="none"
                stroke="url(#grad1)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circ1}
                strokeDashoffset={offset1}
                className="ar-animated-ring"
              />
              <circle
                cx={cx}
                cy={cy}
                r={radius2}
                fill="none"
                stroke="url(#grad2)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circ2}
                strokeDashoffset={offset2}
                className="ar-animated-ring"
              />
              <circle
                cx={cx}
                cy={cy}
                r={radius3}
                fill="none"
                stroke="url(#grad3)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circ3}
                strokeDashoffset={offset3}
                className="ar-animated-ring"
              />
            </g>
          </svg>
          <div className="ar-center-score">
            <span>{mounted ? overallScore : 0}</span>
          </div>
        </div>

        {/* Timeline dots graphic at bottom (decorative) */}
        <div className="ar-timeline">
          <div className="ar-timeline-bars">{timelineBars}</div>
          <div className="ar-timeline-labels">
            <span>12</span>
            <span>6</span>
            <span>12</span>
            <span>6</span>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - STAT CARDS */}
      <div className="ar-right-panel">
        {/* Card 1: Messages */}
        <div className="ar-stat-card">
          <div className="ar-stat-header">
            <div className="ar-stat-title-group">
              <div className="ar-icon-box" style={{ color: color1 }}>
                <Send size={14} />
              </div>
              <span className="ar-stat-title">MESSAGES</span>
            </div>
          </div>
          <div className="ar-stat-value-group">
            <span className="ar-stat-value">{messagesSentToday.toLocaleString()}</span>
            <span className="ar-stat-unit">/ {formatNumber(dailyMessageLimit)} msg</span>
          </div>
        </div>

        {/* Card 2: Audience */}
        <div className="ar-stat-card">
          <div className="ar-stat-header">
            <div className="ar-stat-title-group">
              <div className="ar-icon-box" style={{ color: color2 }}>
                <Users size={14} />
              </div>
              <span className="ar-stat-title">AUDIENCE</span>
            </div>
          </div>
          <div className="ar-stat-value-group">
            <span className="ar-stat-value">{usersReachedToday.toLocaleString()}</span>
            <span className="ar-stat-unit">/ {formatNumber(dailyUserLimit)} leads</span>
          </div>
        </div>

        {/* Card 3: Rate */}
        <div className="ar-stat-card">
          <div className="ar-stat-header">
            <div className="ar-stat-title-group">
              <div className="ar-icon-box" style={{ color: color3 }}>
                {isRateLocked ? <Lock size={14} /> : <Timer size={14} />}
              </div>
              <span className="ar-stat-title">{isRateLocked ? 'COOLDOWN' : 'SEND RATE'}</span>
            </div>
          </div>
          <div className="ar-stat-value-group">
            {isRateLocked ? (
              <>
                <span className="ar-stat-value" style={{ color: color3 }}>
                  {lockCountdown}
                </span>
                <span className="ar-stat-unit" style={{ color: color3 }}>
                  sec
                </span>
              </>
            ) : (
              <>
                <span className="ar-stat-value">{currentMsgsPerMin}</span>
                <span className="ar-stat-unit">msg / min</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

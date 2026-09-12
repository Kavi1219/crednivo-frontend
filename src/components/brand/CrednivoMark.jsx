import { useId } from 'react';
import './CrednivoMark.css';

export default function CrednivoMark({ className = '', size = 48, title = 'CREDNIVO' }) {
  const uid = useId().replace(/:/g, '');
  const goldId = `crednivoGold-${uid}`;
  const goldLightId = `crednivoGoldLight-${uid}`;

  return (
    <span
      className={`crednivo-final-mark ${className}`.trim()}
      style={{ '--crednivo-mark-size': `${size}px` }}
      role="img"
      aria-label={title}
    >
      <svg viewBox="0 0 360 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4dfaa" />
            <stop offset="23%" stopColor="#d9b86b" />
            <stop offset="52%" stopColor="#9b6a22" />
            <stop offset="76%" stopColor="#d6ad58" />
            <stop offset="100%" stopColor="#f0d695" />
          </linearGradient>
          <linearGradient id={goldLightId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8e6b9" />
            <stop offset="45%" stopColor="#c99a43" />
            <stop offset="100%" stopColor="#8b5a1c" />
          </linearGradient>
        </defs>

        <g transform="rotate(-7 150 158) translate(-8 4)">
          <path
            d="M258 69 C226 39 184 26 143 32 C86 40 46 85 42 143 C37 204 75 255 131 273 C178 288 228 272 258 237"
            fill="none"
            stroke={`url(#${goldId})`}
            strokeWidth="43"
            strokeLinejoin="round"
          />
          <path
            d="M251 67 C221 43 183 34 147 39 C96 46 61 87 58 140"
            fill="none"
            stroke="#f8e6b7"
            strokeOpacity=".72"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M62 210 C78 242 107 264 141 273 C183 284 225 270 251 241"
            fill="none"
            stroke="#704616"
            strokeOpacity=".58"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>

        <g>
          <rect x="104" y="204" width="24" height="54" rx="4" fill={`url(#${goldLightId})`} />
          <rect x="141" y="175" width="25" height="83" rx="4" fill={`url(#${goldLightId})`} />
          <rect x="179" y="140" width="26" height="118" rx="4" fill={`url(#${goldLightId})`} />
        </g>

        <path
          d="M112 230 C143 214 173 193 198 169 C222 146 245 118 266 88 L256 82 L290 72 L288 107 L278 99 C254 131 231 158 206 181 C180 205 150 226 118 241 Z"
          fill={`url(#${goldId})`}
          stroke="#ecd49a"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M119 229 C148 214 176 194 200 172 C224 150 245 124 264 97"
          fill="none"
          stroke="#f8e6ba"
          strokeOpacity=".62"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

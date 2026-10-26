import {useId} from 'react'

/**
 * Embroidered merit patch with the backpack raccoon's face, ported from the user's own my-blog
 * (src/components/forest/Patch.tsx and RaccoonMark.tsx): merrow-whipped rim, twill ground, running-stitch inner ring.
 */
export function RaccoonPatch({arc,className}:{arc:string;className?:string}){
 const id=useId().replace(/:/g,'')
 return <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
  <defs>
   <pattern id={`w${id}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="4" height="4" fill="#28453a"/><rect width="1" height="4" fill="#2f4f43"/>
   </pattern>
   <path id={`a${id}`} d="M 18 50 A 32 32 0 0 1 82 50"/>
  </defs>
  <circle cx="50" cy="50" r="48" fill="#8a5b3d"/>
  <circle cx="50" cy="50" r="46.2" fill="none" stroke="#e7d8b9" strokeOpacity=".38" strokeWidth="3.6" strokeDasharray=".9 1.3"/>
  <circle cx="50" cy="50" r="43.4" fill={`url(#w${id})`}/>
  <circle cx="50" cy="50" r="39.5" fill="none" stroke="#e7d8b9" strokeOpacity=".7" strokeWidth="1.1" strokeDasharray="3 2.2"/>
  {/* The HUD face is wider than my-blog's condensed patch lettering: fit the arc by spacing rather than letting it clip. */}
  <text fill="#e7d8b9" fontWeight="700" fontSize="8.6"><textPath href={`#a${id}`} startOffset="50%" textAnchor="middle" textLength="90" lengthAdjust="spacing">{arc}</textPath></text>
  <g transform="translate(26 34) scale(.75)">
   <path d="M13 27 L15.5 10.5 Q16.6 7.4 19.6 9 L29 19.5 Z" fill="#7d7a6e"/>
   <path d="M51 27 L48.5 10.5 Q47.4 7.4 44.4 9 L35 19.5 Z" fill="#7d7a6e"/>
   <path d="M17 22 L18.4 13.6 L25 19.8 Z" fill="#e7d8b9"/>
   <path d="M47 22 L45.6 13.6 L39 19.8 Z" fill="#e7d8b9"/>
   <path d="M8 38 Q8 19 32 18 Q56 19 56 38 Q55 54 32 56 Q9 54 8 38 Z" fill="#7d7a6e"/>
   <path d="M8.5 40 L4 44 L11 45 L8 49 L15 48.5 Q11 45 8.5 40 Z" fill="#7d7a6e"/>
   <path d="M55.5 40 L60 44 L53 45 L56 49 L49 48.5 Q53 45 55.5 40 Z" fill="#7d7a6e"/>
   <path d="M13 37 Q15 26 32 25 Q49 26 51 37 Q50 51 32 53 Q14 51 13 37 Z" fill="#e7d8b9"/>
   <path d="M29.6 19 Q32 17.6 34.4 19 L33.4 32 L30.6 32 Z" fill="#4a3228"/>
   <path d="M10.5 36 Q16 28.5 25 31 Q30 32.5 32 35.5 Q34 32.5 39 31 Q48 28.5 53.5 36 Q52 43.5 44 43 Q37 42.5 32 39.5 Q27 42.5 20 43 Q12 43.5 10.5 36 Z" fill="#4a3228"/>
   <circle cx="23" cy="36.4" r="2.7" fill="#1c1510"/><circle cx="41" cy="36.4" r="2.7" fill="#1c1510"/>
   <circle cx="23.9" cy="35.4" r=".9" fill="#e7d8b9"/><circle cx="41.9" cy="35.4" r=".9" fill="#e7d8b9"/>
   <ellipse cx="32" cy="45.6" rx="3.4" ry="2.3" fill="#1c1510"/>
   <path d="M32 47.6 L32 49.6 M32 49.6 Q29.8 51.2 28.2 49.8 M32 49.6 Q34.2 51.2 35.8 49.8" stroke="#4a3228" strokeWidth="1.1" strokeLinecap="round" fill="none"/>
  </g>
 </svg>
}

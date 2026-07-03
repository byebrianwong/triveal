/**
 * The star host (placeholder art, final character TBD). Expressions map to
 * game beats: curious -> playing, wince -> wrong guess, encourage -> late
 * clues, cheer -> win, sad -> loss.
 */

export type StarExpression = "curious" | "wince" | "encourage" | "cheer" | "sad";

const FACES: Record<StarExpression, React.ReactNode> = {
  curious: (
    <>
      <circle cx="43" cy="45" r="4" fill="#3a2440" />
      <circle cx="57" cy="45" r="4" fill="#3a2440" />
      <circle cx="35" cy="51" r="3" fill="#ff9ecb" opacity=".55" />
      <circle cx="65" cy="51" r="3" fill="#ff9ecb" opacity=".55" />
      <path d="M45 53 Q50 58 55 53" stroke="#3a2440" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </>
  ),
  wince: (
    <>
      <circle cx="43" cy="46" r="4" fill="#3a2440" />
      <circle cx="57" cy="46" r="4" fill="#3a2440" />
      <path d="M46 57 Q50 53 54 57" stroke="#3a2440" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M67 39 q3 5 0 7 q-3 -2 0 -7z" fill="#9ad8ff" />
    </>
  ),
  encourage: (
    <>
      <circle cx="43" cy="45" r="4" fill="#3a2440" />
      <circle cx="57" cy="45" r="4" fill="#3a2440" />
      <circle cx="34" cy="51" r="3.2" fill="#ff9ecb" opacity=".7" />
      <circle cx="66" cy="51" r="3.2" fill="#ff9ecb" opacity=".7" />
      <path d="M43 52 Q50 60 57 52" stroke="#3a2440" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    </>
  ),
  cheer: (
    <>
      <path d="M39 45 Q43 40 47 45" stroke="#3a2440" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M53 45 Q57 40 61 45" stroke="#3a2440" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M44 50 Q50 59 56 50 Z" fill="#3a2440" />
      <circle cx="33" cy="52" r="3.4" fill="#ff9ecb" opacity=".75" />
      <circle cx="67" cy="52" r="3.4" fill="#ff9ecb" opacity=".75" />
    </>
  ),
  sad: (
    <>
      <circle cx="43" cy="46" r="3.8" fill="#3a2440" />
      <circle cx="57" cy="46" r="3.8" fill="#3a2440" />
      <path d="M62 50 q2 4 0 7" stroke="#9ad8ff" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M45 58 Q50 54 55 58" stroke="#3a2440" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </>
  ),
};

export function StarHost({
  expression,
  size = 54,
}: {
  expression: StarExpression;
  size?: number;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path
        d="M50 8 l11 24 26 3 -19 18 5 26 -23 -13 -23 13 5 -26 -19 -18 26 -3z"
        fill="#ffd66e"
        stroke="#f6dd9b"
        strokeWidth="1.5"
      />
      {FACES[expression]}
      <path d="M50 83 l-10 -5 v10 z" fill="#e8b94a" />
      <path d="M50 83 l10 -5 v10 z" fill="#e8b94a" />
      <circle cx="50" cy="83" r="3" fill="#c8993a" />
    </svg>
  );
}

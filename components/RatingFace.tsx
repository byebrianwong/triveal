import type { RatingValue } from "@/lib/ratings/types";

/**
 * The bad / okay / good symbol. Drawn inline rather than pulled from an icon
 * font because the app ships none, and shared by the rating control and the
 * review page so both speak the same three faces.
 *
 * Not a client component: it's plain markup, so the server-rendered review
 * page can use it too.
 */
export function RatingFace({ kind, size = 24 }: { kind: RatingValue; size?: number }) {
  const mouth =
    kind === "bad"
      ? "M8.2 16.6 Q12 13 15.8 16.6"
      : kind === "good"
        ? "M8.2 14 Q12 18.6 15.8 14"
        : "M8.6 15.4 H15.4";
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9.3" />
      <circle cx="9" cy="10" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="10" r="1.15" fill="currentColor" stroke="none" />
      <path d={mouth} />
    </svg>
  );
}

/** Face colours, shared so a "good" is the same gold everywhere it appears. */
export const RATING_COLOR: Record<RatingValue, string> = {
  bad: "text-pink-lt",
  okay: "text-lav-lt",
  good: "text-gold-lt",
};

export const RATING_LABEL: Record<RatingValue, string> = {
  bad: "Bad question",
  okay: "Okay question",
  good: "Good question",
};

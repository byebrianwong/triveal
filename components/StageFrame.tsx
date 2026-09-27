/**
 * Small stars scattered over the open background on desktop. Positions are in
 * percent of the window so they spread out on any screen size. Phones don't
 * get these: there, the game fills the screen and the header has its own two.
 */
const DESKTOP_STARS = [
  { left: "7%", top: "22%", size: 10, color: "text-[#cdb9ff]", delay: "0s" },
  { left: "13%", top: "74%", size: 8, color: "text-pink-lt", delay: "1.4s" },
  { left: "24%", top: "40%", size: 7, color: "text-gold-lt", delay: "0.6s" },
  { left: "79%", top: "30%", size: 9, color: "text-gold-lt", delay: "2s" },
  { left: "91%", top: "58%", size: 11, color: "text-[#cdb9ff]", delay: "0.3s" },
  { left: "84%", top: "86%", size: 8, color: "text-pink-lt", delay: "1.1s" },
];

/**
 * The full-window background every screen sits on. The home page wraps the
 * game in it, and the Storybook screen stories use the same frame so their
 * snapshots match what players see.
 */
export function StageFrame({ children }: { children: React.ReactNode }) {
  return (
    // The background fills the whole window at every size. The game sits
    // straight on it rather than inside a bordered card, so the browser
    // window is the only frame.
    <div className="stage relative flex h-dvh w-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
        {DESKTOP_STARS.map((s) => (
          <span
            key={`${s.left}-${s.top}`}
            className={`twinkle absolute ${s.color}`}
            style={{ left: s.left, top: s.top, fontSize: s.size, animationDelay: s.delay }}
          >
            ✦
          </span>
        ))}
      </div>
      {/* Below desktop width the game keeps a phone-width column. */}
      <div className="relative mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col lg:max-w-none">
        {children}
      </div>
    </div>
  );
}

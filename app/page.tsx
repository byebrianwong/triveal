import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <div className="flex flex-1 items-stretch justify-center sm:items-center sm:py-6 lg:px-6">
      {/*
        The card takes whatever height the window offers (minus the sm:py-6
        gutters) up to a cap, rather than a fixed height — so a tall desktop
        window shows the whole result panel instead of scrolling it inside a
        short box, and a short window shrinks to fit instead of overflowing.
      */}
      <div className="stage relative flex h-dvh w-full max-w-[420px] flex-col overflow-hidden sm:h-[calc(100dvh-3rem)] sm:max-h-[700px] sm:rounded-[26px] sm:border sm:border-[#3a3168] lg:max-h-[900px] lg:max-w-[960px]">
        <HomeClient />
      </div>
    </div>
  );
}

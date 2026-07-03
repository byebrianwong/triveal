import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <div className="flex flex-1 items-stretch justify-center sm:items-center sm:py-6">
      <div className="stage relative flex h-dvh w-full max-w-[420px] flex-col overflow-hidden sm:h-[700px] sm:rounded-[26px] sm:border sm:border-[#3a3168]">
        <HomeClient />
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchAnswerInfo } from "@/app/actions";
import type { AnswerInfo as AnswerInfoData } from "@/lib/questions/answerInfo";

/** Wikipedia text is CC BY-SA 4.0: reusing a summary means linking the license. */
const TEXT_LICENSE_URL = "https://creativecommons.org/licenses/by-sa/4.0/";

const linkFocus =
  "rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";

/**
 * What to know about a revealed answer: its picture (a salt shaker for
 * "Salt") and the opening lines of its Wikipedia article. Fetched after the
 * reveal so the result panel never waits on Wikipedia, and renders nothing at
 * all when Wikipedia has neither, so every caller can drop it in
 * unconditionally.
 */
export function AnswerInfo({ questionId }: { questionId: string }) {
  // Keyed by question so a party round that advances in place never shows the
  // previous answer's info while the next one loads.
  const [loaded, setLoaded] = useState<{ questionId: string; info: AnswerInfoData | null } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    fetchAnswerInfo(questionId)
      .then((info) => {
        if (active) setLoaded({ questionId, info });
      })
      .catch(() => {
        // nothing to show is a fine outcome — the answer text stands on its own
      });
    return () => {
      active = false;
    };
  }, [questionId]);

  const info = loaded?.questionId === questionId ? loaded.info : null;
  if (!info) return null;
  const { image, summary, pageUrl } = info;

  return (
    <div className="clue-enter mt-2.5">
      {image && (
        <figure>
          <a
            href={pageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              sizes="(max-width: 640px) 80vw, 400px"
              className="mx-auto h-auto max-h-[168px] w-auto max-w-full rounded-xl border border-purple-line lg:max-h-[220px]"
            />
          </a>
          <figcaption className="mt-1.5 text-balance text-[10px] leading-snug text-lav-dim lg:text-[11.5px]">
            <a
              href={image.creditUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`hover:text-lav ${linkFocus}`}
            >
              {image.credit}
            </a>
          </figcaption>
        </figure>
      )}

      {summary && (
        <p className="mt-3 text-pretty text-[13px] leading-relaxed text-lav-lt lg:text-[14.5px]">
          {summary}
        </p>
      )}

      <p className="mt-2 text-[11px] text-lav lg:text-[12.5px]">
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`font-medium underline decoration-purple-line underline-offset-2 hover:text-cream ${linkFocus}`}
        >
          Read more on Wikipedia<span className="sr-only"> (opens in a new tab)</span>
        </a>
        {summary && (
          <>
            <span className="text-lav-dim"> · text </span>
            <a
              href={TEXT_LICENSE_URL}
              target="_blank"
              rel="noopener noreferrer license"
              className={`text-lav-dim hover:text-lav ${linkFocus}`}
            >
              CC BY-SA 4.0
            </a>
          </>
        )}
      </p>
    </div>
  );
}

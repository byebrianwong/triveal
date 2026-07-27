"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { fetchAnswerImage } from "@/app/actions";
import type { AnswerImage as AnswerImageData } from "@/lib/questions/answerImage";

/**
 * The picture beside a revealed answer — a salt shaker for "Salt". Fetched
 * after the reveal so the result panel never waits on Wikipedia, and renders
 * nothing at all when the answer has no freely-licensed picture, so every
 * caller can drop it in unconditionally.
 */
export function AnswerImage({ questionId }: { questionId: string }) {
  // Keyed by question so a party round that advances in place never shows the
  // previous answer's picture while the next one loads.
  const [loaded, setLoaded] = useState<{ questionId: string; image: AnswerImageData | null } | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    fetchAnswerImage(questionId)
      .then((image) => {
        if (active) setLoaded({ questionId, image });
      })
      .catch(() => {
        // no picture is a fine outcome — the answer text stands on its own
      });
    return () => {
      active = false;
    };
  }, [questionId]);

  const image = loaded?.questionId === questionId ? loaded.image : null;
  if (!image) return null;

  return (
    <figure className="clue-enter mt-2.5">
      <a
        href={image.pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
      >
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="(max-width: 640px) 80vw, 320px"
          className="mx-auto h-auto max-h-[168px] w-auto max-w-full rounded-xl border border-purple-line"
        />
      </a>
      <figcaption className="mt-1.5 text-[10px] leading-tight text-lav-dim">
        <a
          href={image.creditUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded hover:text-lav focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          {image.credit}
        </a>
      </figcaption>
    </figure>
  );
}

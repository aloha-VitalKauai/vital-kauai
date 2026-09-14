"use client";

import { useEffect, useRef } from "react";

// Client component so React applies `muted` on the client and the browser
// allows autoplay. A server-rendered <video muted> drops the muted attribute
// from the HTML, which makes browsers block autoplay. We also force-mute and
// call play() defensively, and loop the first 5 seconds to match the marketing
// homepage hero.
//
// Some phones refuse autoplay outright (iOS Low Power Mode, data saver) and
// show the first frame instead. The first touch or click anywhere on the page
// retries play(), which those devices allow once the person has interacted.
export function HeroVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
    const onTime = () => {
      if (v.currentTime >= 5) {
        v.currentTime = 0;
      }
    };
    v.addEventListener("timeupdate", onTime);

    const retry = () => {
      if (v.paused) v.play().catch(() => {});
    };
    const opts: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("touchstart", retry, opts);
    window.addEventListener("click", retry, opts);

    return () => {
      v.removeEventListener("timeupdate", onTime);
      window.removeEventListener("touchstart", retry);
      window.removeEventListener("click", retry);
    };
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
    >
      <source src="/videos/hero-loop.webm" type="video/webm" />
      <source src="/videos/hero-loop.mp4" type="video/mp4" />
    </video>
  );
}

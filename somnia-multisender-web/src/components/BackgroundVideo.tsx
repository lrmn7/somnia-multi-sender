import React, { useEffect, useRef } from "react";

export const BackgroundVideo: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.defaultMuted = true;
      video.muted = true;
      video.play().catch(() => {
        // Browser autoplay policy fallback
      });
    }
  }, []);

  return (
    <>
      {/* Background Video Layer */}
      <video
        ref={videoRef}
        className="fixed-bg-video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      >
        <source src="/bg.mp4" type="video/mp4" />
      </video>

      {/* Dark Readability Overlay Layer */}
      <div className="fixed-dark-overlay" aria-hidden="true" />
    </>
  );
};

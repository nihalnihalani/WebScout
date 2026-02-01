import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from "remotion";
import { colors, fonts, springs } from "../styles";

const sponsors = [
  { name: "Weave", logo: "logos/weave.svg" },
  { name: "Browserbase", logo: "logos/browserbase.svg" },
  { name: "Redis", logo: "logos/redis.svg" },
  { name: "Gemini", logo: "logos/gemini.svg" },
  { name: "Vercel", logo: "logos/vercel.svg" },
];

export const SponsorStackScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [100, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title
  const titleProgress = spring({
    frame: Math.max(0, frame - 15),
    fps,
    config: springs.gentle,
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        opacity: Math.min(entryOpacity, exitOpacity),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 260,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleProgress,
          transform: `translateY(${interpolate(titleProgress, [0, 1], [20, 0])}px)`,
        }}
      >
        <p
          style={{
            fontSize: 48,
            fontFamily: fonts.heading,
            fontWeight: 500,
            color: colors.gray,
            margin: 0,
            letterSpacing: -1,
          }}
        >
          Built With
        </p>
      </div>

      {/* Logo row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 100,
          marginTop: 60,
        }}
      >
        {sponsors.map((s, i) => {
          const delay = 40 + i * 6;
          const logoProgress = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: springs.snappy,
          });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 20,
                opacity: logoProgress * 0.9,
                transform: `translateY(${interpolate(logoProgress, [0, 1], [10, 0])}px)`,
              }}
            >
              <Img
                src={staticFile(s.logo)}
                style={{
                  height: 80,
                  width: "auto",
                  objectFit: "contain",
                }}
              />
              <span
                style={{
                  fontSize: 20,
                  fontFamily: fonts.mono,
                  color: colors.mid,
                  letterSpacing: 1,
                }}
              >
                {s.name}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

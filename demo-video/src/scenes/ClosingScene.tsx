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

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entry
  const entryOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Logo — quick reveal
  const logoProgress = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: springs.snappy,
  });

  // "Built for" text
  const builtProgress = spring({
    frame: Math.max(0, frame - 18),
    fps,
    config: springs.standard,
  });

  // Sponsor logos
  const sponsorStart = 28;

  // "Demo Begins" — dramatic entrance
  const demoProgress = spring({
    frame: Math.max(0, frame - 55),
    fps,
    config: springs.dramatic,
  });
  const demoBlur = interpolate(demoProgress, [0, 1], [8, 0]);

  // Exit — hold then fade
  const exitOpacity = interpolate(frame, [85, 105], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
      {/* Logo */}
      <h1
        style={{
          fontSize: 110,
          fontWeight: 700,
          fontFamily: fonts.heading,
          margin: 0,
          letterSpacing: -4,
          opacity: logoProgress,
          transform: `translateY(${interpolate(logoProgress, [0, 1], [15, 0])}px)`,
          color: colors.white,
        }}
      >
        Web<span style={{ color: colors.accent }}>Scout</span>
      </h1>

      {/* Built for WeaveHacks 3 */}
      <p
        style={{
          fontSize: 28,
          fontFamily: fonts.heading,
          fontWeight: 500,
          color: colors.gray,
          margin: "16px 0 0",
          opacity: builtProgress,
          transform: `translateY(${interpolate(builtProgress, [0, 1], [10, 0])}px)`,
        }}
      >
        Built for{" "}
        <span style={{ color: colors.amber, fontWeight: 600 }}>
          WeaveHacks 3
        </span>
      </p>

      {/* Sponsor logos — compact row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 48,
          marginTop: 32,
        }}
      >
        {sponsors.map((s, i) => {
          const delay = sponsorStart + i * 3;
          const lp = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: springs.snappy,
          });
          return (
            <Img
              key={i}
              src={staticFile(s.logo)}
              style={{
                height: 40,
                width: "auto",
                objectFit: "contain",
                opacity: lp * 0.6,
                transform: `translateY(${interpolate(lp, [0, 1], [6, 0])}px)`,
              }}
            />
          );
        })}
      </div>

      {/* LIVE DEMO BEGINS — dramatic final beat */}
      <div
        style={{
          marginTop: 56,
          opacity: demoProgress,
          filter: `blur(${demoBlur}px)`,
          transform: `translateY(${interpolate(demoProgress, [0, 1], [20, 0])}px)`,
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontSize: 36,
            fontFamily: fonts.mono,
            fontWeight: 700,
            color: colors.accent,
            margin: 0,
            letterSpacing: 10,
            textTransform: "uppercase",
          }}
        >
          Live Demo Begins
        </p>
      </div>
    </AbsoluteFill>
  );
};

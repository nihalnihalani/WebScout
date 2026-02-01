import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { colors, fonts, springs } from "../styles";

export const HeroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title: blur-to-sharp reveal starting frame 20
  const titleProgress = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: springs.dramatic,
  });
  const titleBlur = interpolate(titleProgress, [0, 1], [12, 0]);
  const titleY = interpolate(titleProgress, [0, 1], [30, 0]);

  // Tagline at frame 70
  const tagProgress = spring({
    frame: Math.max(0, frame - 70),
    fps,
    config: springs.gentle,
  });
  const tagY = interpolate(tagProgress, [0, 1], [20, 0]);

  // Subtitle at frame 90
  const subProgress = spring({
    frame: Math.max(0, frame - 90),
    fps,
    config: springs.gentle,
  });

  // Exit fade
  const exitOpacity = interpolate(frame, [130, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Entry fade from black
  const entryOpacity = interpolate(frame, [0, 20], [0, 1], {
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
      {/* Title — plain color, NO background-clip */}
      <h1
        style={{
          fontSize: 140,
          fontWeight: 700,
          fontFamily: fonts.heading,
          margin: 0,
          letterSpacing: -5,
          filter: `blur(${titleBlur}px)`,
          opacity: titleProgress,
          transform: `translateY(${titleY}px)`,
          color: colors.white,
        }}
      >
        Web<span style={{ color: colors.accent }}>Scout</span>
      </h1>

      {/* Tagline */}
      <p
        style={{
          fontSize: 38,
          fontFamily: fonts.heading,
          fontWeight: 400,
          color: colors.gray,
          margin: 0,
          marginTop: 32,
          fontStyle: "italic",
          opacity: tagProgress,
          transform: `translateY(${tagY}px)`,
          letterSpacing: -0.5,
        }}
      >
        Every failed click makes it smarter.
      </p>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 24,
          fontFamily: fonts.mono,
          color: colors.accent,
          margin: 0,
          marginTop: 28,
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: subProgress * 0.8,
        }}
      >
        Self-Improving Browser Automation
      </p>
    </AbsoluteFill>
  );
};

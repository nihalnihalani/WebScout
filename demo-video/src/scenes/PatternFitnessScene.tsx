import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { colors, fonts, springs } from "../styles";

export const PatternFitnessScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [130, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title
  const titleProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: springs.gentle,
  });

  // Wilson formula lines — staggered
  const lines = [
    "p = success_count / total",
    "z = 1.96  (95% confidence)",
    "wilson = (p + z\u00B2/2n \u2212 z\u221A(p(1\u2212p)/n + z\u00B2/4n\u00B2)) / (1 + z\u00B2/n)",
  ];

  // Composite formula
  const compositeProgress = spring({
    frame: Math.max(0, frame - 95),
    fps,
    config: springs.standard,
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
        padding: "108px 192px",
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 140,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: titleProgress,
          transform: `translateY(${interpolate(titleProgress, [0, 1], [30, 0])}px)`,
        }}
      >
        <h2
          style={{
            fontSize: 72,
            fontWeight: 600,
            fontFamily: fonts.heading,
            color: colors.white,
            margin: 0,
            letterSpacing: -2,
          }}
        >
          Wilson Score{" "}
          <span style={{ color: colors.indigo }}>+</span> Time Decay
        </h2>
        <p
          style={{
            fontSize: 28,
            fontFamily: fonts.heading,
            fontWeight: 400,
            color: colors.gray,
            margin: "12px 0 0",
          }}
        >
          The same algorithm Reddit uses to rank comments
        </p>
      </div>

      {/* Formula lines — centered */}
      <div style={{ textAlign: "center", marginTop: 40 }}>
        {lines.map((line, i) => {
          const lineProgress = spring({
            frame: Math.max(0, frame - (40 + i * 12)),
            fps,
            config: springs.standard,
          });
          return (
            <p
              key={i}
              style={{
                fontSize: i === 2 ? 30 : 34,
                fontFamily: fonts.mono,
                color: i === 2 ? colors.indigo : colors.white,
                margin: i === 0 ? 0 : "20px 0 0",
                fontWeight: i === 2 ? 600 : 400,
                opacity: lineProgress,
                transform: `translateY(${interpolate(lineProgress, [0, 1], [20, 0])}px)`,
              }}
            >
              {line}
            </p>
          );
        })}
      </div>

      {/* Composite formula */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: compositeProgress,
          transform: `translateY(${interpolate(compositeProgress, [0, 1], [20, 0])}px)`,
        }}
      >
        <p
          style={{
            fontSize: 36,
            fontFamily: fonts.mono,
            color: colors.white,
            margin: 0,
            fontWeight: 600,
          }}
        >
          composite ={" "}
          <span style={{ color: colors.indigo }}>similarity</span> × 0.6 +{" "}
          <span style={{ color: colors.amber }}>fitness</span> × 0.4
        </p>
      </div>
    </AbsoluteFill>
  );
};

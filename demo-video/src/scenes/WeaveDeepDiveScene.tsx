import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { colors, fonts, springs } from "../styles";

const levels = [
  { num: "1", title: "Traced Ops" },
  { num: "2", title: "Invoke + Call ID" },
  { num: "3", title: "Retrospective Feedback" },
  { num: "4", title: "Pattern Datasets" },
  { num: "5", title: "Inline Screenshots" },
  { num: "6", title: "Formal Evaluation" },
  { num: "7", title: "Context Propagation" },
];

export const WeaveDeepDiveScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [115, 135], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title
  const titleProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: springs.gentle,
  });

  // Bottom tagline
  const tagProgress = spring({
    frame: Math.max(0, frame - 105),
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
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 120,
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
          <span style={{ color: colors.amber }}>Weave</span> at 7 Levels
        </h2>
      </div>

      {/* Clean vertical list — centered */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          marginTop: 30,
        }}
      >
        {levels.map((level, i) => {
          const levelProgress = spring({
            frame: Math.max(0, frame - (30 + i * 7)),
            fps,
            config: springs.standard,
          });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 20,
                opacity: levelProgress,
                transform: `translateY(${interpolate(levelProgress, [0, 1], [15, 0])}px)`,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  fontFamily: fonts.mono,
                  color: colors.amber,
                  fontWeight: 700,
                  width: 32,
                  textAlign: "right",
                  opacity: 0.6,
                }}
              >
                {level.num}
              </span>
              <span
                style={{
                  fontSize: 32,
                  fontFamily: fonts.heading,
                  fontWeight: 500,
                  color: colors.white,
                }}
              >
                {level.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: tagProgress,
          transform: `translateY(${interpolate(tagProgress, [0, 1], [15, 0])}px)`,
        }}
      >
        <p
          style={{
            fontSize: 24,
            fontFamily: fonts.heading,
            fontWeight: 400,
            color: colors.gray,
            margin: 0,
          }}
        >
          The entire feedback loop flows through Weave.
        </p>
      </div>
    </AbsoluteFill>
  );
};

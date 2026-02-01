import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { colors, fonts, springs } from "../styles";

const stages = [
  {
    num: "01",
    title: "Vector Search",
    desc: "KNN against 1536-dim HNSW index in Redis",
    detail: "Every URL gets a vector fingerprint. Similar pages reuse proven patterns.",
  },
  {
    num: "02",
    title: "Cached Pattern Match",
    desc: "High-confidence patterns execute instantly",
    detail: "Wilson Score above threshold? Skip AI entirely — just replay the action.",
  },
  {
    num: "03",
    title: "Gemini Pre-Analysis",
    desc: "DOM snapshot analyzed before extraction",
    detail: "Gemini reads the full page structure to predict the best selectors.",
  },
  {
    num: "04",
    title: "Live Extraction",
    desc: "Browserbase AI operates on the live page",
    detail: "When cached patterns fail, real-time browser automation takes over.",
  },
  {
    num: "05",
    title: "Adaptive Recovery",
    desc: "4 fallback strategies if everything fails",
    detail: "Scroll, retry, alternate selectors, full re-analysis — then learn from it.",
  },
];

export const LearningLoopScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitOpacity = interpolate(frame, [220, 240], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title
  const titleProgress = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: springs.gentle,
  });

  // Subtitle
  const subtitleProgress = spring({
    frame: Math.max(0, frame - 25),
    fps,
    config: springs.gentle,
  });

  // Each stage gets ~34 frames, stagger from frame 45 to frame 215
  const stageFloat = interpolate(frame, [45, 210], [0, 4.99], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress indicator dots
  const activeIdx = Math.floor(stageFloat);

  // Bottom insight
  const insightProgress = spring({
    frame: Math.max(0, frame - 205),
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
          top: 100,
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
          5-Stage Learning Pipeline
        </h2>
        <p
          style={{
            fontSize: 26,
            fontFamily: fonts.heading,
            fontWeight: 400,
            color: colors.gray,
            margin: "14px 0 0",
            opacity: subtitleProgress,
          }}
        >
          Each request flows through every stage — and writes back what it learns
        </p>
      </div>

      {/* Active stage — centered, big */}
      {stages.map((stage, i) => {
        const dist = Math.abs(stageFloat - i);
        const stageOpacity = dist < 1 ? 1 - dist : 0;

        if (stageOpacity <= 0) return null;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: "50%",
              transform: `translateY(-40%)`,
              opacity: stageOpacity,
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 18,
                fontFamily: fonts.mono,
                color: colors.accent,
                margin: 0,
                letterSpacing: 6,
                opacity: 0.5,
              }}
            >
              STAGE {stage.num}
            </p>
            <h3
              style={{
                fontSize: 68,
                fontWeight: 600,
                fontFamily: fonts.heading,
                color: colors.white,
                margin: "14px 0 0",
                letterSpacing: -2,
              }}
            >
              {stage.title}
            </h3>
            <p
              style={{
                fontSize: 30,
                fontFamily: fonts.heading,
                fontWeight: 400,
                color: colors.mid,
                margin: "14px 0 0",
              }}
            >
              {stage.desc}
            </p>
            <p
              style={{
                fontSize: 22,
                fontFamily: fonts.heading,
                fontWeight: 400,
                color: colors.gray,
                margin: "20px auto 0",
                maxWidth: 700,
                lineHeight: 1.5,
              }}
            >
              {stage.detail}
            </p>
          </div>
        );
      })}

      {/* Progress dots */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          left: 0,
          right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        {stages.map((_, i) => {
          const isActive = Math.abs(stageFloat - i) < 0.5;
          const dotOpacity = interpolate(frame, [40, 55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <div
              key={i}
              style={{
                width: isActive ? 32 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: isActive ? colors.accent : colors.gray,
                opacity: dotOpacity * (isActive ? 0.9 : 0.3),
                transition: "width 0.2s",
              }}
            />
          );
        })}
      </div>

      {/* Bottom insight */}
      <div
        style={{
          position: "absolute",
          bottom: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: insightProgress,
          transform: `translateY(${interpolate(insightProgress, [0, 1], [15, 0])}px)`,
        }}
      >
        <p
          style={{
            fontSize: 26,
            fontFamily: fonts.heading,
            fontWeight: 400,
            color: colors.gray,
            margin: 0,
          }}
        >
          Every path writes back. The system cannot run without learning.
        </p>
      </div>
    </AbsoluteFill>
  );
};

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { colors, fonts, springs } from "../styles";

export const AdaptiveSystemScene: React.FC = () => {
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

  // Big number — animated count
  const thresholdValue = interpolate(frame, [45, 85], [0.85, 0.78], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const numberProgress = spring({
    frame: Math.max(0, frame - 40),
    fps,
    config: springs.dramatic,
  });

  // Penalty text
  const penaltyProgress = spring({
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
          Adaptive <span style={{ color: colors.amber }}>Recovery</span>
        </h2>
      </div>

      {/* Big stat number */}
      <div
        style={{
          textAlign: "center",
          opacity: numberProgress,
          transform: `translateY(${interpolate(numberProgress, [0, 1], [30, 0])}px)`,
        }}
      >
        <p
          style={{
            fontSize: 160,
            fontWeight: 700,
            fontFamily: fonts.mono,
            color: colors.white,
            margin: 0,
            lineHeight: 1,
            letterSpacing: -6,
          }}
        >
          {thresholdValue.toFixed(2)}
        </p>
        <p
          style={{
            fontSize: 32,
            fontFamily: fonts.heading,
            fontWeight: 400,
            color: colors.gray,
            margin: "16px 0 0",
          }}
        >
          Dynamic Confidence Threshold
        </p>
      </div>

      {/* Penalty explanation */}
      <div
        style={{
          position: "absolute",
          bottom: 140,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: penaltyProgress,
          transform: `translateY(${interpolate(penaltyProgress, [0, 1], [15, 0])}px)`,
        }}
      >
        <p
          style={{
            fontSize: 28,
            fontFamily: fonts.heading,
            fontWeight: 400,
            color: colors.gray,
            margin: 0,
          }}
        >
          Failures penalize{" "}
          <span style={{ color: colors.amber, fontWeight: 600 }}>4×</span> more
          than successes reward.
        </p>
      </div>
    </AbsoluteFill>
  );
};

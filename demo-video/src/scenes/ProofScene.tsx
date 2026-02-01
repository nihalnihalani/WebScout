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

const stats = [
  { value: "100", unit: "%", label: "Success Rate", color: colors.green },
  { value: "3.7", unit: "×", label: "Faster", color: colors.indigo },
  { value: "83", unit: "%", label: "Cache Hit Rate", color: colors.amber },
];

export const ProofScene: React.FC = () => {
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
          Measured Improvement
        </h2>
      </div>

      {/* Three big stats in a row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 120,
          marginTop: 20,
        }}
      >
        {stats.map((stat, i) => {
          const delay = 35 + i * 15;
          const statProgress = spring({
            frame: Math.max(0, frame - delay),
            fps,
            config: springs.dramatic,
          });

          // Animate the number counting up
          const numericValue = parseFloat(stat.value);
          const animatedValue = interpolate(
            frame,
            [delay, delay + 30],
            [0, numericValue],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            }
          );

          const displayValue =
            stat.value.includes(".")
              ? animatedValue.toFixed(1)
              : Math.round(animatedValue).toString();

          return (
            <div
              key={i}
              style={{
                textAlign: "center",
                opacity: statProgress,
                transform: `translateY(${interpolate(statProgress, [0, 1], [30, 0])}px)`,
              }}
            >
              <p
                style={{
                  fontSize: 120,
                  fontWeight: 700,
                  fontFamily: fonts.mono,
                  color: stat.color,
                  margin: 0,
                  lineHeight: 1,
                  letterSpacing: -4,
                }}
              >
                {displayValue}
                <span style={{ fontSize: 64 }}>{stat.unit}</span>
              </p>
              <p
                style={{
                  fontSize: 28,
                  fontFamily: fonts.heading,
                  fontWeight: 400,
                  color: colors.gray,
                  margin: "16px 0 0",
                }}
              >
                {stat.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          position: "absolute",
          bottom: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(frame, [110, 125], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
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
          This isn't a claim — it's measured.
        </p>
      </div>
    </AbsoluteFill>
  );
};

import { spring, interpolate, useCurrentFrame, useVideoConfig, Easing } from "remotion";

// Apple-style smooth entrance (no bounce)
export function useAppleSpring(delay: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: { mass: 1, damping: 26, stiffness: 170, overshootClamping: true },
  });
}

// Snappy pop-in for badges/icons
export function useSnappySpring(delay: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - delay,
    fps,
    config: { mass: 0.5, damping: 15, stiffness: 300, overshootClamping: false },
  });
}

// Fade in with clamp
export function useFadeIn(startFrame: number, duration: number = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// Fade out with clamp
export function useFadeOut(startFrame: number, duration: number = 15) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// Slide up entrance value
export function useSlideUp(startFrame: number, distance: number = 40, duration: number = 20) {
  const frame = useCurrentFrame();
  return interpolate(frame, [startFrame, startFrame + duration], [distance, 0], {
    easing: Easing.out(Easing.expo),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

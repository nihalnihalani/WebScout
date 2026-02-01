import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { HeroScene } from "./scenes/HeroScene";
import { LearningLoopScene } from "./scenes/LearningLoopScene";
import { PatternFitnessScene } from "./scenes/PatternFitnessScene";
import { AdaptiveSystemScene } from "./scenes/AdaptiveSystemScene";
import { WeaveDeepDiveScene } from "./scenes/WeaveDeepDiveScene";
import { SponsorStackScene } from "./scenes/SponsorStackScene";
import { ProofScene } from "./scenes/ProofScene";
import { ClosingScene } from "./scenes/ClosingScene";

export const WebScoutDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <Audio src={staticFile("bg-music.mp3")} volume={0.45} />

      {/* Scene 1: Hero Intro — 0-5s (frames 0-149) */}
      <Sequence from={0} durationInFrames={150}>
        <HeroScene />
      </Sequence>

      {/* Scene 2: Learning Loop — 5-13s (frames 150-389, 8s) */}
      <Sequence from={150} durationInFrames={240}>
        <LearningLoopScene />
      </Sequence>

      {/* Scene 3: Pattern Fitness — 13-18s (frames 390-539) */}
      <Sequence from={390} durationInFrames={150}>
        <PatternFitnessScene />
      </Sequence>

      {/* Scene 4: Adaptive System — 18-23s (frames 540-689) */}
      <Sequence from={540} durationInFrames={150}>
        <AdaptiveSystemScene />
      </Sequence>

      {/* Scene 5: Weave Deep Dive — 23-27.5s (frames 690-824, 4.5s) */}
      <Sequence from={690} durationInFrames={135}>
        <WeaveDeepDiveScene />
      </Sequence>

      {/* Scene 6: Sponsor Stack — 27.5-31.5s (frames 825-944, 4s) */}
      <Sequence from={825} durationInFrames={120}>
        <SponsorStackScene />
      </Sequence>

      {/* Scene 7: Proof/Metrics — 31.5-36.5s (frames 945-1094, 5s) */}
      <Sequence from={945} durationInFrames={150}>
        <ProofScene />
      </Sequence>

      {/* Scene 8: Closing — 36.5-40s (frames 1095-1199, 3.5s) */}
      <Sequence from={1095} durationInFrames={105}>
        <ClosingScene />
      </Sequence>
    </AbsoluteFill>
  );
};

import React from "react";
import { Composition } from "remotion";
import { WebScoutDemo } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="WebScoutDemo"
        component={WebScoutDemo}
        durationInFrames={1200}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};

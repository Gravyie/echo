import { Composition } from "remotion";
import { Launch, totalFrames } from "./Launch";

export const RemotionRoot = () => (
  <Composition id="Launch" component={Launch} durationInFrames={totalFrames} fps={30} width={1920} height={1080} />
);

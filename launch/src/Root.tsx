import { Composition } from "remotion";
import { Launch, totalFrames } from "./Launch";
import { Launch2, totalFrames2 } from "./Launch2";

export const RemotionRoot = () => (
  <>
    <Composition id="Launch2" component={Launch2} durationInFrames={totalFrames2} fps={30} width={1920} height={1080} />
    <Composition id="Launch" component={Launch} durationInFrames={totalFrames} fps={30} width={1920} height={1080} />
  </>
);

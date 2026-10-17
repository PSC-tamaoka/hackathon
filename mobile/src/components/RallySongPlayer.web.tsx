import { createElement } from "react";
import { rallySong } from "../constants/rallyMedia";

export function RallySongPlayer() {
  return createElement("iframe", {
    src: `https://www.youtube.com/embed/${rallySong.videoId}?playsinline=1`,
    title: rallySong.title,
    allow: "encrypted-media; picture-in-picture",
    referrerPolicy: "strict-origin-when-cross-origin",
    style: { border: 0, width: "100%", aspectRatio: "16 / 9", minHeight: 200 },
  });
}

import type { Metadata } from "next";
import { MediaInspectorWorkbench } from "@/components/MediaInspectorWorkbench";
import { ToolPageShell } from "@/components/ToolPageShell";

export const metadata: Metadata = {
  title: "Video Metadata Inspector — JingleStudio Tools",
  description:
    "Inspect MP4, MOV, and WebM container boxes, video codecs, resolution, duration, bitrate, and audio streams locally in your browser.",
  alternates: { canonical: "/tools/video-metadata-inspector" },
};

export default function VideoMetadataInspectorPage() {
  return (
    <ToolPageShell
      currentHref="/tools/video-metadata-inspector"
      badge="Container & Stream Inspector"
      title="Video Metadata Inspector"
      description="Inspect MP4, MOV, and WebM container headers, video/audio codecs, duration, resolution, frame rate, and overall bitrate locally."
    >
      <MediaInspectorWorkbench defaultFilter="video" mode="video" />
    </ToolPageShell>
  );
}

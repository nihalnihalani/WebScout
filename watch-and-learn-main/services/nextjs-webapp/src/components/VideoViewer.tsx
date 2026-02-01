"use client";

import { useMJPEGVideoStream } from "@/hooks/useMJPEGVideoStream";

interface VideoViewerProps {
  onConnectionChange?: (connected: boolean) => void;
}

export default function VideoViewer({ onConnectionChange }: VideoViewerProps) {
  const videoWsUrl =
    process.env.NEXT_PUBLIC_VIDEO_WS_URL || "ws://localhost:8765";

  const { videoRef, isConnected, error, reconnect } = useMJPEGVideoStream({
    url: videoWsUrl,
    onConnectionChange,
  });

  return (
    <div className="relative w-full h-full">
      {/* MJPEG stream displayed as image */}
      <img
        ref={videoRef}
        className="w-full h-full object-contain bg-black"
        alt="Browser view"
      />

      {!isConnected && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2" />
            <p className="text-sm text-gray-300">Connecting to video stream...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
          <div className="text-center">
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={reconnect}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
            >
              Reconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

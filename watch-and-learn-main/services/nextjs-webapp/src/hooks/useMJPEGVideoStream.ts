import { useEffect, useRef, useState, useCallback } from "react";

interface UseMJPEGVideoStreamOptions {
  url: string;
  onConnectionChange?: (connected: boolean) => void;
}

interface UseMJPEGVideoStreamReturn {
  videoRef: React.RefObject<HTMLImageElement>;
  isConnected: boolean;
  error: string | null;
  reconnect: () => void;
}

export function useMJPEGVideoStream({
  url,
  onConnectionChange,
}: UseMJPEGVideoStreamOptions): UseMJPEGVideoStreamReturn {
  const videoRef = useRef<HTMLImageElement>(null!);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateConnectionState = useCallback(
    (connected: boolean) => {
      setIsConnected(connected);
      onConnectionChange?.(connected);
    },
    [onConnectionChange]
  );

  const cleanup = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clear image source
    if (videoRef.current) {
      videoRef.current.src = "";
    }
  }, []);

  const connect = useCallback(() => {
    // Full cleanup first
    cleanup();

    setError(null);

    // Connect WebSocket
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      if (wsRef.current === ws) {
        updateConnectionState(true);
      }
    };

    ws.onmessage = (event) => {
      // Verify we're still using this WebSocket
      if (wsRef.current !== ws) {
        return;
      }

      if (event.data instanceof ArrayBuffer && videoRef.current) {
        // Convert ArrayBuffer to Blob and create object URL
        const blob = new Blob([event.data], { type: "image/jpeg" });
        const objectUrl = URL.createObjectURL(blob);

        // Revoke previous object URL to prevent memory leak
        if (videoRef.current.src && videoRef.current.src.startsWith("blob:")) {
          URL.revokeObjectURL(videoRef.current.src);
        }

        videoRef.current.src = objectUrl;
      }
    };

    ws.onerror = () => {
      if (wsRef.current === ws) {
        setError("WebSocket connection error");
        updateConnectionState(false);
      }
    };

    ws.onclose = () => {
      if (wsRef.current === ws) {
        updateConnectionState(false);
      }
    };
  }, [url, cleanup, updateConnectionState]);

  const reconnect = useCallback(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    videoRef,
    isConnected,
    error,
    reconnect,
  };
}

import { useEffect, useRef, useState } from "react";
import { Cast, Airplay } from "lucide-react";

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    chrome?: any;
    cast?: any;
    WebKitPlaybackTargetAvailabilityEvent?: any;
  }
}

interface CastButtonProps {
  hlsUrl: string | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  title?: string;
  poster?: string;
}

const CAST_SDK = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";

let castSdkPromise: Promise<boolean> | null = null;
function loadCastSdk(): Promise<boolean> {
  if (castSdkPromise) return castSdkPromise;
  castSdkPromise = new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.cast?.framework) return resolve(true);
    window.__onGCastApiAvailable = (isAvailable: boolean) => resolve(isAvailable);
    if (!document.querySelector(`script[src="${CAST_SDK}"]`)) {
      const s = document.createElement("script");
      s.src = CAST_SDK;
      s.async = true;
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    }
    setTimeout(() => resolve(!!window.cast?.framework), 4000);
  });
  return castSdkPromise;
}

export default function CastButton({ hlsUrl, videoRef, title, poster }: CastButtonProps) {
  const [castReady, setCastReady] = useState(false);
  const [casting, setCasting] = useState(false);
  const [airplayAvailable, setAirplayAvailable] = useState(false);
  const sessionListenerRef = useRef<any>(null);

  // Init Google Cast
  useEffect(() => {
    let cancelled = false;
    loadCastSdk().then((ok) => {
      if (cancelled || !ok || !window.cast?.framework) return;
      try {
        const ctx = window.cast.framework.CastContext.getInstance();
        ctx.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
        });
        setCastReady(true);
        const onState = (e: any) => {
          const s = e.sessionState;
          const SS = window.cast.framework.SessionState;
          setCasting(s === SS.SESSION_STARTED || s === SS.SESSION_RESUMED);
        };
        ctx.addEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          onState,
        );
        sessionListenerRef.current = onState;
      } catch (_) {}
    });
    return () => {
      cancelled = true;
      try {
        if (window.cast?.framework && sessionListenerRef.current) {
          window.cast.framework.CastContext.getInstance().removeEventListener(
            window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
            sessionListenerRef.current,
          );
        }
      } catch (_) {}
    };
  }, []);

  // AirPlay availability (iOS/Safari)
  useEffect(() => {
    const v = videoRef.current as any;
    if (!v) return;
    if (typeof v.webkitShowPlaybackTargetPicker !== "function") return;
    const onAvail = (e: any) => {
      setAirplayAvailable(e.availability === "available");
    };
    v.addEventListener("webkitplaybacktargetavailabilitychanged", onAvail);
    return () => v.removeEventListener("webkitplaybacktargetavailabilitychanged", onAvail);
  }, [videoRef, hlsUrl]);

  const handleAirplay = () => {
    const v = videoRef.current as any;
    try {
      v?.webkitShowPlaybackTargetPicker?.();
    } catch (_) {}
  };

  const handleCast = async () => {
    if (!hlsUrl || !window.cast?.framework) return;
    try {
      const ctx = window.cast.framework.CastContext.getInstance();
      await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) return;
      const mediaInfo = new window.chrome.cast.media.MediaInfo(hlsUrl, "application/x-mpegURL");
      mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
      const meta = new window.chrome.cast.media.GenericMediaMetadata();
      if (title) meta.title = title;
      if (poster) meta.images = [new window.chrome.cast.Image(poster)];
      mediaInfo.metadata = meta;
      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);
    } catch (_) {}
  };

  // iOS AirPlay button
  if (airplayAvailable) {
    return (
      <button
        onClick={handleAirplay}
        className="h-9 px-3 rounded-full bg-black/55 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-black/75 active:scale-95 transition"
        aria-label="AirPlay"
      >
        <Airplay className="w-4 h-4" />
        <span>AirPlay</span>
      </button>
    );
  }

  // Chromecast button
  if (castReady && hlsUrl) {
    return (
      <button
        onClick={handleCast}
        className={`h-9 px-3 rounded-full backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition ${
          casting ? "bg-primary/90 hover:bg-primary" : "bg-black/55 hover:bg-black/75"
        }`}
        aria-label="Caster sur TV"
      >
        <Cast className="w-4 h-4" />
        <span>{casting ? "En cast" : "Caster"}</span>
      </button>
    );
  }

  return null;
}

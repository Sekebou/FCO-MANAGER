import { useEffect, useRef, useState } from "react";
import { Cast } from "lucide-react";
import { toast } from "sonner";

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
    setTimeout(() => resolve(!!window.cast?.framework), 5000);
  });
  return castSdkPromise;
}

function detectPlatform() {
  if (typeof navigator === "undefined") return { ios: false, android: false, safari: false };
  const ua = navigator.userAgent || "";
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && (navigator as any).maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const safari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  return { ios, android, safari };
}

export default function CastButton({ hlsUrl, videoRef, title, poster }: CastButtonProps) {
  const [castReady, setCastReady] = useState(false);
  const [casting, setCasting] = useState(false);
  const [airplayAvailable, setAirplayAvailable] = useState(false);
  const sessionListenerRef = useRef<any>(null);
  const platform = useRef(detectPlatform()).current;

  // Init Google Cast (best-effort)
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
    // Enable AirPlay on the element
    try {
      v.setAttribute("x-webkit-airplay", "allow");
      v.setAttribute("airplay", "allow");
    } catch (_) {}
    if (typeof v.webkitShowPlaybackTargetPicker !== "function") return;
    const onAvail = (e: any) => {
      setAirplayAvailable(e.availability === "available");
    };
    v.addEventListener("webkitplaybacktargetavailabilitychanged", onAvail);
    // Assume available on iOS/Safari even before event fires
    if (platform.ios || platform.safari) setAirplayAvailable(true);
    return () => v.removeEventListener("webkitplaybacktargetavailabilitychanged", onAvail);
  }, [videoRef, hlsUrl, platform.ios, platform.safari]);

  const handleAirplay = () => {
    const v = videoRef.current as any;
    try {
      if (typeof v?.webkitShowPlaybackTargetPicker === "function") {
        v.webkitShowPlaybackTargetPicker();
        return true;
      }
    } catch (_) {}
    return false;
  };

  const handleChromecast = async () => {
    if (!hlsUrl || !window.cast?.framework) return false;
    try {
      const ctx = window.cast.framework.CastContext.getInstance();
      await ctx.requestSession();
      const session = ctx.getCurrentSession();
      if (!session) return false;
      const mediaInfo = new window.chrome.cast.media.MediaInfo(hlsUrl, "application/x-mpegURL");
      mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
      const meta = new window.chrome.cast.media.GenericMediaMetadata();
      if (title) meta.title = title;
      if (poster) meta.images = [new window.chrome.cast.Image(poster)];
      mediaInfo.metadata = meta;
      const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
      await session.loadMedia(request);
      return true;
    } catch (_) {
      return false;
    }
  };

  const handleClick = async () => {
    // 1. Chromecast if available
    if (castReady) {
      const ok = await handleChromecast();
      if (ok) return;
    }
    // 2. AirPlay (iOS Safari / native iOS WebView)
    if (handleAirplay()) return;
    // 3. Fallback : instructions selon plateforme
    if (platform.ios) {
      toast.info("Ouvrez le Centre de contrôle puis « Recopie de l'écran » pour diffuser sur Apple TV.", {
        duration: 6000,
      });
    } else if (platform.android) {
      toast.info("Ouvrez les paramètres rapides puis « Diffuser l'écran » pour envoyer sur Chromecast/TV.", {
        duration: 6000,
      });
    } else {
      toast.info("Utilisez Chrome (menu ⋮ → Diffuser) ou la recopie d'écran de votre système.", {
        duration: 6000,
      });
    }
  };

  // Toujours afficher si on a un flux
  if (!hlsUrl) return null;

  const label = casting ? "En cast" : "Caster";

  return (
    <button
      onClick={handleClick}
      className={`h-9 px-3 rounded-full backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition ${
        casting ? "bg-primary/90 hover:bg-primary" : "bg-black/55 hover:bg-black/75"
      }`}
      aria-label="Diffuser sur TV"
      title="Diffuser sur TV (Chromecast / AirPlay)"
    >
      <Cast className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

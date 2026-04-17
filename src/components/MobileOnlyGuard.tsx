import { ReactNode } from "react";
import { Smartphone } from "lucide-react";
import clubLogo from "@/assets/logo.png";

/**
 * Detects if running inside a Capacitor native app.
 */
const isCapacitorNative = () => {
  try {
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
};

/**
 * Detects if the device is a mobile or tablet (by user agent).
 */
const isMobileOrTablet = () => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|PlayBook|Silk/i.test(
    navigator.userAgent
  ) || (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent));
};

/**
 * Access rules:
 * - Capacitor native app (iOS/Android) → ALLOWED
 * - Any browser (mobile or desktop) → BLOCKED
 */
const isAllowed = () => {
  if (isCapacitorNative()) return true;
  if (typeof window !== "undefined") {
    // Allow Lovable preview access
    if (window.location.hostname.includes("lovable.app") || window.location.hostname.includes("lovable.dev") || window.location.hostname.includes("lovableproject.com") || window.location.hostname.includes("lovable.host")) return true;
    if (window.location.search.includes("__lovable_token")) return true;
    
    const fullUrl = window.location.href;
    const hash = window.location.hash;
    const pathname = window.location.pathname;
    
    // Allow password reset / recovery flow from email link
    if (fullUrl.includes("type=recovery") || fullUrl.includes("type=magiclink")) return true;
    if (hash.includes("access_token")) return true;
    
    // Allow /auth page when there's any hash fragment (Supabase auth redirects)
    if (pathname === "/auth" && hash.length > 1) return true;
    
    // Allow /download page (APK distribution link)
    if (pathname === "/download") return true;
  }
  return false;
};

interface MobileOnlyGuardProps {
  children: ReactNode;
}

const MobileOnlyGuard = ({ children }: MobileOnlyGuardProps) => {
  if (isAllowed()) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md shadow-lg">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <img src={clubLogo} alt="FCO Logo" className="w-14 h-14 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2 uppercase tracking-wide">
          FCO Manager
        </h1>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          Cette application est exclusivement disponible via l'application native.
          Téléchargez l'app FCO Manager sur iOS ou Android pour y accéder.
        </p>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-secondary/60 border border-border/50">
            <Smartphone className="h-4 w-4 text-primary/60 shrink-0" />
            <span>Téléchargez l'app sur iOS ou Android</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileOnlyGuard;

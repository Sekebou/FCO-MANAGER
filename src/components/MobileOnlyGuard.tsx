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
 * - Mobile/tablet browser → ALLOWED (pour inscription via lien d'invitation)
 * - Desktop browser → BLOCKED
 */
const isAllowed = () => {
  if (isCapacitorNative()) return true;
  if (isMobileOrTablet()) return true;
  return false; // desktop blocked
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
          Cette application est exclusivement disponible sur mobile.
          Veuillez utiliser l'application iOS ou Android.
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

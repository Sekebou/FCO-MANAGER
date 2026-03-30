import { ReactNode, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAppVersion, isVersionOutdated } from "@/lib/appVersion";
import { Download } from "lucide-react";
import clubLogo from "@/assets/logo.png";
import { Capacitor } from "@capacitor/core";

const STORE_URLS = {
  ios: "https://apps.apple.com/fr/app/fco-manager/id6760185315",
  android: "https://play.google.com/store/apps/details?id=com.sekebou.fcomanager&pcampaignid=web_share",
};

interface ForceUpdateGuardProps {
  children: ReactNode;
}

const ForceUpdateGuard = ({ children }: ForceUpdateGuardProps) => {
  const [outdated, setOutdated] = useState(false);
  const [checked, setChecked] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const appVersion = await getAppVersion();
        setCurrentVersion(appVersion);

        const platform = Capacitor.getPlatform();
        const key = platform === "ios" ? "min_version_ios" : "min_version_android";

        const { data } = await supabase
          .from("app_config")
          .select("value")
          .eq("key", key)
          .single();

        if (data?.value && isVersionOutdated(appVersion, data.value)) {
          setOutdated(true);
        }
      } catch {
        // Silently fail
      } finally {
        setChecked(true);
      }
    };
    check();
  }, []);

  if (!checked) return null;
  // TEMP: force display for preview — remove after validation
  const forcePreview = true;
  if (!outdated && !forcePreview) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md shadow-lg">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
          <img src={clubLogo} alt="FCO Logo" className="w-14 h-14 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2 uppercase tracking-wide">
          Mise à jour requise
        </h1>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          Une nouvelle version de FCO Manager est disponible. 
          Mets à jour l'application pour continuer à l'utiliser.
        </p>
        <div className="flex flex-col gap-3">
          <a
            href={STORE_URLS.ios}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 w-full py-3 px-6 rounded-xl bg-foreground text-background font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 384 512" fill="currentColor" className="w-5 h-5">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
            </svg>
            Mettre à jour sur l'App Store
          </a>
          <a
            href={STORE_URLS.android}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 w-full py-3 px-6 rounded-xl bg-[#34A853] text-white font-semibold text-sm hover:opacity-90 transition-opacity"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M17.523 2.237a.625.625 0 0 0-.853.226l-1.305 2.2A7.497 7.497 0 0 0 12 3.75a7.497 7.497 0 0 0-3.365.913L7.33 2.463a.625.625 0 1 0-1.08.627l1.275 2.148A7.476 7.476 0 0 0 4.5 11.25h15a7.476 7.476 0 0 0-3.025-5.012l1.275-2.148a.625.625 0 0 0-.227-.853zM9 9a.75.75 0 1 1 0-1.5A.75.75 0 0 1 9 9zm6 0a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM4.5 12.75v6a2.25 2.25 0 0 0 2.25 2.25h.75v2.25a1.5 1.5 0 0 0 3 0V21h3v2.25a1.5 1.5 0 0 0 3 0V21h.75a2.25 2.25 0 0 0 2.25-2.25v-6h-15zM2.25 12a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 3 0v-4.5a1.5 1.5 0 0 0-1.5-1.5zm19.5 0a1.5 1.5 0 0 0-1.5 1.5v4.5a1.5 1.5 0 0 0 3 0v-4.5a1.5 1.5 0 0 0-1.5-1.5z"/>
            </svg>
            Mettre à jour sur Google Play
          </a>
        </div>
        <p className="mt-4 text-xs text-muted-foreground/60">
          Version actuelle : {currentVersion}
        </p>
      </div>
    </div>
  );
};

export default ForceUpdateGuard;

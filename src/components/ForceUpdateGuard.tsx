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
  if (!outdated) return <>{children}</>;

  const platform = Capacitor.getPlatform();
  const storeUrl = platform === "ios" ? STORE_URLS.ios : STORE_URLS.android;
  const storeName = platform === "ios" ? "App Store" : "Play Store";

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
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
        >
          <Download size={18} />
          Mettre à jour sur {storeName}
        </a>
        <p className="mt-4 text-xs text-muted-foreground/60">
          Version actuelle : {currentVersion}
        </p>
      </div>
    </div>
  );
};

export default ForceUpdateGuard;

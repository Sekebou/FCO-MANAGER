import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const DownloadPage = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Download size={36} className="text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">FCO Manager</h1>
        <p className="text-muted-foreground text-sm">
          Télécharge l'application Android ci-dessous.
        </p>
        <a href="/dl/FCO-Manager.apk" download>
          <Button size="lg" className="w-full gap-2 mt-2">
            <Download size={18} />
            Télécharger l'APK
          </Button>
        </a>
        <p className="text-[11px] text-muted-foreground/60">
          Android uniquement · Autorise les sources inconnues dans les paramètres
        </p>
      </div>
    </div>
  );
};

export default DownloadPage;

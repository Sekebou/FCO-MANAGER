import { Download, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Expiration : 24h après ce timestamp (date de déploiement)
const UPLOAD_DATE = new Date("2026-03-08T22:00:00Z");
const EXPIRY_DATE = new Date(UPLOAD_DATE.getTime() + 24 * 60 * 60 * 1000);

const DownloadPage = () => {
  const isExpired = new Date() > EXPIRY_DATE;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-sm">
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto ${isExpired ? 'bg-destructive/10' : 'bg-primary/10'}`}>
          {isExpired ? (
            <AlertTriangle size={36} className="text-destructive" />
          ) : (
            <Download size={36} className="text-primary" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground">FCO Manager</h1>

        {isExpired ? (
          <>
            <p className="text-muted-foreground text-sm">
              Ce lien de téléchargement a expiré.
            </p>
            <p className="text-[11px] text-muted-foreground/60">
              Contacte un administrateur pour obtenir un nouveau lien.
            </p>
          </>
        ) : (
          <>
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
              <br />
              Lien valide jusqu'au {EXPIRY_DATE.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default DownloadPage;

import { Download, AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const UPLOAD_DATE = new Date("2026-03-12T11:00:00Z");
const EXPIRY_DATE = new Date(UPLOAD_DATE.getTime() + 24 * 60 * 60 * 1000);

const CHANGELOG = [
  "Nouveau : onglet Paris avec points virtuels",
  "Nouveau : messagerie privée et de groupe",
  "Navigation mobile repensée (4 onglets + menu « Plus »)",
  "Corrections de bugs d'affichage",
  "Amélioration des performances",
  "Amélioration de la gestion des convocations + feuille de match dans le menu",
  "Les pronostics dans les paris sont désormais privés",
];

const DownloadPage = () => {
  const isExpired = new Date() > EXPIRY_DATE;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-5 max-w-sm w-full">
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto ${isExpired ? 'bg-destructive/10' : 'bg-primary/10'}`}>
          {isExpired ? (
            <AlertTriangle size={36} className="text-destructive" />
          ) : (
            <Download size={36} className="text-primary" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-foreground">FCO Manager v2.1</h1>

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
            <div className="bg-muted/50 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Sparkles size={14} className="text-primary" />
                Nouveautés
              </div>
              <ul className="space-y-1">
                {CHANGELOG.map((item, i) => (
                  <li key={i} className="text-[12px] text-muted-foreground flex gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

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

import { ReactNode } from "react";
import { Smartphone } from "lucide-react";

const isMobileDevice = () => {
  if (typeof navigator === "undefined") return true;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

interface MobileOnlyGuardProps {
  children: ReactNode;
}

const MobileOnlyGuard = ({ children }: MobileOnlyGuardProps) => {
  if (isMobileDevice()) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md shadow-lg">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Smartphone className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-3">
          Application mobile uniquement
        </h1>
        <p className="text-muted-foreground mb-6">
          Cette application est disponible exclusivement sur mobile.
          Téléchargez l'application sur votre smartphone pour y accéder.
        </p>
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 justify-center">
            <Smartphone className="h-4 w-4" />
            <span>Disponible sur iOS et Android</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileOnlyGuard;

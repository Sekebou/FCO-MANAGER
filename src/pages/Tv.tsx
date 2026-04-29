import { Tv as TvIcon } from "lucide-react";
import clubLogo from "@/assets/logo.png";

const Tv = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-card border border-border rounded-3xl p-8 shadow-xl">
        <img src={clubLogo} alt="FCO-Manager" className="w-20 h-20 mx-auto mb-6 rounded-2xl" />
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <TvIcon className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-3">FCO TV — Fermée</h1>
        <p className="text-muted-foreground leading-relaxed">
          La TV du FCO est actuellement fermée.
          <br />
          Merci de revenir plus tard.
        </p>
      </div>
    </div>
  );
};

export default Tv;

import { useEffect, useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const ALLOWED_EMAIL = "boussekeymaxime@gmail.com";

interface Props {
  channelName?: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  matchTime?: string | null;
}

export default function AnnounceTvButton({ channelName, homeTeam, awayTeam, matchTime }: Props) {
  const [allowed, setAllowed] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setAllowed((data.user?.email || "").toLowerCase() === ALLOWED_EMAIL);
    });
    return () => { active = false; };
  }, []);

  if (!allowed) return null;

  const handleClick = async () => {
    if (sending) return;
    setSending(true);
    try {
      const matchLabel =
        homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : channelName || "Match en direct";
      const timeLabel = matchTime ? ` à ${matchTime}` : "";
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          title: "📺 FCO TV est en direct !",
          body: `Diffusion ouverte : ${matchLabel}${timeLabel}. Rejoins-nous sur l'app !`,
          data: { type: "tv_live", route: "/tv" },
        },
      });
      if (error) throw error;
      toast.success(`Notification envoyée (${data?.sent ?? 0} appareils)`);
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={sending}
      className="h-9 px-3 rounded-full bg-primary/90 hover:bg-primary text-white text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-60"
      aria-label="Annoncer la diffusion"
      title="Envoyer une notification : FCO TV ouverte"
    >
      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
      <span>{sending ? "Envoi…" : "Annoncer"}</span>
    </button>
  );
}

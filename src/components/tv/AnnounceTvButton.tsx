import { useEffect, useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";

const ALLOWED_EMAIL = "boussekeymaxime@gmail.com";

interface Props {
  userEmail?: string | null;
  channelName?: string;
  homeTeam?: string | null;
  awayTeam?: string | null;
  matchTime?: string | null;
  client: SupabaseClient;
}

export default function AnnounceTvButton({
  userEmail,
  channelName,
  homeTeam,
  awayTeam,
  matchTime,
  client,
}: Props) {
  const [sending, setSending] = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(userEmail ?? null);

  useEffect(() => {
    if (userEmail) { setResolvedEmail(userEmail); return; }
    let active = true;
    client.auth.getUser().then(({ data }) => {
      if (active) setResolvedEmail(data.user?.email ?? null);
    });
    return () => { active = false; };
  }, [userEmail, client]);

  const allowed = (resolvedEmail || "").toLowerCase() === ALLOWED_EMAIL;
  if (!allowed) return null;

  const handleClick = async () => {
    if (sending) return;
    setSending(true);
    try {
      const matchLabel =
        homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : channelName || "Match en direct";
      const timeLabel = matchTime ? ` à ${matchTime}` : "";
      const { data, error } = await client.functions.invoke("send-push-notification", {
        body: {
          title: "📺 FCO TV est en direct !",
          body: `Diffusion ouverte : ${matchLabel}${timeLabel}. Rejoins-nous sur l'app !`,
          data: { type: "tv_live", route: "/tv" },
        },
      });
      if (error) throw error;
      toast.success(`Notification envoyée (${(data as any)?.sent ?? 0} appareils)`);
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

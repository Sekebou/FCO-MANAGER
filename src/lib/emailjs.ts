import { supabase } from "@/integrations/supabase/client";

export async function sendInvitationEmail(params: {
  to_email: string;
  invite_link: string;
  role_label: string;
  inviter_name: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('send-email', {
    body: {
      type: 'invitation',
      to: params.to_email,
      params: {
        invite_link: params.invite_link,
        role_label: params.role_label,
        inviter_name: params.inviter_name,
      },
    },
  });
  if (res.error) throw res.error;
  return res.data;
}

export async function sendEventEmail(params: {
  to_email: string;
  event_title: string;
  event_date: string;
  event_type: string;
}) {
  const res = await supabase.functions.invoke('send-email', {
    body: {
      type: 'event',
      to: params.to_email,
      params: {
        event_title: params.event_title,
        event_date: params.event_date,
        event_type: params.event_type,
      },
    },
  });
  if (res.error) throw res.error;
  return res.data;
}

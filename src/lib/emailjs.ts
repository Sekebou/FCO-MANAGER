import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_7wmhc61';
const PUBLIC_KEY = 'YAIU3poHgOd6cG6PI';

// Template IDs
const TEMPLATE_INVITATION = 'template_p3ig9nv';
const TEMPLATE_EVENT = 'template_m28qlzo';

emailjs.init(PUBLIC_KEY);

export async function sendInvitationEmail(params: {
  to_email: string;
  invite_link: string;
  role_label: string;
  inviter_name: string;
}) {
  return emailjs.send(SERVICE_ID, TEMPLATE_INVITATION, {
    to_email: params.to_email,
    invite_link: params.invite_link,
    role_label: params.role_label,
    inviter_name: params.inviter_name,
  });
}

export async function sendEventEmail(params: {
  to_email: string;
  event_title: string;
  event_date: string;
  event_type: string;
}) {
  return emailjs.send(SERVICE_ID, TEMPLATE_EVENT, {
    to_email: params.to_email,
    event_title: params.event_title,
    event_date: params.event_date,
    event_type: params.event_type,
  });
}

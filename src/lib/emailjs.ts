import emailjs from '@emailjs/browser';

const SERVICE_ID = 'service_7wmhc61';
const PUBLIC_KEY = 'YAIU3poHgOd6cG6PI';

const TEMPLATES = {
  invitation: 'template_p3ig9nv',
  notification: 'template_m28qlzo',
} as const;

export async function sendInvitationEmail(params: {
  to_email: string;
  inviter_name: string;
  role_label: string;
  invite_link: string;
}) {
  return emailjs.send(SERVICE_ID, TEMPLATES.invitation, params, PUBLIC_KEY);
}

export async function sendNotificationEmail(params: {
  to_email: string;
  event_title: string;
  event_type_label: string;
  type_icon: string;
  event_date: string;
  response_link?: string;
}) {
  const templateParams = {
    ...params,
    response_link: params.response_link || 'https://blue-pitch-dash.lovable.app',
  };
  return emailjs.send(SERVICE_ID, TEMPLATES.notification, templateParams, PUBLIC_KEY);
}

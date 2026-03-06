import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const supportSchema = z.object({
  name: z.string().trim().min(1, "Veuillez entrer votre nom").max(100),
  email: z.string().trim().email("Adresse email invalide").max(255),
  subject: z.string().trim().min(1, "Veuillez entrer un sujet").max(200),
  message: z.string().trim().min(10, "Le message doit contenir au moins 10 caractères").max(2000),
});

type SupportForm = z.infer<typeof supportSchema>;

const Support = () => {
  const [form, setForm] = useState<SupportForm>({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof SupportForm, string>>>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleChange = (field: keyof SupportForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = supportSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SupportForm, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof SupportForm;
        if (!fieldErrors[field]) fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: {
          type: "support",
          to: "support@fco-manager.fr",
          params: result.data,
        },
      });
      if (error || !data?.success) throw new Error("Échec de l'envoi");
      setSent(true);
      toast.success("Votre demande a bien été envoyée !");
    } catch {
      toast.error("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(230,85%,14%)] via-[hsl(230,70%,22%)] to-[hsl(230,85%,34%)] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="FCO Manager"
            className="w-16 h-16 mx-auto rounded-2xl mb-4"
          />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Assistance FCO Manager
          </h1>
          <p className="text-sm text-blue-200 mt-2">
            Besoin d'aide ? Envoyez-nous votre demande.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[hsl(230,85%,34%)] to-[hsl(230,80%,60%)]" />

          {sent ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-green-50 flex items-center justify-center text-3xl mb-4">
                ✅
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Demande envoyée !</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Nous avons bien reçu votre message et reviendrons vers vous dans les plus brefs délais à l'adresse indiquée.
              </p>
              <button
                onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }}
                className="mt-6 text-sm font-semibold text-[hsl(230,85%,34%)] hover:underline"
              >
                Envoyer une autre demande
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {([
                { key: "name" as const, label: "Nom complet", placeholder: "Jean Dupont", type: "text" },
                { key: "email" as const, label: "Adresse email", placeholder: "jean@exemple.fr", type: "email" },
                { key: "subject" as const, label: "Sujet", placeholder: "Ex : Problème de connexion", type: "text" },
              ]).map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                    {label}
                  </label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={(e) => handleChange(key, e.target.value)}
                    placeholder={placeholder}
                    className={`w-full px-4 py-3 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(230,85%,45%)] ${
                      errors[key] ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50 focus:bg-white"
                    }`}
                  />
                  {errors[key] && <p className="text-xs text-red-500 mt-1">{errors[key]}</p>}
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
                  Message
                </label>
                <textarea
                  value={form.message}
                  onChange={(e) => handleChange("message", e.target.value)}
                  placeholder="Décrivez votre problème ou votre question..."
                  rows={5}
                  className={`w-full px-4 py-3 rounded-xl border text-sm transition-colors resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(230,85%,45%)] ${
                    errors.message ? "border-red-400 bg-red-50" : "border-gray-200 bg-gray-50 focus:bg-white"
                  }`}
                />
                {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-[hsl(230,85%,34%)] hover:bg-[hsl(230,85%,28%)] text-white font-bold text-sm transition-colors disabled:opacity-50"
              >
                {loading ? "Envoi en cours..." : "Envoyer ma demande"}
              </button>

              <p className="text-[11px] text-gray-400 text-center pt-1">
                Vous pouvez aussi nous contacter à{" "}
                <a href="mailto:support@fco-manager.fr" className="text-[hsl(230,85%,45%)] hover:underline">
                  support@fco-manager.fr
                </a>
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-blue-300/60 mt-6">
          © 2026 FCO Manager · Football Club Organisation
        </p>
      </div>
    </div>
  );
};

export default Support;

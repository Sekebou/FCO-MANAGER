import { ArrowLeft } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(230,85%,14%)] via-[hsl(230,70%,22%)] to-[hsl(230,85%,34%)] p-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <img src="/logo.png" alt="FCO Manager" className="w-14 h-14 mx-auto rounded-2xl mb-4" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Politique de Confidentialité
          </h1>
          <p className="text-sm text-blue-200 mt-2">Dernière mise à jour : 8 mars 2026</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[hsl(230,85%,34%)] to-[hsl(230,80%,60%)]" />
          <div className="p-6 sm:p-8 space-y-6 text-sm text-gray-700 leading-relaxed">

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">1. Introduction</h2>
              <p>
                L'application <strong>FCO Manager</strong> (ci-après « l'Application ») est éditée par le Football Club d'Oisemont.
                Nous attachons une grande importance à la protection de vos données personnelles et au respect de votre vie privée.
                La présente politique de confidentialité décrit les informations que nous collectons, comment nous les utilisons et les choix dont vous disposez.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">2. Données collectées</h2>
              <p>Nous collectons les données suivantes lorsque vous utilisez l'Application :</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Données d'inscription :</strong> nom, prénom, adresse email, poste de jeu, date d'expiration de licence.</li>
                <li><strong>Données de profil :</strong> photo de profil (facultatif), nom d'utilisateur.</li>
                <li><strong>Données d'utilisation :</strong> présences aux événements, statistiques sportives (buts, passes, matchs joués).</li>
                <li><strong>Messages :</strong> contenus des messages envoyés dans le chat et les conversations privées.</li>
                <li><strong>Notifications push :</strong> jetons d'identification d'appareil (FCM tokens) pour l'envoi de notifications.</li>
                <li><strong>Photos :</strong> images partagées dans la galerie ou le chat de l'Application.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">3. Finalité du traitement</h2>
              <p>Vos données sont utilisées exclusivement pour :</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>La gestion des membres et de l'effectif du club.</li>
                <li>La communication interne (chat, notifications, annonces).</li>
                <li>Le suivi des présences et des statistiques sportives.</li>
                <li>Le fonctionnement du système de paris virtuels (points fictifs, aucun argent réel).</li>
                <li>L'amélioration de l'expérience utilisateur.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">4. Stockage et sécurité</h2>
              <p>
                Vos données sont stockées de manière sécurisée sur des serveurs hébergés par <strong>Supabase</strong> (infrastructure cloud conforme aux normes de sécurité internationales).
                L'accès aux données est protégé par des politiques de sécurité au niveau des lignes (RLS) garantissant que chaque utilisateur n'accède qu'aux données qui le concernent.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">5. Partage des données</h2>
              <p>
                Vos données ne sont <strong>jamais vendues ni partagées</strong> avec des tiers à des fins commerciales.
                Elles sont uniquement partagées avec :
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Les autres membres du club (nom, photo, statistiques, messages).</li>
                <li>Les administrateurs du club pour la gestion de l'effectif.</li>
                <li>Firebase Cloud Messaging (Google) pour l'envoi de notifications push.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">6. Durée de conservation</h2>
              <p>
                Vos données sont conservées tant que votre compte est actif.
                Les événements passés sont automatiquement archivés puis supprimés après 24 heures.
                Vous pouvez demander la suppression de votre compte et de vos données à tout moment.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">7. Vos droits</h2>
              <p>Conformément au RGPD, vous disposez des droits suivants :</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li><strong>Droit d'accès :</strong> obtenir une copie de vos données personnelles.</li>
                <li><strong>Droit de rectification :</strong> corriger vos informations inexactes.</li>
                <li><strong>Droit de suppression :</strong> demander l'effacement de vos données.</li>
                <li><strong>Droit de portabilité :</strong> recevoir vos données dans un format structuré.</li>
              </ul>
              <p className="mt-2">
                Pour exercer ces droits, contactez-nous à{" "}
                <a href="mailto:support@fco-manager.fr" className="text-[hsl(230,85%,45%)] hover:underline font-medium">
                  support@fco-manager.fr
                </a>.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">8. Mineurs</h2>
              <p>
                L'Application peut être utilisée par des mineurs dans le cadre de l'activité sportive du club.
                L'inscription d'un mineur doit être effectuée avec le consentement d'un représentant légal.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">9. Contact</h2>
              <p>
                Pour toute question relative à cette politique de confidentialité, vous pouvez nous contacter à :{" "}
                <a href="mailto:support@fco-manager.fr" className="text-[hsl(230,85%,45%)] hover:underline font-medium">
                  support@fco-manager.fr
                </a>
              </p>
            </section>
          </div>
        </div>

        <p className="text-center text-[11px] text-blue-300/60 mt-6 pb-8">
          © 2026 FCO Manager · Football Club d'Oisemont
        </p>
      </div>
    </div>
  );
};

export default Privacy;

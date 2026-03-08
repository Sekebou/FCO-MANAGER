const Terms = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(230,85%,14%)] via-[hsl(230,70%,22%)] to-[hsl(230,85%,34%)] p-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <img src="/logo.png" alt="FCO Manager" className="w-14 h-14 mx-auto rounded-2xl mb-4" />
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Conditions Générales d'Utilisation
          </h1>
          <p className="text-sm text-blue-200 mt-2">Dernière mise à jour : 8 mars 2026</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[hsl(230,85%,34%)] to-[hsl(230,80%,60%)]" />
          <div className="p-6 sm:p-8 space-y-6 text-sm text-gray-700 leading-relaxed">

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">1. Objet</h2>
              <p>
                Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation de l'application mobile <strong>FCO Manager</strong>,
                destinée à la gestion interne du Football Club d'Oisemont (FCO).
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">2. Accès à l'Application</h2>
              <p>
                L'accès à l'Application est réservé aux membres du club ayant reçu une invitation de la part d'un administrateur.
                L'inscription nécessite une adresse email valide et la création d'un mot de passe sécurisé.
                L'Application est disponible sur iOS et Android.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">3. Fonctionnalités</h2>
              <p>L'Application offre les fonctionnalités suivantes :</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Gestion des événements (matchs, entraînements) et suivi des présences.</li>
                <li>Communication interne (chat de groupe, messagerie privée, annonces).</li>
                <li>Consultation des statistiques individuelles et des classements de championnat.</li>
                <li>Galerie photos du club.</li>
                <li>Système de paris sportifs virtuels avec des points fictifs (aucune valeur monétaire).</li>
                <li>Notifications push pour les événements et communications importantes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">4. Paris virtuels</h2>
              <p>
                Le système de paris intégré à l'Application utilise exclusivement des <strong>points virtuels sans aucune valeur monétaire</strong>.
                Il ne constitue en aucun cas un jeu d'argent ou de hasard au sens de la législation en vigueur.
                Les points sont attribués gratuitement et ne peuvent être ni achetés, ni échangés, ni convertis en argent réel.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">5. Comportement des utilisateurs</h2>
              <p>En utilisant l'Application, vous vous engagez à :</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Respecter les autres membres dans vos communications.</li>
                <li>Ne pas publier de contenu illégal, offensant, discriminatoire ou inapproprié.</li>
                <li>Ne pas tenter de contourner les mesures de sécurité de l'Application.</li>
                <li>Utiliser l'Application uniquement dans le cadre des activités du club.</li>
              </ul>
              <p className="mt-2">
                Les administrateurs se réservent le droit de supprimer tout contenu inapproprié et de suspendre ou supprimer tout compte ne respectant pas ces règles.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">6. Propriété intellectuelle</h2>
              <p>
                L'ensemble des éléments de l'Application (design, code, logo, contenus) est protégé par les lois relatives à la propriété intellectuelle.
                Toute reproduction non autorisée est interdite.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">7. Limitation de responsabilité</h2>
              <p>
                L'Application est fournie « en l'état ». Le Football Club d'Oisemont ne saurait être tenu responsable
                des éventuels dysfonctionnements, pertes de données ou interruptions de service.
                L'Application est un outil bénévole de gestion de club et ne constitue pas un service commercial.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">8. Modification des CGU</h2>
              <p>
                Les présentes CGU peuvent être modifiées à tout moment. Les utilisateurs seront informés de toute modification significative
                via l'Application. La poursuite de l'utilisation de l'Application après modification vaut acceptation des nouvelles conditions.
              </p>
            </section>

            <section>
              <h2 className="text-base font-bold text-gray-900 mb-2">9. Contact</h2>
              <p>
                Pour toute question concernant ces conditions, contactez-nous à :{" "}
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

export default Terms;

// Configuration publique des clients. ATTENTION : dépôt PUBLIC — jamais d'adresse perso, de clé ni de donnée de contact ici.
// Ajout d'un client : copier un bloc, adapter. Généré/mis à jour par la tâche newsletter.
module.exports = {
  "paris-seine-test": {
    nom: "Paris Seine Test",
    segment_id: "a85f5fbb-0f13-4dce-83ab-a634f2eb4eed",
    from: "Paris Seine Test <paris-seine-test@test.10bigp.fr>",
    reply_to: "",
    couleur: "#1d4f91",
    couleur_texte_bouton: "#ffffff",
    logo: "https://www.paris-seine-immobilier.com/office8/parisseine_cherchemidi/catalog/images/466759.png",
    site: "https://www.paris-seine-immobilier.com",
    // Hôtes autorisés pour la redirection des clics (anti-redirection ouverte)
    hotes_liens: ["www.paris-seine-immobilier.com", "paris-seine-immobilier.com", "www.opinionsystem.fr"],
    // Origines autorisées à appeler le formulaire depuis le site du client
    origines: ["https://www.paris-seine-immobilier.com", "https://paris-seine-immobilier.com"],
    politique_url: "",
    test: true
  }
};

# Marées France

## Présentation

Cette intégration apporte dans Gladys les marées des ports français, d’après les prédictions du SHOM (le service hydrographique de la Marine, celui du site maree.shom.fr) : heures et hauteurs des pleines et basses mers, coefficients et hauteur d’eau à tout moment. Elle couvre 387 ports : métropole, outre-mer et quelques ports étrangers.

Chaque port devient un appareil, des scènes se déclenchent avant chaque marée ou lors des grandes marées, et trois widgets montrent la courbe du jour, les prochaines marées et les coefficients.

![Les trois widgets : marée du jour avec sa courbe, prochaines marées, coefficients de marée (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-marees-france/main/docs/assets/widgets.fr.png)

Les prédictions sont la propriété du SHOM et ne remplacent pas les documents nautiques officiels. Cette intégration communautaire n’est pas affiliée au SHOM.

## Prérequis

- Gladys Assistant 5.1.0 ou plus récent.
- Un accès à Internet depuis Gladys. Aucun compte ni clé.

## Configuration

| Champ             | Rôle                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Port              | Le port principal, dans la liste du SHOM. Tapez ses premières lettres pour y aller.           |
| Autres ports      | Jusqu’à quatre de plus, par leur nom, séparés par des virgules : `Saint-Malo, Roscoff`.       |
| Langue des textes | Langue des noms d’appareils, des états texte et des résumés de scène. Automatique par défaut. |

Le bouton **Rechercher un port** vérifie un nom (accents et majuscules ignorés) et affiche les ports qui correspondent. **Télécharger maintenant** télécharge à nouveau les marées (c’est fait seul une fois par jour, la nuit). L’état de connexion indique les ports suivis et les noms introuvables.

## Utilisation

### Appareils

Ouvrez l’onglet **Découverte** et ajoutez les appareils « Marée &lt;port&gt; ». Chacun a : la hauteur d’eau (m, par pas de 5 minutes), la marée (montante ou descendante), la prochaine marée en clair (« Pleine mer à 20:22 (6,07 m, coef. 62) »), les minutes avant la prochaine pleine et basse mer et leurs hauteurs, le coefficient de la prochaine pleine mer et le coefficient maximal du lendemain (pour les ports qui ont des coefficients). Les hauteurs sont au-dessus du zéro des cartes, comme sur maree.shom.fr ; les heures suivent le fuseau horaire de Gladys.

### Widgets du tableau de bord

- **Marée du jour** : hauteur d’eau, tendance, prochaine marée, coefficient et courbe de la journée avec ses pleines et basses mers.
- **Prochaines marées** : les huit suivantes, datées, avec leur coefficient.
- **Coefficients de marée** : deux semaines en barres, le pic et la prochaine grande marée (coefficient ≥ 95).

Chaque widget a un réglage **Port** (un appareil port déjà ajouté) ; vide, il montre le premier port de la configuration.

### Scènes

- **Marée : pleine ou basse mer** : à l’heure de la marée ou de 15 minutes à 6 heures avant. Filtres : port, type de marée.
- **Marée : grande marée** : une pleine mer dont le coefficient atteint un seuil (70 à 115), à son heure ou jusqu’à la veille. L’heure de la basse mer qui suit est fournie.
- Action **Marée : lire la prochaine marée** : heure, hauteur, coefficient, hauteur actuelle et un résumé prêt pour un message.

Exemples : une heure avant la pleine mer, envoyer l’heure et la hauteur sur Telegram ; la veille d’une grande marée de coefficient 95 ou plus, prévenir pour la pêche à pied ; à la basse mer, fermer un volet.

Un événement manqué de plus de 10 minutes (Gladys arrêtée) n’est pas rejoué, et chaque événement n’est envoyé qu’une fois, même après un redémarrage.

### Transport

Les données viennent des services du SHOM sur Internet (badge « cloud »). Seul le code du port figure dans les requêtes : rien sur vous ne quitte votre réseau. Trois requêtes par port et par jour suffisent ; tout le reste est calculé dans le conteneur.

## Dépannage

- **« Port introuvable »** : utilisez le bouton Rechercher un port, puis copiez le nom exact dans « Autres ports ».
- **« Le SHOM refuse les requêtes »** : son pare-feu bloque parfois une adresse un moment. L’intégration réessaie seule dans quelques heures et garde les données des jours précédents (8 jours de marées).
- **Pas de coefficient** : le SHOM n’en publie pas pour certains ports d’outre-mer.
- **Rapport de bug** : cliquez sur **Diagnostic** puis copiez les lignes « Diagnostic: » de l’onglet Journaux, avec les versions de Gladys et de l’intégration (Gladys ne transmet pas `DEBUG` au conteneur).

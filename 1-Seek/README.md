# Seek — population de véhicules

Ouvrir `index.html` dans un navigateur (ou servir ce dossier avec un serveur HTTP local).

- 20 véhicules au démarrage, réglables de 1 à 5000 avec le slider, pendant le glissement (jusqu'à 500 cibles). Le compteur FPS de l'en-tête aide à tester la montée en charge.
- Les cibles (`MitoticTarget`) fuient automatiquement tout véhicule entré dans leur rayon de vision (100 px par défaut) : `evade` (fuite de la position anticipée), `flee` ou aucune réaction, au choix. Leur allure croît de la vitesse calme à la vitesse de panique quand le véhicule le plus proche approche. Au calme, elles suivent la souris ou errent (`wander`).
- Après un délai (8 s par défaut), une cible se divise : une fille naît collée à la mère, grossit en s'éloignant sous l'effet d'une poussée de séparation, puis se détache. Le nombre de cibles est plafonné (8 par défaut) ; un bouton revient à une seule cible.
- Chaque cible a une barre de vie. Un véhicule qui l'atteint (≤ 16 px) lui retire un point de vie, la fait clignoter en blanc et réapparaît ailleurs. Après 5 coups (réglable de 1 à 20), la cible éclate en fragments (`BurstParticle`) qui s'éparpillent puis s'estompent. Une fille naît avec une santé pleine. S'il ne reste plus de cible, une nouvelle apparaît au centre.
- Les véhicules (`Hunter`) visent la cible la plus proche, en `seek` (bleus) ou en `pursue` (violets).
- Le panneau « Réglages » permet de changer les comportements (menus déroulants) et leurs paramètres (sliders) pendant l'exécution. Le mode debug affiche le rayon de vision des cibles (orange pendant une fuite).
- Les véhicules laissent une traînée de fumée colorée calculée sur le GPU (`smokeTrails.js`), désactivable.

## Organisation

| Fichier | Rôle |
|---|---|
| `vehicle.js` | Classe de base : seek, flee, pursue, evade, wander, locomotion, dessin (couleurs en propriétés) |
| `target.js` | `Target` : mouvement erratique d'origine, compté en images et désactivable (`erratic = false`) |
| `hunter.js` | `Hunter extends Vehicle` : sélection de la cible la plus proche, seek ou pursue |
| `evadingTarget.js` | `EvadingTarget extends Target` : perception, fuite pondérée, comportement au calme, santé, debug |
| `mitoticTarget.js` | `MitoticTarget extends EvadingTarget` : vieillissement, division, bourgeonnement |
| `burstParticle.js` | `BurstParticle extends Vehicle` : fragment d'éclatement freiné par une force de traînée |
| `colony.js` | Gestion de scène des cibles : divisions plafonnées, retrait des cibles éclatées, réinitialisation |
| `population.js` | Gestion de scène des véhicules : slider, apparition, arrivée (signalée par `step`) |
| `settings.js`, `controls.js` | Réglages par défaut, application aux entités, liaison générique avec les éléments `[data-setting]` |
| `spatialGrid.js` | Hachage spatial (grille uniforme) : voisins dans un rayon, plus proche voisin exact |
| `vehicleBatch.js` | Rendu groupé des véhicules : un chemin Canvas par couleur, flèches de vitesse en debug |
| `vehicleGL.js` | Rendu GPU des véhicules (WebGL2 instancié), activé par défaut ; repli sur `vehicleBatch.js` |
| `targetBatch.js` | Rendu groupé des cibles (vision, pont de mitose, corps, barres de vie), un chemin par couleur |
| `smokeTrails.js` | Fumée en WebGL2 direct (pas une entité) : bouffées instanciées, advection en ping-pong, résolution réglable |
| `qualityGovernor.js` | Qualité automatique : allège fumée puis menaces perçues si une image dépasse le budget de 60 FPS |
| `sketch.js` | Boucle p5 : réglages → cycle de vie → steering et locomotion → dessin |

`mouseTarget.js` n'est plus chargé par la page mais reste testé.

## Performances

- Perception limitée par une grille de hachage spatial (taille de case = rayon de vision) : une cible n'examine que les véhicules des cases voisines, un véhicule trouve la cible la plus proche en parcourant des anneaux de cases. Les résultats sont identiques à la recherche exhaustive (vérifié par les tests).
- Véhicules dessinés sur le GPU (`VehicleGL`) : un triangle envoyé une fois, un tableau de 11 nombres par véhicule (position, orientation, rayon, couleurs) mis à jour à chaque image, un seul appel `drawArraysInstanced`. Le contour est calculé dans le shader. Le rendu se fait dans un canvas hors écran copié dans le canvas p5, ce qui garde l'ordre fumée → véhicules → cibles. La case « Rendu GPU » bascule sur `VehicleBatch` (un chemin Canvas par couleur) pour comparer. `Vehicle.show()` reste disponible pour un véhicule isolé. Les flèches de vitesse ne sont dessinées qu'en mode debug.
- Fumée en WebGL2 direct, dans un canvas hors écran indépendant de p5 : un triangle par bouffée (arrondi par le shader), toutes en un seul appel instancié, puis advection entre deux textures en ping-pong. À 2000 véhicules : ~8 ms → 1,8 ms.
- Qualité automatique (case « Qualité automatique », activée par défaut ; niveau affiché dans l'en-tête) : si la durée moyenne des images dépasse 14 ms pendant 20 images, la scène passe au niveau suivant (fumée en demi-résolution, en quart de résolution, sans fumée, puis 3 menaces perçues au plus). Elle remonte d'un niveau après 120 images avec de la marge (moins de 60 % du budget) ; une rechute rapide double ce délai, pour ne pas osciller. Les pics isolés sont ignorés (moyenne lissée). Les réglages de l'utilisateur ne sont pas modifiés.
- Perception des cibles limitée aux `maxMenaces` véhicules les plus proches (8 par défaut, slider « Menaces prises en compte ») et calculée sans créer de vecteurs. Quand les véhicules s'agglutinent, une cible pouvait voir des centaines de menaces et calculer une force d'évasion pour chacune ; les plus lointaines ne pesaient presque rien dans la moyenne pondérée. L'allure reste fixée par la menace la plus proche.
- Cibles (`TargetBatch`) et fragments (`BurstParticle.drawAll`, un chemin par couleur et palier d'opacité) dessinés en groupe ; `show()` reste disponible et partage la même géométrie (`healthBar`, `healthColor`, `bodyColor`, `neckQuad`, `appearance`).

Mesuré dans le panneau navigateur intégré (médiane, ms par image ; un navigateur classique est plus rapide) :

| Véhicules / cibles | Avant | Après |
|---|---|---|
| 200 / 8 | 17.8 | 7.4 |
| 1000 / 32 | 62.9 | 20.0 |
| 3000 / 32 | 197.9 | 82.0 |
| 3000 / 300 | 499.5 | 147.5 |

Rendu des seuls véhicules, Canvas groupé contre GPU instancié : 7.1 → 1.9 ms (1000), 40.3 → 2.3 ms (3000), 108.6 → 3.5 ms (5000). Image complète à 5000 véhicules : 135 → 43.5 ms ; il reste surtout la fumée (~14 ms) et le steering des véhicules (~11 ms).

Stabilité avec la qualité automatique (images par seconde mesurées, part des images au-delà de 16,7 ms) : 900 véhicules ≈ 59 images/s en qualité pleine (1/296) ; 2000 véhicules ≈ 57 images/s (sans fumée) ; 5000 véhicules ≈ 50 images/s (niveau le plus léger).

400 cibles et 900 véhicules : 161.5 → 17 ms par image (steering des cibles 147 → 7 ms ; dessin des cibles 8.2 → 1.2 ms ; 1000 fragments 8.9 → 2.6 ms). En jeu réel avec 900 véhicules : ~10 ms par image.

## Tests

Depuis ce dossier, avec Node.js (18 ou plus) :

```sh
node --test tests/*.test.mjs
```

Aucune dépendance à installer. Les tests exécutent les vraies classes avec un adaptateur vectoriel minimal (`tests/helpers.mjs`) et un aléatoire déterministe. La validation du rendu avec p5 et du glissement réel se fait également dans le navigateur.

La [spécification](EXO1_SPECIFICATION.md) décrit les règles, le workflow et les cas limites. Elle constitue le document de conception initial ; l'implémentation et les tests sont maintenant présents.

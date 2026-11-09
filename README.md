# BAAM.ÉDITIONS

Portail territorial des livres BAAM. La V1 prend la forme d'une bibliothèque
d'horizons : une grille de volumes sur fond nuit, animée par le champ vivant
Éditions et alimentée par les manifests `baam.json` de chaque livre.

## Lancer

Double-cliquer sur `lancer-site.bat`, ou :

```text
npm run build
npm run serve
```

Puis ouvrir `http://127.0.0.1:8096/`.

## Registre

`portal.config.json` déclare les livres autorisés. Le compilateur essaie, dans
l'ordre, le manifest local, son URL publique, puis le dernier cache versionné.
Il produit :

- `public/data/registry.json` ;
- `public/data/graph.jsonld` ;
- `public/.well-known/baam.json` ;
- `public/sitemap.xml`.

La publication cible est `https://editions.baam.pro/`. Le premier livre,
L'Utile et l'Agréable, vise `https://utile-agreable.editions.baam.pro/`.

## Direction visuelle

- marque : Bebas Neue, DM Sans, DM Mono et signe partagé BAAM ;
- neutres : Nuit et Papier ;
- accent : orange Éditions `#FF762E` ;
- matière : paysage-horizon vivant ;
- interaction : la card avance au survol et se déplie sur place au clic.

# Japanreis

Reisapp voor Japan en Hanoi. Een statische web app die op GitHub Pages draait,
zonder server en zonder backend: alle logica draait in de browser en alle
persoonlijke data blijft op je eigen toestel.

Live: https://sjoerdhutter.github.io/Japanreis/

## De uitgangspunten

Deze vijf gelden overal in de app en worden nergens doorbroken.

1. **Altijd beschikbaar.** Elke stad, ook Hanoi, is volledig te openen ongeacht
   waar je bent. Locatie is een optioneel filter, nooit een voorwaarde.
2. **Offline first.** Alle content reist met de app mee en staat na de eerste
   opening op je toestel. Alleen de kaarttegels haal je per stad apart op, want
   die zijn te groot om in te bakken.
3. **Valuta altijd dubbel.** Elk bedrag in yen of dong toont het euro
   equivalent ertussen haakjes, zoals ¥1.200 (EUR 7). Dat gebeurt op één plek in
   de code en nergens anders.
4. **Persoonlijke laag apart.** Eigen punten en tips krijgen een eigen kleur op
   de kaart, zodat altijd zichtbaar is wat van jou is en wat van de app.
5. **Twee bestemmingen, één app.** Japan en Hanoi zijn gelijkwaardige
   bestemmingen in dezelfde structuur.

## Aan de slag

```bash
npm install
npm run dev
```

| Commando            | Wat het doet                                               |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Draait de app lokaal                                       |
| `npm run build`     | Bouwt naar `dist/`                                         |
| `npm run validate`  | Controleert alle contentbestanden tegen het schema         |
| `npm test`          | Draait de tests                                            |
| `npm run lint`      | Lint                                                       |
| `npm run typecheck` | Types                                                      |
| `npm run icons`     | Hertekent de PWA-iconen (alleen nodig bij een nieuw icoon) |

Een push naar `main` bouwt en publiceert automatisch naar GitHub Pages.

## De content bijwerken

Alle reiscontent staat in `data/` als YAML en is met de hand bij te werken, ook
rechtstreeks op github.com vanaf je telefoon. `npm run validate` draait in CI en
laat de build falen bij een tikfout, zodat je onderweg nooit tegen een lege stad
aanloopt.

| Bestand                     | Wat erin staat                                     |
| --------------------------- | -------------------------------------------------- |
| `data/steden.yaml`          | De steden, hun tijdzone, valuta en kaartgebied     |
| `data/reisschema.yaml`      | Welke stad op welke dag; voedt de highlight logica |
| `data/tijdlijnen.yaml`      | De historische tijdvakken van Japan en van Hanoi   |
| `data/plaatsen/<stad>.yaml` | De punten van die stad: attracties, eten, stempels |

> **Let op:** de startset in `data/plaatsen/` is redactionele content uit
> algemene kennis en is niet ter plaatse geverifieerd. Openingstijden en prijzen
> in Japan schuiven regelmatig. Controleer wat je echt nodig hebt en zet dan
> `gecontroleerdOp` bij de bron.

### Het reisschema invullen

De datums staan bewust leeg tot de reis geboekt is. Vul per segment `van` en
`tot` in als `YYYY-MM-DD`, allebei of geen van beide. Zolang ze leeg zijn valt
de highlight terug op GPS en op de laatst bekeken stad, precies zoals bedoeld.

### Het kaartgebied van een stad

`kaartgebied` is het rechthoekje dat offline wordt opgeslagen. Houd het klein:
elk zoomniveau erbij is vier keer zoveel tegels. Een test bewaakt dat geen enkele
stad boven de grens van 4000 tegels uitkomt, en `npm run validate` waarschuwt als
een punt buiten het gebied van zijn eigen stad valt.

## Hoe het in elkaar zit

```
data/                    De reiscontent als YAML
src/domein/              Pure logica, zonder React en zonder netwerk
  schema/                Het Place- en City-model, in Zod
  valuta/                De enige plek waar bedragen worden opgemaakt
  highlight/             Hoofdstuk 1: welke stad staat bovenaan
  geo/, tijd/            Afstand, tijdzones en middernacht
src/data/                Content inlezen en IndexedDB
src/kaart/               Kaartconstanten en de offline tegeldownload
src/features/            De schermen
src/state/               De gedeelde toestand
```

De laag `src/domein/` bevat geen React, geen netwerk en geen opslag. Dat is met
opzet: het is de laag waar een fout betekent dat je in Kyoto naar Tokio zit te
kijken, en juist die laag moet volledig te testen zijn.

## Kaarten en OpenStreetMap

De kaart draait op tegels van OpenStreetMap. Die dienst draait op giften en
staat massale downloads niet toe, dus de offline functie heeft drie remmen: een
klein kaartgebied per stad, een bovengrens van 4000 tegels, en hooguit vier
verzoeken tegelijk. Een stad kost daarmee ruwweg 10 tot 50 MB op je toestel.
Wil je een andere tegelaanbieder, dan is dat één regel in
`src/kaart/constanten.ts`.

## Wat er werkt en wat nog niet

Gebouwd:

- Fase 0: projectopzet, PWA, IndexedDB, het `Plaats`- en `Stad`-model, de
  centrale valutahelper.
- Fase 1: hoofdmenu met alle steden, de volledige highlight logica uit hoofdstuk
  1, het stadsscherm met kaart, clustering en offline opslaan.
- Een startset van 61 punten over zeven steden.
- Uit fase 3 naar voren gehaald: de Google Maps import, inclusief het scherm om
  een Takeout export of een geplakte lijst in te lezen.

### Een Google Maps lijst importeren

Google heeft geen manier om een lijst rechtstreeks op te vragen, ook geen
gedeelde lijst van iemand anders: er is geen openbare koppeling en de
lijstpagina is niet uit te lezen. Er moet dus een bestand aan te pas komen.

1. Gaat het om de lijst van iemand anders: open de gedeelde link in Google Maps
   en sla de lijst op, zodat hij bij je eigen opgeslagen lijsten komt te staan.
2. Ga naar takeout.google.com, kies alleen **Maps (your places)** en **Saved**,
   en vraag de export aan.
3. Pak het zip-bestand uit. Lijsten staan als `.csv` onder Saved, je eigen
   opgeslagen plaatsen als `.json` onder Maps.
4. Kies dat bestand in de app onder "Eigen punten importeren".

GeoJSON heeft de coördinaten erin en werkt het beste. Een CSV heeft ze niet, dus
die worden uit de links gehaald en dat lukt niet altijd. Punten zonder
coördinaten komen gewoon binnen en blijven staan tot je ze met de hand plaatst;
er wordt nooit iets weggegooid. Lukt de export helemaal niet, dan kun je de
namen ook plakken.

Nog te doen: de filters uit hoofdstuk 2 en 3, de persoonlijke lagen uit
hoofdstuk 5 en 6, de fotokaart, het stempelboek, de praktische modules, de
dagplanner en de Hanoi overstapplanner.

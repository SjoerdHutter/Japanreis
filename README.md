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

> **Eenmalig instellen.** Pages moet één keer met de hand aangezet worden,
> anders faalt de deploy met `Get Pages site failed`. Ga naar **Settings**,
> **Pages**, en kies bij **Source** voor **GitHub Actions**. Daarna draait alles
> vanzelf. De workflow kan dit niet zelf doen: een Pages-site aanmaken vraagt
> beheerdersrechten die de `GITHUB_TOKEN` niet heeft.

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
- Fase 2: de filters uit hoofdstuk 2 en 3, de waarschuwing bij vaste
  sluitingsdagen, en de geschiedenis op twee niveaus.
- Fase 3: de persoonlijke lagen. Google Maps import, Instagram collectie met de
  markering ongeverifieerd, en het bewerken van eigen punten.
- Fase 4: de fotokaart. EXIF uitlezen, de reis als doorlopende lijn, tijdbalk
  per dag, handmatig plaatsen met een voorstel, en het reisverslag.
- Fase 5: het digitale stempelboek, met tellers per stad en per type.
- Fase 6: de appgids, de JR Pass rekentool, budget met contantteller, tax free
  en bagage.
- Fase 7: de dagplanner, de reserveringsagenda en de Hanoi overstapplanner.
- Fase 8: etiquette, offline zinnen met schrift, seizoen en weer, de Hanoi
  visumcheck, je lijst delen, en de volledige offline test.

De app is daarmee compleet volgens de functiespecificatie.

- Een startset van 61 punten over zeven steden.
- Uit fase 3 naar voren gehaald: de Google Maps import, inclusief het scherm om
  een Takeout export of een geplakte lijst in te lezen.

### Een Google Maps lijst importeren

Google heeft geen manier om een lijst rechtstreeks op te vragen, ook geen
gedeelde lijst van iemand anders: er is geen openbare koppeling en de
lijstpagina is niet uit te lezen. Er moet dus een bestand aan te pas komen.

1. Gaat het om de lijst van iemand anders: open de gedeelde link in Google Maps
   en sla de lijst op, zodat hij bij je eigen opgeslagen lijsten komt te staan.
   Takeout exporteert alleen wat van jou is, dus zonder deze stap zit de lijst
   niet in de export.
2. Ga naar takeout.google.com, kies alleen **Maps (je plaatsen)** en
   **Opgeslagen**, en vraag de export aan.
3. Pak het zip-bestand uit.

Welk bestand je nodig hebt, hangt ervan af waar de plekken staan:

| Bestand                                       | Wat erin zit                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Opgeslagen/<lijstnaam>.csv`                  | Eén bestand per lijst: Favorieten, Wil ik heen, Ster, en elke lijst die je zelf gemaakt of opgeslagen hebt. **Dit is bijna altijd wat je zoekt.** |
| `Maps (je plaatsen)/Opgeslagen plaatsen.json` | Alleen losse plekken die je met de bladwijzerknop bewaarde, niet de inhoud van je lijsten.                                                        |
| `Maps (je plaatsen)/Gelabelde plaatsen.json`  | Alleen Thuis, Werk en andere labels. Meestal één of twee regels.                                                                                  |

Kies het bestand in de app onder "Eigen punten importeren".

GeoJSON heeft de coördinaten erin en werkt het beste. Een CSV heeft ze niet, dus
die worden uit de links gehaald en dat lukt niet altijd. Punten zonder
coördinaten komen gewoon binnen en blijven staan tot je ze met de hand plaatst;
er wordt nooit iets weggegooid. Lukt de export helemaal niet, dan kun je de
namen ook plakken.

Takeout vertaalt de kolomkoppen mee met de taal van je Google account, dus een
Nederlandse export schrijft `Plaats, Adres, URL` waar een Engelse `Title, Note,
URL` schrijft. Beide worden gelezen.

### Etiquette, taal en seizoen

Het schrift staat groot bij elke zin, want dat is het punt: je laat het zien aan
iemand die geen Engels spreekt. De uitspraak staat er in Nederlandse spelling
bij en niet in officiële romaji, omdat een Nederlander "sumimasen" anders leest
dan een Engelsman en het erom gaat dat het aankomt. De allergiezinnen staan apart,
inclusief de vraag naar dashi en nuoc mam, die in vrijwel alles zitten ook waar
het gerecht vegetarisch heet.

De seizoensdata zijn langjarige gemiddelden en geen voorspelling. De bloei
schuift elk jaar met de winter mee, soms tien dagen. De officiële voorspelling
verschijnt in januari en wordt tot in maart bijgesteld; die haalt de app niet op,
want offline werken gaat voor. Dat staat er in het scherm ook zo bij.

### De offline test

Er is een scripted test die de gebouwde app laadt, de service worker laat
installeren, daarna het netwerk uitzet en alle veertien schermen langsloopt met
een volledige herlaadbeurt per scherm. Hij controleert ook of de bedragen zonder
netwerk nog het euro-equivalent tonen en of iets dat je offline opslaat een
herlaadbeurt overleeft.

Draaien:

```bash
npm run build
npx http-server <map met een symlink Japanreis naar dist> -p 4174
node offline.mjs   # zie de scratchpad; het script staat niet in de repo
```

Uitkomst bij de laatste run: veertien van de veertien schermen openden zonder
netwerk, zonder paginafouten.

### De dagplanner en de overstapplanner

De dagplanner zet je gekozen punten in een looproute (naaste buur vanaf het
eerste punt) en schuift elke stop op tot hij binnen de openingstijden past. Wat
die dag gesloten is gaat eruit met de reden erbij, en wat niet meer past komt
apart te staan in plaats van stilletjes te verdwijnen.

Wat de planner niet doet is doen alsof hij het weet. Openingstijden in de content
zijn vrije tekst; waar er geen klok uit te halen valt ("Dag en nacht open") komt
er geen tijdvenster maar de opmerking dat je ze zelf moet nakijken.

De Hanoi overstapplanner rekent met 45 minuten tussen Noi Bai en het centrum,
elke kant op, een uur op de luchthaven bij aankomst en drie uur incheck voor
vertrek. Heenreis en terugreis zijn twee losse plannen met elk hun eigen punten:
op de heenreis ben je fris en wil je de oude wijk in, op de terugreis is een
koffie aan het meer genoeg.

De datum is optioneel, want vaak plan je dit voordat de vlucht vaststaat. Vul je
hem in, dan gaat het voorstel door de dagplanner en houdt het rekening met
openingstijden en sluitingsdagen. Dat scheelt: het Ho Chi Minh mausoleum sluit om
10:30 en is op maandag en vrijdag dicht.

### De JR Pass rekentool

De prijzen staan in `data/vervoer.yaml` en verouderen. De JR Pass werd in oktober
2023 in één keer ongeveer zeventig procent duurder, waardoor hij op een gewone
route van twee weken vaak niet meer uit kan terwijl bijna elke reisgids hem nog
als vanzelfsprekend aanraadt. De rekentool zegt er daarom bij dat het een
indicatie is met de prijzen die in de app staan.

### Uitgaven en contant geld

Contant en kaart worden apart geteld. Dat is niet cosmetisch: in Japan gaat veel
met kaart, maar kleine tempels, lockers, marktkraampjes en de bus willen munten.
Wie alleen een totaal bijhoudt staat op een dag zonder pinautomaat voor een
tempel die geen kaart aanneemt terwijl de app zegt dat hij ruim in het budget
zit. De contantvoorraad is een boekhouding en geen meting, en dat staat er in het
scherm ook bij.

### De fotokaart

Je foto's blijven op je toestel, in IndexedDB. Er is geen server om ze naartoe
te sturen en er komt er ook geen. Naast het origineel wordt een miniatuur van
480 pixels bewaard, want een galerij die vijftig foto's van vier megabyte
opnieuw moet decoderen legt een telefoon plat.

De reis is één lijn, niet per stad geknipt: heenreis over Hanoi, Japan, en terug
over Hanoi. Zou je per stad knippen, dan verdwijnt de vlucht uit de kaart en
ziet de reis eruit als losse eilanden.

**Over EXIF en tijdzones.** EXIF legt de tijd vast zoals hij op de camera stond,
zonder zone erbij. Een avondfoto in Kyoto van 18:30 staat dus als 18:30. Die als
UTC lezen maakt er 03:30 de volgende ochtend van, en dan verschijnt er een dag
in de tijdbalk waarop je geen enkele foto hebt gemaakt. De app bewaart daarom
twee dingen naast elkaar: de wandklok, die de dag bepaalt, en het echte moment,
dat de volgorde bepaalt ook over een tijdzonegrens heen. Het moment wordt
berekend met de zone van de stad waar de foto genomen is, en opnieuw berekend
zodra je een foto zelf op de kaart zet.

Een foto zonder GPS krijgt een voorstel op basis van de foto's eromheen in de
tijd, vergeleken op de wandklok. Ligt er niets binnen anderhalf uur, dan komt er
geen voorstel: een foto uit het midden van een vlucht van zes uur ergens
neerzetten is geen hulp maar een verzinsel.

Het reisverslag is één los HTML-bestand met de route, de dagen en de plekken, en
zonder foto's. Zo kun je het delen zonder je fotorol mee te sturen.

### Een Instagram collectie importeren

De officiële export van Instagram bevat van opgeslagen berichten alleen een link
en een tijdstip. Geen bijschrift, geen locatie, geen tip. Dat is geen
tekortkoming van de importer maar van het bestand; wie beweert die gegevens er
wel uit te halen, verzint ze.

Er zijn dus twee wegen. De ruwe `saved_posts.json` uit de export levert de links
op met het account erbij; die punten komen binnen zonder plek en wacht je af om
zelf af te maken. Sneller is het om de tips uit te schrijven en te plakken als
`plek | tip | account`, één per regel. Dat werkt ook als CSV met kolommen voor
locatie, tip, bron en link.

Alles uit Instagram krijgt de markering ongeverifieerd, want reels noemen
geregeld zaken die inmiddels gesloten of betaald zijn.

### Wat fase 2 toevoegt

Het stadsscherm heeft vier tabbladen (attracties, eten, stempels, eigen punten)
die samen één kaart delen. De kaart toont wat het filter overlaat, zodat "ramen
onder EUR 9 binnen tien minuten lopen" niet alleen een lijst is maar ook laat
zien welke kant je op moet. Elk tabblad houdt zijn eigen filter bij: één gedeeld
filter neemt een keuze als "tempel" mee naar het tabblad Eten, waar de lijst dan
leeg is zonder dat je ziet waardoor.

Het afstandsfilter heeft je locatie nodig. Zonder vertrekpunt is een looptijd
betekenisloos, dus dan staat er een knop om de locatie aan te zetten in plaats
van een filter dat stilletjes niets doet.

De waarschuwing bij sluitingsdagen rekent met de weekdag in de tijdzone van de
stad. Plan je vanaf de bank een dag in Kyoto, dan is het daar al morgen, en dan
telt de sluitingsdag van morgen.

De geschiedenis loopt twee kanten op, zoals hoofdstuk 4 vraagt. Vanaf een
attractie brengt het tijdvaklabel je naar dat tijdvak in de landtijdlijn; vanaf
een tijdvak brengt de stadsnaam je terug naar die stad, gefilterd op dat
tijdvak. Dat filter komt uit de link (`?tijdvak=edo`) en niet uit de
schermtoestand, zodat een gedeelde link hetzelfde laat zien.

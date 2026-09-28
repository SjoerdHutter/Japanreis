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
| `data/stations.yaml`        | Stationsgidsen: uitgangen, Shinkansen, overstappen |
| `data/reisdagen.yaml`       | Per reisdag welke trein of bus, en je koffer       |

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
- Fase 9: het jetlagplan, heen en terug, met een regel voor vandaag in het
  hoofdmenu.
- Fase 10: een balk onderaan elk scherm (Steden, Plannen, Budget, Taal en Meer),
  het scherm Meer met alle hulpmiddelen als tegels, een terugknop die teruggaat
  naar waar je vandaan kwam, en bij elke stad de datums uit het reisschema.
- Fase 11: de treinen. Reisdagen met een kaart in het hoofdmenu op de dag
  zelf en de avond ervoor, stationsgidsen met de uitgangen op de kaart, en de
  borden en zinnen voor op het station onder Taal.

- Mijn gegevens: verzekering, noodcontacten, medische info, reisdocumenten,
  vluchten en verblijven, met bijlagen (pdf en foto, ook HEIC) die offline over
  het hele scherm openen, een JSON sjabloon om op je laptop in te vullen, en in
  het hoofdmenu wat er nog ontbreekt. Reserveringen kregen een tijd, een
  boekingsnummer en vouchers.
- Backup en herstel: alles in één zip, via het deelvenster naar iCloud Drive,
  en weer terug met samenvoegen of vervangen.
- Nood: een zesde tab met de alarmnummers van het land van vandaag, je
  verzekering, je noodcontacten, kaarten om te tonen (ziekenhuis, apotheek,
  politie en je allergieën in het Japans of Vietnamees) en wat je doet bij een
  aardbeving of tyfoon. Plus Controleren: alle meegeleverde feiten die je voor
  vertrek moet nakijken, met een vinkje.
- Weer: de verwachting van Open-Meteo per stad en per dag, in de reisdagen
  (nu dag voor dag, elke dag van de reis) en in de dagplanner. Een regendag
  zet het regenvoorstel in de planner aan, harde wind geeft een waarschuwing.
  De planner onthoudt je keuze per dag.
- Naar je agenda: vluchten, in- en uitchecken, geboekte reserveringen en de
  kaartverkoop als .ics-bestand, met herinneringen.
- Laatste trein: de dagplanner waarschuwt als de laatste stop van een avond te
  dicht op de laatste trein naar je terugstation eindigt. Tijden kun je zelf
  aanpassen; overal in de app kun je meegeleverde waarden overschrijven met een
  eigen waarde.

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

### Het jetlagplan

Een plan per dag voor je lichaamsklok: wanneer je opstaat en naar bed gaat, en
vooral wanneer je fel licht zoekt en wanneer je het juist mijdt. Dat laatste is
het hele punt. Je lichaamsklok heeft een koudste moment in de nacht; licht in de
uren daarna zet de klok vooruit, licht in de uren ervoor zet hem terug. Wie na
een vlucht naar het oosten meteen de ochtendzon in loopt terwijl zijn lichaam
nog in de nacht zit, duwt zijn klok de verkeerde kant op.

Het plan volgt uit het reisschema en je gewone slaaptijden, die je in het scherm
invult en die op je toestel blijven:

- **Voorbereiding.** Tot drie dagen voor vertrek elke dag een uur eerder slapen
  en opstaan, met direct fel licht. Elke dag die je thuis vervroegt scheelt ter
  plaatse ongeveer een dag.
- **Onderweg.** De overstap in Hanoi rekent al naar Japan toe, in de tijd van
  Hanoi. In Japan volg je vanaf de eerste dag de lokale klok, en het licht
  schuift elke dag een uur op tot je klok gelijk loopt.
- **Terug.** Naar het westen gaat het sneller, ongeveer anderhalf uur per dag,
  met het licht in de avond. De wintertijd van 25 oktober telt mee: je lichaam
  moet dan acht uur schuiven in plaats van zeven.

Het model rekent voorzichtig: een uur per dag naar het oosten, anderhalf naar
het westen, en op reisdagen niets. Een plan dat te snel rekent stuurt je de dag
erna naar licht op het verkeerde moment. Alle lichttijden hangen aan een
schatting van het koudste moment van je nacht, drie uur voor je gewone wektijd.
Melatonine staat er alleen in als je dat aanzet. De grondslag is het werk van
Eastman en Burgess (Sleep Medicine Clinics, 2009) en de Cochrane review over
melatonine bij jetlag; het is geen medisch advies.

De vertrekdag is de dag voor de eerste dag in het reisschema, en de eerste dag
thuis de dag na de laatste. Voor een vlucht van Europa naar Azië klopt dat
altijd, want die landt de volgende dag.

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

### Mijn gegevens

Onder Meer, Mijn gegevens staat wat alleen jij weet: je verzekering en het
noodnummer, wie ze thuis moeten bellen, je allergieën en medicijnen, je
reisdocumenten, je vluchten en waar je slaapt. Niets daarvan staat in deze
repository en niets komt er ooit in; het wordt op de telefoon ingevuld en
blijft in IndexedDB. Het verlaat het toestel alleen via een export die je zelf
start, en het staat nooit in een link.

Bij bijna alles kun je bijlagen zetten: een pdf uit je mail, een foto van je
paspoortpagina, de QR-code van een ticket. Op een iPhone biedt de bestandskiezer
Foto's, de camera en Bestanden aan. Een pdf tekent de app zelf met pdf.js, alle
pagina's; een HEIC-foto uit Bestanden wordt naast het origineel ook als JPEG
bewaard, met heic2any als de browser het zelf niet kan. Beide bibliotheken zijn
groot en worden pas geladen als je ze nodig hebt, maar de service worker haalt
ze bij de installatie al binnen, zodat het ook offline werkt. Dat kost ruwweg
drie megabyte extra op het toestel.

Polisnummers en boekingscodes staan als puntjes tot je erop tikt, en gaan na een
halve minuut vanzelf weer dicht.

Alles in één keer invullen gaat met het sjabloon: download het, vul het op je
laptop in met je boekingsmails ernaast, en lees het op je telefoon weer in. Je
ziet eerst wat er nieuw is en wat verandert; pas daarna wordt er iets bewaard.
Een leeg veld in het bestand laat staan wat er al in de app stond.

### Backup en herstel

Onder Meer, Backup zet alles wat je in de app hebt gezet in één zip:
`japanreis_backup_JJJJ_MM_DD.zip`. Daarin een manifest (versie, datum en
aantallen), per onderdeel een JSON-bestand, en de foto's en bijlagen als losse
bestanden. Op een iPhone opent het deelvenster, zodat je hem met "Bewaar in
Bestanden" in iCloud Drive zet. Foto's en persoonlijke documenten kun je
weglaten; het scherm laat zien hoe groot het bestand ongeveer wordt.

Een backup bevat altijd je polisnummer en boekingsnummers, en met documenten
ook je paspoort. Bewaar hem op een plek die alleen van jou is.

Terugzetten laat eerst zien wat erin zit en wat er zou veranderen. Samenvoegen
voegt toe wat er nog niet is en vervangt een regel alleen als die in de backup
nieuwer is. Vervangen maakt eerst leeg wat in de backup zit, en vraagt je
daarvoor VERVANGEN te typen. Wat niet in de backup zit blijft staan.

Niet in de backup: de kaarttegels (die haal je opnieuw op), de wisselkoers en
het weer, en welke stad je het laatst bekeek. Een test bewaakt dat elke store
met eigen gegevens wel meegaat, zodat een nieuwe functie niet stilletjes buiten
de backup valt.

Bij het opstarten vraagt de app de browser om je gegevens niet op te ruimen.
Onder Meer staat of dat gelukt is en hoeveel ruimte de app gebruikt. Is je
laatste backup ouder dan drie dagen en is er sindsdien iets bijgekomen, dan
staat er in het hoofdmenu een herinnering.

### Nood en controleren

De tab Nood staat in de balk onderaan, dus hij is vanaf elk scherm één tik weg.
Het land van vandaag staat vooraan, volgens het reisschema; voor en na de reis
is dat Japan. Elk nummer is een knop die belt. De nummers, de ambassades en het
advies bij aardbevingen en tyfoons staan in `data/nood.yaml`; de allergenen in
het Japans en Vietnamees in `data/allergenen.yaml`; de zinnen voor de kaarten
om te tonen in `data/zinnen.yaml`.

Wat de app over de wereld beweert en wat je niet zelf hebt ingevuld, draagt
`gecontroleerd: false`. Dat zijn feiten waar je op het slechtste moment van de
reis op moet kunnen bouwen, en ze komen uit algemene kennis. De app zet er een
label "controleren" bij. Tik erop en vink "gecontroleerd" aan als je het bij de
bron hebt nagekeken; dat vinkje staat op je toestel en gaat mee in de backup.
Onder Meer, Controleren staan ze allemaal onder elkaar.

### Weer in de planner

De app haalt de verwachting op bij Open-Meteo (zonder sleutel), per stad uit het
reisschema en voor de dagen dat je er bent: minimum en maximum, kans op regen,
millimeters en de zwaarste windstoot. Dat gebeurt bij het openen van de app en
bij terugkomen, als er bereik is en de vorige keer langer dan drie uur geleden
is. De verwachting gaat in IndexedDB; zonder bereik staat erbij wanneer hij is
opgehaald. Verder dan zestien dagen vooruit staat er "nog geen verwachting",
want wat daarna komt is een gok.

De reisdagen zijn nu dag voor dag: elke dag van de reis heeft een kaart met de
stad, het weer, en de trein als je die dag verkast. De dagtrip naar de Fuji,
waarvan de datum nog openligt, staat onderaan onder "Nog zonder datum".

Een regendag is een dag met minstens zestig procent kans of minstens vijf
millimeter. Op zo'n dag houdt de dagplanner alleen wat bij regen kan (hetzelfde
filter als "bij regen" op het stadsscherm) plus het eten; wat je buiten had
gekozen staat apart onder "Bij regen overgeslagen". Eén knop zet dat uit.
Windstoten vanaf 60 km/h geven een waarschuwing, vanaf 90 km/h een rode met
het advies om het tyfoonnieuws en de treinen na te kijken. Die staat voor
vandaag en morgen ook in het hoofdmenu.

De dagplanner onthoudt per dag en per stad wat je koos, en die keuzes gaan mee
in de backup.

### Naar je agenda

Onder Meer, Naar je agenda maakt een .ics-bestand van je vluchten, het in- en
uitchecken, je geboekte reserveringen en het moment dat een kaartverkoop opent.
Alles, één dag, of alleen de kaartverkoop. Met een herinnering een dag en een
kwartier voor de kaartverkoop, drie uur voor een vlucht en een uur voor het
uitchecken.

De tijden staan in UTC in het bestand; je agenda zet ze om naar de tijd van
waar je bent. Een vlucht die om 00:15 uit Hanoi vertrekt staat zo op het goede
moment, ook als je telefoon nog op Amsterdam staat. Elke afspraak heeft een
vaste id, zodat een agenda die dat respecteert hem bij een nieuwe export
bijwerkt in plaats van verdubbelt.

Adressen en boekingsnummers gaan er alleen in als je "persoonlijke gegevens
meenemen" aanvinkt.

### De laatste trein en eigen waarden

In `data/laatste-treinen.yaml` staat per knooppunt ongeveer de laatste
praktische vertrektijd naar een station waar je 's avonds heen moet: van Gion
naar Kyoto Station, van Shibuya naar Shinjuku, van Kawaguchiko terug naar Tokio.
Een benadering, geen dienstregeling, en daarom met het label "controleren".

De dagplanner kijkt naar de laatste stop van je dag, het verblijf van die nacht
en het terugstation dat je daar in Mijn gegevens bij zette, en neemt het
knooppunt dat het dichtst bij die stop ligt. Eindigt de stop later dan een half
uur voor die trein, dan staat er een waarschuwing bij, met een knop naar Google
Maps voor de echte vertrektijden. Ligt je verblijf op loopafstand, dan zegt de
planner niets. Weet de app het niet, dan staat er "laatste trein onbekend" en
vul je de tijd zelf in.

Dat laatste is een algemene regel in de app: wat de app meebrengt en wat jij
beter weet, overschrijf je met een eigen waarde. Die staat apart op je toestel
(en in de backup), krijgt het label "eigen waarde", en met "terugzetten" ga je
terug naar wat de app meebracht. De content zelf blijft onaangeroerd.

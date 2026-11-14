# Groei-iteratie 1 — publicatiebewijs

14 november 2026. **Code op main; commerciële activering en Hostinger-productiecontrole blijven HOLD.**

De eigenaar gaf na het productplan expliciet opdracht: ‘Laten we op de main bouwen!’ Het eerste afgebakende pakket is op main ontwikkeld en gepubliceerd; dit is geen verklaring dat alle onderdelen uit concept-PR #7 gereed zijn.

## Gepubliceerde versie

Applicatiecommit: `1b11306a40712faa28bf0f4f1004569ffcf2750d`.

[GitHub-verificatie vóór publicatie, run 43604161281](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43604161281): **geslaagd**. De checks draaiden op de daadwerkelijke kandidaat vóór de consistente applicatiewijziging naar main werd gepusht. Er is niet geforceerd gepusht. De tijdelijke overdrachtsbestanden zijn verwijderd en de eenmalige overdrachtsworkflow wordt met deze notitie opgeruimd.

- Node 24-syntaxcontrole: 36 modules.
- Standaardtests: 83 totaal, 82 geslaagd, één MySQL-test in deze stap overgeslagen.
- Afzonderlijke echte MySQL 8-gate: **6 tests geslaagd, geen overgeslagen tests**, inclusief schema, gelijktijdige ontdubbeling, status/historie, rollback en de nieuwe woningadvies-/revisie-/intrekkingsproef.
- Productiebuild: 23 publieke bestanden.
- Dependency-audit: 0 kwetsbaarheden gerapporteerd tijdens deze run.
- De teruggehaalde broncode uit het verificatieartifact is voor alle 19 gewijzigde applicatie-/test-/documentatiebestanden bytegelijk vergeleken met de lokaal beoordeelde versie: gelijk.

Lokale browsercontroles en hun beperkingen staan in [GROWTH-01-2026-11-14.md](GROWTH-01-2026-11-14.md). Er is uitsluitend met synthetische lokale/CI-gegevens gewerkt, zonder SMTP-verzending of toegang tot de productiedatabase.

## Wat gebouwd is

Drie-staps woningadvies-intake met NAW en telefoon, servervalidatie, optionele scenariodeling, transactionele opslag en afzonderlijk contactbewijs. Beheer heeft verantwoordelijke/volgende actie/datum, aanvullende statussen, revisiecontrole en werkvoorraad. Intrekking blokkeert heropening en annuleert de bijbehorende wachtende mailtaken. Transactionele e-mail heeft HTML en tekst; interne meldingen verwijzen naar het afgeschermde dossier in plaats van een NAW-kopie. Contact/privacy halen de ontvangernaam uit dezelfde veilige serverconfiguratie als het formulier.

## Geen commerciële vrijgave

`HOUSING_ADVICE_ENABLED` blijft standaard false. De route vereist bovendien een expliciete ontvangernaam, `LEAD_CONTROLLER_CONFIRMED=true` en de bestaande geldige opslag-/beheervoorwaarden. Deze ontwikkelsessie heeft geen hostingvariabelen veranderd of mail verzonden. De oude standaardontvanger is niet stilzwijgend naar NIVO omgezet en historische aanvragen zijn niet doorgestuurd.

NIVO Groep Holland is de gekozen commerciële bestemming. Exacte juridische naam/rollen, daadwerkelijke ontvangerconfiguratie, SMTP/inbox/cron, rechten/bewaarbeleid en productieback-up/herstel blijven onder issues #1–#3. Main-publicatie is geen toestemming om die controles over te slaan.

Read-only webpogingen naar `https://zonlio.nl/api/health` en `/api/config` waren vanuit de agentomgeving niet toegankelijk. Dit is geen bewijs van een productiestoring. Hostinger-deployment en nieuwe health-/config-responses zijn hier dus **niet onafhankelijk bevestigd**. Er is ook geen ingelogde productie-backofficesessie uitgevoerd.

## Volgende pakketten

Accounts/Mijn Zonlio, abonnementen en double opt-in, dagelijkse stroommails, voorkeuren/afmelden/bounces, multi-user rollen en Odoo-synchronisatie zijn nog niet geïmplementeerd. Eerst de resterende P0-vrijgavechecks afronden; uitbreiding kan op main in kleine vooraf geteste stappen doorgaan. Dagmail en woningadvies krijgen afzonderlijke activeringsbesluiten. Geen nieuwe betaalde dienst is toegevoegd.

# Uitgevoerde verificatie

Datum: 14 november 2026. Deze registratie hoort bij de broncodeversie; hosting en echte mailontvangst worden afzonderlijk geverifieerd.

## Lokale controles

- `npm run check`: alle bestaande JavaScript-modules syntactisch geldig.
- `npm test`: **60 tests geslaagd**, geen fouten. De afzonderlijke MySQL-test is lokaal expliciet overgeslagen omdat hier geen MySQL-testserver is geconfigureerd. Dit omvat rekenmodellen, winter-/zomertijd, data-adapters, frontenddatacontracten, serverroutes, authenticatie, opslag en gesimuleerde mailuitval.
- `npm run build`: geslaagd; uitsluitend publieke bestanden komen in `dist`.
- `npm audit --omit=dev --audit-level=high`: geen kwetsbaarheden gevonden op het moment van deze controle.

De GitHub Actions-uitkomst wordt na de remote releasecontrole vastgelegd. De workflow start een afzonderlijke MySQL 8-service en voert de integratietest expliciet uit. Deze test weigert niet-testdatabasenamen en bestaande aanvragen.

## Betekenisvolle fout- en integratieproeven

- Eén aanvraag bij twaalf gelijktijdige herhalingen met dezelfde aanvraagcode.
- Aanvraag en wachtrij blijven bestaan na opnieuw openen van de database.
- Een fout bij het opslaan van de outbox rolt ook de aanvraag terug.
- Een SMTP-storing laat de aanvraag behouden; herstel verzendt via een testtransport.
- Geen productie-uitwijk naar SQLite wanneer MySQL ontbreekt.
- Een directe start zonder omgevingsinstellingen gebruikt productiegedrag en maakt geen lokale leadopslag.
- Beheersessies, CSRF, toegestane origin, cookie-instellingen en uitloggen.
- Ontbrekende prijsdata worden geen nullen; negatieve prijzen blijven geldig.
- Nederlandse klokwisseldagen met 92 en 100 kwartieren blijven volledig.
- Statische routes kunnen geen bronserver, database, omgevingsbestand of symlink uitleveren.
- Gebruiksevenementen vereisen actieve toestemming en accepteren geen vrije contactgegevens.

## Externe data

De daadwerkelijke servicemethode leverde op 14 november 2026 een geldige Nederlandse prijsdag met 96 kwartieren. De MET Norway-koppeling leverde een regionale verwachting met 90 tijdstappen voor Leiden. Een eerdere netwerkfout werd als niet-beschikbare data afgehandeld. Zie [DATA-SOURCES.md](DATA-SOURCES.md) voor de beperkte reikwijdte van deze proef en de bronnen.

## Openstaande verificatie op de deployment

De werkelijke Hostinger-runtime, productiedatabase, DNS/HTTPS, mailboxauthenticatie, inboxontvangst en geplande onderhoudstaak zijn nog niet bevestigd. Dit zijn afzonderlijke uitrolcontroles, geen bewijs uit de tests met testgegevens.

De gedeelde browserpreview was tijdens deze bouwronde in gebruik door een ander project. Die sessie is niet vervangen. Voor de nieuwe release zijn daarom nog geen geslaagde visuele browsercontrole of nieuwe screenshots geclaimd. De tests op data- en servergedrag blijven daarvan gescheiden.

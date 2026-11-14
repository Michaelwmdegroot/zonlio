# Zonlio — adviesaanvragen, gegevens en verzending

Versie: 14 november 2026. Dit document beschrijft de implementatie en de gegevens die de exploitant vóór productie moet bevestigen.

## Exploitant en aanvraag

De standaardcontroller is **Thuisbatterij Team B.V.**, met **info@zonlio.nl** als contactpunt voor Zonlio. De bedrijfsnaam is teruggevonden in het eigen privacybeleid van Thuisbatterij Team. Verschillende openbare contactpagina's tonen verschillende adres-/telefoongegevens; die zijn daarom niet als bevestigde Zonlio-gegevens overgenomen.

Productie accepteert pas aanvragen als MySQL beschikbaar is, beheer met `ADMIN_PASSWORD_HASH` en `SESSION_SECRET` is geconfigureerd en `LEAD_CONTROLLER_CONFIRMED=true`. Bevestig de juridische exploitant, de gegevens in de privacyverklaring en de interne ontvanger. Er vindt geen automatische overdracht aan NIVO of andere partijen plaats.

Het formulier is een gericht verzoek om advies via e-mail of telefoon. De gebruiker ziet het bedrijf, kanaal, onderwerp en de contacttekst. Alleen het gekozen contactgegeven is verplicht. Het delen van het rekenscenario is optioneel. De aanvraag is geen nieuwsbriefinschrijving en bevat geen algemene marketingtoestemming.

De contacttekst wordt serverzijdig bewaard met versie `2026-11-14-v1`. Het formulier haalt de actuele tekst op via `/api/config`. De voorgestelde contacttermijn is 30 dagen; deze termijn is bedrijfsbeleid, geen wettelijke standaard. De backoffice toont `contactExpiresAt`. Opvolging buiten het aangevraagde doel of na intrekking is niet toegestaan door alleen het bestaan van een lead.

## Wat wordt opgeslagen

- Naam, gekozen kanaal en ingevulde contactgegevens.
- Optionele postcode en vraag.
- Gekozen onderwerp en de module waar de aanvraag begon.
- Alleen na bewuste keuze: de toegestane numerieke waarden van het rekenscenario.
- Ontvangsttijd, aanvraagnummer, contacttekst, versie, verantwoordelijke onderneming en contacttermijn.
- Opvolgstatus, door een beheerder toegevoegde notities en statusgeschiedenis.
- Technische gegevens voor ontdubbeling, verzendwachtrij en beheersessies.

Contactgegevens worden niet in algemene applicatielogs of analytics opgenomen. IP-adressen worden uitsluitend tijdelijk en gehasht gebruikt voor pogingsbegrenzing; deze counters staan in procesgeheugen.

Een gebruiker kan wijziging of intrekking vragen via info@zonlio.nl. De organisatie moet dit verwerken in de backoffice en eventuele verdere dossiers. Deze release voert geen automatische verwijdering of anonimisering van echte leads uit. Leg vóór livegang bewaartermijnen en een operationele procedure voor inzage, intrekking en verwijdering vast. Een afzonderlijk beheerproces voor geautoriseerde anonimisering is een volgende implementatiestap.

## Betrouwbare ontvangst en verzending

Lead, contactbewijs en outboxtaken worden in één database-transactie geschreven. De browser krijgt alleen succes na commit. Een herhaling met dezelfde aanvraagcode en inhoud levert hetzelfde aanvraagnummer; gewijzigde inhoud met dezelfde code wordt geweigerd.

De e-mailwachtrij staat los van de ontvangst. Een SMTP-fout verwijdert geen aanvraag. Na ontvangst wordt een kleine verzendbatch geprobeerd. Een beveiligde taak op `/api/tasks/maintenance` verwerkt daarna maximaal drie taken per aanroep, inclusief geplande herhalingen. Configureer hiervoor een betrouwbare periodieke taak; er draait geen permanente timer in de webapp.

Na acht mislukte pogingen krijgt een bericht de status `failed`, zichtbaar in beheer. Een beheerder kan een begrensde nieuwe poging starten. SMTP-acceptatie wordt niet als gegarandeerde aflevering in de inbox gepresenteerd. Een stabiele Message-ID is geen garantie op exact één SMTP-aflevering bij een onduidelijke netwerkuitkomst.

Configuratie: `SMTP_HOST=smtp.hostinger.com`, `SMTP_PORT=465`, `SMTP_USER=info@zonlio.nl`, `SMTP_PASSWORD`, `LEAD_NOTIFY_TO`. Wachtwoorden staan uitsluitend in de beveiligde serverconfiguratie. Poort 465 gebruikt TLS vanaf de start met normale certificaatcontrole. `/api/admin/mail/verify` test verbinding/authenticatie zonder een e-mail te sturen.

## Database en beheer

Productie gebruikt MySQL via `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Ontbrekende instellingen leiden nooit tot een lokale productiedatabase. Ontwikkeling en tests gebruiken Node SQLite met `SQLITE_PATH`; het standaard ontwikkelpad is `data/zonlio.sqlite` en hoort buiten Git en de statische build te blijven.

Maak een beheerdershash met `node scripts/create-admin.mjs` in een interactieve terminal. Het wachtwoord wordt verborgen ingevoerd en niet afgedrukt. Stel `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` en een willekeurige `SESSION_SECRET` van minimaal 32 tekens in. Voor onderhoud is een afzonderlijke `CRON_SECRET` van minimaal 32 tekens nodig.

Beheersessies zijn serverzijdig opgeslagen en in productie gekoppeld aan een Secure, HttpOnly, SameSite=Strict cookie. Beheerwijzigingen vereisen een geldige sessie, CSRF-token en toegestane origin. `PUBLIC_URL` (of de alias `APP_URL`) bepaalt de productie-origin; aanvullende eigen origins kunnen expliciet in `ALLOWED_ORIGINS` staan. Ontbrekende beheerconfiguratie geeft geen toegang.

## Statistieken

Ruwe serverpaginaweergaven zijn geaggregeerde tellingen zonder opgeslagen IP, cookie of bezoekers-ID. Ze zijn geen telling van unieke personen en kunnen bots omvatten.

Interactiegebeurtenissen worden uitsluitend aangenomen met expliciete statistiekentoestemming. De payload accepteert alleen een gebeurtenistype, browser-tab-ID, module en `consent:true`. Het ID wordt serverzijdig gehasht; het blijft een pseudoniem, geen bewijs van anonimiteit. Per dag, tab-ID, module en gebeurtenistype wordt ontdubbeld. De primaire leadaantallen komen uit opgeslagen aanvragen, niet uit klik-events.

De frontend moet weigeren even toegankelijk maken als toestaan en geen gebeurtenissen sturen na intrekking. De actuele instelling staat los van toestemming voor een adviesgesprek. Functionele opslag en beperkte analyse hebben eigen voorwaarden; deze release gebruikt voor interactieve analyse bewust een opt-in.

## Bronnen

- [Thuisbatterij Team — privacybeleid](https://thuisbatterijteam.nl/voorwaarden-beleid/privacybeleid/)
- [AP — AVG-grondslagen, waaronder gevraagde offertes](https://autoriteitpersoonsgegevens.nl/themas/basis-avg/avg-algemeen/grondslagen-avg-uitgelegd)
- [AP — toestemming, bewijs en intrekken](https://autoriteitpersoonsgegevens.nl/themas/basis-avg/avg-algemeen/grondslag-toestemming)
- [ACM — telemarketing vanaf 1 juli 2026](https://www.acm.nl/nl/publicaties/vanaf-1-juli-strengere-regels-voor-telemarketing-alleen-nog-maar-als-klant-toestemming-heeft-gegeven)
- [ACM ConsuWijzer — spam via e-mail, sms en apps](https://consument.acm.nl/veilig-online/hoe-voorkom-ik-spam)
- [AP — cookies](https://autoriteitpersoonsgegevens.nl/nl/onderwerpen/internet-telefoon-en-tv/cookies)
- [Hostinger — e-mailconfiguratie](https://www.hostinger.com/support/4305847-set-up-hostinger-email-on-your-applications-and-devices/)
- [Nodemailer — SMTP en verbindingscontrole](https://nodemailer.com/smtp)

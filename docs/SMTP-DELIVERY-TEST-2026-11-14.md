# Test van werkelijke SMTP-verzending — 14 november 2026

De eigenaar bevestigde op 14 november via hPanel een uitgaand Hostinger-quotum van **100 berichten per rollende 24 uur**, een werkende SMTP-verbinding en een correct ingesteld applicatiebudget. Dit bewijst nog geen inboxaflevering.

## Afgeschermde e-mailproef

Vanaf deze wijziging is in `/admin#testen` een apart formulier **Echte testmail naar je eigen inbox** aanwezig. Alleen een ingelogde beheerder met geldige CSRF-token en geldige origin kan naar een bewust ingevuld en bevestigd testadres één verzendpoging starten. De code stuurt direct via dezelfde geconfigureerde Nodemailer SMTP-transportlaag als accountmails. Hij maakt geen adviesaanvraag, abonnee of campagne aan.

- Maximaal twee pogingen per uur en drie per rollende 24 uur per beheerder in het procesgeheugen; daarnaast telt elke poging mee in het **persistente gedeelde mailbudget**.
- Bij ontbrekend of ongeldig budget en bij afwijkende operatorconfiguratie blijft deze functie geblokkeerd.
- Het antwoord zegt uitsluitend **door SMTP geaccepteerd** (of een gesaneerde foutcode), nooit `afgeleverd`. Controleer zelf zowel het ontvangen bericht als spam en zo mogelijk SPF/DKIM/DMARC in de ontvangen headers.
- Geen ontvangeradres, token, bedrijfsgeheim of mailbody wordt in serverlogs of GitHub-bestanden vastgelegd. De admin-runtime onthoudt tijdelijk resultaat en tijdstip; na herstart verdwijnt dat procesbewijs.
- Accounts, commerciële leads, periodieke dagmails en Portal-export blijven afzonderlijk uitgeschakeld.

## Handleiding voor eigenaar

1. Open `https://zonlio.nl/admin#testen`, log in en ververs de controles. Controleer dat bedrijfsnaam/contact, SMTP en budget `Correct` tonen.
2. Vul een **eigen extern test-e-mailadres** in (geen wachtwoord in chat of GitHub). Vink de expliciete bevestiging aan en kies **Verstuur één testmail**.
3. Bij `SMTP geaccepteerd` verschijnt een korte testcode. Controleer of een bericht met dezelfde code in inbox of spam staat. Als het niet aankomt, meld dat; geen automatische herhaaldelijke verzending.
4. Noteer status zonder volledig e-mailadres of headers met privésleutels in het publieke issue. Controleer daarna SPF/DKIM/DMARC en de volledige abonnementsflow afzonderlijk.

## Grenzen

Dit test alleen SMTP vanuit de echte app en eventuele inboxaflevering via handmatige verificatie. Het test **niet** de transactionele lead-outbox, scheduler, herhaalpogingen, Portal-ontvangst of databaseherstel. Die vrijgavepunten blijven onder issues #1–#3.

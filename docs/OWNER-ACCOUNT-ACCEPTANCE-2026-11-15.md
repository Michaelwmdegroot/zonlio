# Mijn Zonlio — afgeschermde eigenaarstest (technische kandidaat 07)

**Datumbasis:** 15 november 2026. **Status:** in PR totdat main-CI én onafhankelijke live productiemarker `owner-qa-07-20261115` geslaagd zijn. Geen algemene accountactivering of abonnementsgerechtigdheid.

## Wat dit oplevert

Eén ingelogde Zonlio-beheerder mag met een expliciete keuze een **eigen** accountverificatielink laten aanmaken via de bestaande MySQL challenge/outbox/SMTP-keten. Er is **geen** mogelijkheid om namens een willekeurige e-mailontvanger aan te melden. Het verzoek krijgt de markering `ownerAcceptance`, gebruikt het huidige beheeradres en de bestaande anti-spamlimieten.

**Beperkingen zijn hard:** de publieke `/api/member/login` en `/api/member/subscribe` blijven 503 zolang hun bestaande flags uitstaan. De nieuwe API `POST /api/admin/acceptance/member-login` vereist de bestaande beheerlogin, CSRF, uitsluitend `{ "confirmed": true }` en maximaal drie verzoeken per 24 uur. Alleen de speciaal gemarkeerde, ongeldige/ongebruikte eigenaarlink kan ondanks de gesloten publieke accountflag worden bevestigd; bevestiging blijft een **bewuste POST** van de linkhouder op `/mijn`, niet op basis van GET/link-preview. Openstaande links van andere gebruikers worden niet naar buiten gestuurd of geannuleerd door deze eigenaarstest.

Een accounttest is **geen** dagmailtoestemming, marketingtoestemming of advieslead. Geen automatische abonnees of dagelijkse e-mail. De bestaande `MAIL_SEND_PAUSED` en het gedeelde mailbudget blijven gelden; een succesvolle SMTP-acceptatie garandeert geen inboxontvangst.

## Veilig doorlopen in productie (alleen bevoegde eigenaar)

1. Verifieer de nieuwste externe productiemarker `owner-qa-07-20261115`, algemene flags `MEMBER_ACCOUNTS_ENABLED=false`, `DAYMAIL_SIGNUP_ENABLED=false`, `DAYMAIL_SEND_ENABLED=false`, `LEAD_ENABLED=false`, `HOUSING_ADVICE_ENABLED=false` en `PORTAL_EXPORT_ENABLED=false`.
2. Log via eigen beveiligde browser in op `https://zonlio.nl/admin` en open **Mijn Zonlio · eigen accounttest**. Vink expliciet de eigen-testverklaring aan en stuur maximaal eenmaal.
3. Controleer **zelf** de eigen beheermailbox/spam. Alleen een daadwerkelijke ontvangst van een bericht met het prefix `[TEST]` bewijst inboxontvangst. Testlink, linktoken, mailheaders met privégegevens en accountinhoud **niet** publiceren in GitHub, chat of screenshots. Als verzending gepauzeerd is, claim geen ontvangst.
4. Open link in de browser. Op `/mijn` moet expliciete bevestiging nodig zijn; niet vooraf automatisch een sessie krijgen. Na bevestiging: eigen profiel bewaren, eventueel persoonlijke dagplannen ophalen, opnieuw inloggen met een nieuwe geldige link, verlooptijd/hergebruik aantonen, export en eventueel profiel verwijderen. **Let op:** verwijderen is een echte accountactie; controleer bij het eigen testaccount wat je wist.
5. Controleer dat bezoekers nog steeds geen publieke login of inschrijving krijgen en dat de eigenaarstest geen advieslead of dagmailabonnement heeft gemaakt.
6. Leg in GitHub uitsluitend geanonimiseerde uitkomsten vast: release, onafhankelijk getoetste tijd, ontvangen **ja/nee**, bewuste bevestiging **ja/nee**, hergebruik geweigerd **ja/nee**, profieloperaties **ja/nee**. Markeer geen volledige dagmail-E2E zonder aparte double-opt-in, echt verzonden dagplan en opt-out-verificatie.

## Wat nog afzonderlijk moet gebeuren

De productiebevestiging voor een volledig dagplan met expliciete **double opt-in**, avond-/ochtendmail, actuele marktprijzen, RFC8058 one-click-afmelding, mailbox-authenticatie, bounces en daadwerkelijk stopproces vereist een apart geautoriseerd account-/dagmailacceptatietraject. Geen publieke flags aanzetten om de login-eigenaarstest makkelijker te maken. Zie [issue #9](https://github.com/Michaelwmdegroot/zonlio/issues/9), [Release 06](RELEASE-06-EVIDENCE-2026-11-15.md) en [algemene P0-eigenaaracceptatie](OWNER-ACCEPTANCE-06-2026-11-15.md).

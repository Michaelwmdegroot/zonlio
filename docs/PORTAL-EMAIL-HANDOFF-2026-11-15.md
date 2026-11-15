# Zonlio → NIVO interne e-mailroutering (overdracht aan Portal-team)

**Besluit eigenaar 15 november 2026:** de interne behandeling door Pim/NIVO vindt buiten het Zonlio-ontwikkeltraject plaats. De adviesmeldingen van Zonlio zijn bestemd voor **`portal@nivogroepholland.nl`**. De eigenaar laat de verdere intake/opvolging door een andere NIVO Portal-agent afhandelen.

## Scope: wat Zonlio wel en niet levert

- **Eén interne notificatie per geldige adviesaanvraag:** uit de bestaande transactionele MySQL-outbox naar de intern ingestelde `LEAD_NOTIFY_TO`; bij ontbrekende variabele is de fallback vanaf deze codewijziging `portal@nivogroepholland.nl`.
- **Eén afzonderlijke aanvragersbevestiging:** gaat direct naar het e-mailadres van de aanvrager, **niet** naar de Portal-mailbox.
- **Afzender, privacycontact en juridisch verantwoordelijke:** `info@zonlio.nl` blijft de uitgaande SMTP-account/het publieke privacycontact en NIVO Groep Holland BV blijft verantwoordelijk. Het aanpassen van het **interne routeringsadres** verandert geen publieke contacttekst, toestemming of juridische entiteit.
- **Payloadbegrenzing:** interne e-mail bevat onderwerp, contactkanaal, aanvraagtype, tijd, referentie en een link naar het **beveiligde** Zonlio-dossier. Geen onbeveiligde volledige NAW/woningdetails, scenario of consentbewijs in de body. Bestaande `Reply-To` kan het aanvragersadres bevatten; behandel headers eveneens als persoonsgegevens. Het openen van een adminlink vereist de bestaande bevoegdheden.
- **Geen Portal/Odoo-integratie door Zonlio:** `PORTAL_EXPORT_ENABLED=false` blijft verplicht. Een ontvangen e-mail is **geen** bewijs van automatische Portal-ingestie, API-ack, verkoopcontact of Odoo-verwerking. Die integratie en de bevoegdheden vallen uitdrukkelijk bij de afzonderlijke Portal-agent.
- **Bestaande Pim-werkvoorraad blijft technisch bewaard**, maar is vanaf nu geen blokkerende Zonlio-ontwikkeltaak. NIVO bepaalt zelf de praktische medewerkerstoewijzing en toegangsrechten. Verwijder bestaande dossiers/volghistorie niet.

## Eenmalige operationele Hostinger-handeling

De productieomgeving gebruikt mogelijk al een expliciete `LEAD_NOTIFY_TO=info@zonlio.nl`, die **voorrang heeft op de nieuwe codefallback**. Daarom kan een GitHub-merge alleen niet garanderen dat de nieuwe interne ontvanger actief is.

In de **bestaande** Node.js 24-appconfiguratie van `zonlio.nl`:

```dotenv
LEAD_NOTIFY_TO=portal@nivogroepholland.nl
```

Sla op en laat dezelfde appconfiguratie herladen via de normale Hostinger-herstart of redeploy. **Geen** verandering aan `SMTP_USER`, `SMTP_PASSWORD`, `LEAD_CONTROLLER_EMAIL`, `MAIL_SEND_PAUSED`, `SMTP_DAILY_LIMIT` of de bestaande cronjob; voeg geen tweede SMTP-account toe. Zet zeker geen publieke leads, accounts, dagmails of Portal-export aan als bijeffect.

De beveiligde `https://zonlio.nl/admin` toont onder **Verbindingen → Interne NIVO-meldingen** de **daadwerkelijk geladen** ontvanger. Als daar nog `info@zonlio.nl` staat, is de Hostinger-runtime niet omgezet en is deze routering **nog niet live bewezen**. Geen ruwe `.env`, wachtwoorden of klantgegevens posten.

## Acceptatiebewijs, zonder onnodige nieuwe tests

- [x] De oude eigenaarstest leverde daadwerkelijk **twee** mails op (eigen klantbevestiging plus interne mail naar de toenmalige NIVO-inbox). Zie [Release-09-evidence](RELEASE-09-EVIDENCE-2026-11-15.md). Dit bewijst de **algemene** SMTP/outboxketen, niet de nieuwe ontvanger.
- [ ] GitHub Node24/MySQL8/Chromium/WebKit groen na deze routeringswijziging.
- [ ] Onafhankelijke live public read-only GET herkent de nieuwe releasemarker en de publieke/Portal-gates blijven uit.
- [ ] In beveiligd beheer is `notificationRecipient=portal@nivogroepholland.nl` waargenomen **nadat** hPanel de instelling daadwerkelijk heeft geladen.
- [ ] Één geautoriseerde volgende test- of echte NIVO-notificatie is in de **Portal-mailbox** werkelijk ontvangen (controle door de bevoegde NIVO/Portal-beheerder). Geen kopie van de privé-payload in GitHub. Vermijd herhaald dezelfde lead aanmaken.
- [ ] De afzonderlijke Portal-agent bepaalt formeel welke beperkte gegevens, authenticatie en opslagregels voor zijn intakeproces noodzakelijk zijn; niet stilzwijgend contactrechten of marketingtoestemming afleiden uit een mail.

## Werkafspraken voor opvolgende Zonlio-agent

Laat de werkvoorraad-, mail-, quota-, idempotentie- en privacylogica bestaan. Besteed geen volgende Zonlio-bouwfase aan personeelsrollen voor Pim of directe Odoo/Portal-ingestie. Werk parallel verder aan betrouwbaarheid van de gratis rekentools, Mijn Zonlio/dagmail-E2E, conversie, SEO, foutdiagnose en de nog open afzonderlijke productie-/privacyacceptaties. **Geen commerciële GO uit een codecommit afleiden.**

# Zonlio → NIVO interne e-mailroutering (overdracht aan Portal-team)

**Besluit eigenaar 15 november 2026:** de interne behandeling door Pim/NIVO vindt buiten het Zonlio-ontwikkeltraject plaats. De adviesmeldingen van Zonlio zijn bestemd voor **`portal@nivogroepholland.nl`**. De eigenaar laat de verdere intake/opvolging door een andere NIVO Portal-agent afhandelen.

## Scope: wat Zonlio wel en niet levert

- **Eén interne notificatie per geldige adviesaanvraag:** uit de bestaande transactionele MySQL-outbox naar de intern ingestelde `LEAD_NOTIFY_TO`; bij ontbrekende **of exact historische** `LEAD_NOTIFY_TO=info@zonlio.nl`-waarde is de effectieve route vanaf deze codewijziging `portal@nivogroepholland.nl`.
- **Eén afzonderlijke aanvragersbevestiging:** gaat direct naar het e-mailadres van de aanvrager, **niet** naar de Portal-mailbox.
- **Afzender, privacycontact en juridisch verantwoordelijke:** `info@zonlio.nl` blijft de uitgaande SMTP-account/het publieke privacycontact en NIVO Groep Holland BV blijft verantwoordelijk. Het aanpassen van het **interne routeringsadres** verandert geen publieke contacttekst, toestemming of juridische entiteit.
- **Payloadbegrenzing:** interne e-mail bevat onderwerp, contactkanaal, aanvraagtype, tijd, referentie en een link naar het **beveiligde** Zonlio-dossier. Geen onbeveiligde volledige NAW/woningdetails, scenario of consentbewijs in de body. Bestaande `Reply-To` kan het aanvragersadres bevatten; behandel headers eveneens als persoonsgegevens. Het openen van een adminlink vereist de bestaande bevoegdheden.
- **Geen Portal/Odoo-integratie door Zonlio:** `PORTAL_EXPORT_ENABLED=false` blijft verplicht. Een ontvangen e-mail is **geen** bewijs van automatische Portal-ingestie, API-ack, verkoopcontact of Odoo-verwerking. Die integratie en de bevoegdheden vallen uitdrukkelijk bij de afzonderlijke Portal-agent.
- **Bestaande Pim-werkvoorraad blijft technisch bewaard**, maar is vanaf nu geen blokkerende Zonlio-ontwikkeltaak. NIVO bepaalt zelf de praktische medewerkerstoewijzing en toegangsrechten. Verwijder bestaande dossiers/volghistorie niet.

## Fast-lane: bekende Hostinger-waarde migreert automatisch

Deze release voorkomt een extra Hostinger-configuratieronde:

- Als `LEAD_NOTIFY_TO` ontbreekt, wordt de interne NIVO-notificatie verzonden naar `portal@nivogroepholland.nl`.
- Als de Hostinger-app nog expliciet de **bekende vorige ontvanger** `LEAD_NOTIFY_TO=info@zonlio.nl` heeft, zet de runtime die oude route automatisch om naar `portal@nivogroepholland.nl`.
- **Een andere expliciete `LEAD_NOTIFY_TO` behoudt voorrang.** Alleen in dat bijzondere geval is een eenmalige hPanel-wijziging naar `portal@nivogroepholland.nl` nodig om de nieuwe bestemming te kiezen.

Niet wijzigen: `SMTP_USER`, `SMTP_PASSWORD`, `LEAD_CONTROLLER_EMAIL`, `MAIL_SEND_PAUSED`, `SMTP_DAILY_LIMIT`, bestaande cron en uitgeschakelde publieke/Portal-gates. Voeg geen tweede SMTP-account toe.

In beveiligd `https://zonlio.nl/admin` toont **Verbindingen → Interne NIVO-meldingen** het **daadwerkelijk gebruikte** adres. Zodra daar `portal@nivogroepholland.nl` staat, is de runtime-routering aantoonbaar effectief, zonder secrets of volledige `.env` te delen. De nieuwe code zelf bewijst nog **geen ontvangst in de externe Portal-mailbox**.

## Acceptatiebewijs, zonder onnodige nieuwe tests

- [x] De oude eigenaarstest leverde daadwerkelijk **twee** mails op (eigen klantbevestiging plus interne mail naar de toenmalige NIVO-inbox). Zie [Release-09-evidence](RELEASE-09-EVIDENCE-2026-11-15.md). Dit bewijst de **algemene** SMTP/outboxketen, niet de nieuwe ontvanger.
- [ ] GitHub Node24/MySQL8/Chromium/WebKit groen na deze routeringswijziging.
- [ ] Onafhankelijke live public read-only GET herkent de nieuwe releasemarker en de publieke/Portal-gates blijven uit.
- [ ] In beveiligd beheer is `notificationRecipient=portal@nivogroepholland.nl` waargenomen **na deze code-uitrol** (of na eventuele handmatige correctie van een afwijkende custom override).
- [ ] Één geautoriseerde volgende test- of echte NIVO-notificatie is in de **Portal-mailbox** werkelijk ontvangen (controle door de bevoegde NIVO/Portal-beheerder). Geen kopie van de privé-payload in GitHub. Vermijd herhaald dezelfde lead aanmaken.
- [ ] De afzonderlijke Portal-agent bepaalt formeel welke beperkte gegevens, authenticatie en opslagregels voor zijn intakeproces noodzakelijk zijn; niet stilzwijgend contactrechten of marketingtoestemming afleiden uit een mail.

## Werkafspraken voor opvolgende Zonlio-agent

Laat de werkvoorraad-, mail-, quota-, idempotentie- en privacylogica bestaan. Besteed geen volgende Zonlio-bouwfase aan personeelsrollen voor Pim of directe Odoo/Portal-ingestie. Werk parallel verder aan betrouwbaarheid van de gratis rekentools, Mijn Zonlio/dagmail-E2E, conversie, SEO, foutdiagnose en de nog open afzonderlijke productie-/privacyacceptaties. **Geen commerciële GO uit een codecommit afleiden.**

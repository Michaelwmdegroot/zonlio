# Zonlio Release 08 — gerichte P0-herstelveiligheid en bewijsgrenzen

**Datum:** 15 november 2026, Europe/Amsterdam. **Technische status:** Release 08 **daadwerkelijk LIVE geverifieerd** na PR #26 en #27; de overige P0-productieacceptatie en commerciële lancering staan **HOLD**. Dit bewijsregister vervangt de historische Release 07 niet; [fase-07-handoff](HANDOFF-PHASE07-CLOSEOUT-2026-11-15.md) blijft de functionele basis.

## Werkelijk uitgevoerde codewijziging

- [PR #26](https://github.com/Michaelwmdegroot/zonlio/pull/26) is gemerged als [`b8eb69688fad162cc1ad34062f8681cb252e1ef3`](https://github.com/Michaelwmdegroot/zonlio/commit/b8eb69688fad162cc1ad34062f8681cb252e1ef3).
- `scripts/verify-restore.mjs` voert striktere, nog steeds uitsluitend **read-only** vergelijkingen uit: geen missende abonnee-/subscriptionstop, geen teruggedraaide `unsubscribed` naar `paused`, geen oudere stoprevisie en geen via ander member-ID heractiveerd adres met dezelfde hash.
- Restorecontrole weigert nu zowel `SMTP_PASSWORD` als alternatieve `SMTP_PASS` als die in de herstelomgeving zijn overgenomen.
- `tests/privacy.test.mjs` dekt bovenstaande herstelvarianten met uitsluitend synthetische gegevens. [Privacyrunbook](PRIVACY-OPERATIONS.md) legt de strengere HOLD-uitkomst uit.
- De release-identiteit `p0-restore-guard-08-20261115` is onafhankelijk **na Hostinger-deploy** waargenomen via [productiecontrole 43740063602](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43740063602).

## Nieuw bewezen na samenvoegen van release 08

| Controlegegeven | Bron en exacte uitslag |
| --- | --- |
| `main`-SHA | [`bc7be0bc6088e08cf1c65e27c88241aa68b214e0`](https://github.com/Michaelwmdegroot/zonlio/commit/bc7be0bc6088e08cf1c65e27c88241aa68b214e0), inclusief release-P0-privacyfix en documentatie |
| CI huidige main-app/echte MySQL8 | [Run 43739970504](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43739970504) — **SUCCESS** |
| CI huidige main-browseracceptatie | [Run 43739970592](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43739970592) — **SUCCESS** Chromium en WebKit |
| Independente live-productie | [Run 43740063602](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43740063602), gecontroleerd **2026-11-15 17:15:32 UTC**: `expectedRelease=observedRelease=p0-restore-guard-08-20261115`, `releaseMatches=true`, `publicChecksPassed=true` (alle 23 GETs), `databaseReady=true` |
| Publieke consent-/commerciële gates bij die GET | `leadEnabled=false`, `housingAdviceEnabled=false`, `accountsEnabled=false`, `subscriptionsEnabled=false`, `dailySendEnabled=false`, `portalExportEnabled=false` |
| Onafhankelijke actuele cronwatch | [Run 43740094311](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43740094311), gecontroleerd **2026-11-15 17:15:46 UTC**: `heartbeatFresh=true`, `monitoredCronStatus=current`, `databaseReady=true`, `sourcesReady=true`, `lastMaintenanceAt=2026-11-15T17:10:03.073Z` |

De succesvolle observer/cronwatch zijn echte publieke read-only productiecontroles na merge. **Geen** bewijs van een bewust door eigenaar uitgevoerde appherstart, van dezelfde testreferentie voor/na die herstart, van twee daaropvolgende geplande ticks, van een echte afzonderlijke restore of van ontvangen lead-/accountmail. Onderscheid een normale deploy van een gecontroleerde restartproef.


## Reeds onafhankelijk verkregen bewijs

| Onderdeel | Werkelijke bron | Uitkomst / grens |
| --- | --- | --- |
| PR #26 Node 24, synthetische tests, echte MySQL 8 en build | [Check application 43738806889](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43738806889) | SUCCESS; MySQL-CI is geen Hostinger-databaseherstel |
| PR #26 browseracceptatie | [Consumer browser acceptance 43738806945](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43738806945) | SUCCESS voor Chromium en WebKit, uitsluitend synthetische flows |
| Eerste `main`-check na PR #26 | [Check application 43739163581](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43739163581) | SUCCESS |
| Laatste in deze fase gelezen operationele bewaking | [Observe Zonlio operations 43736407235](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43736407235) op 2026-11-15 16:36:28 UTC | SUCCESS; databaseReady=true, sourcesReady=true, heartbeatFresh=true, monitoredCronStatus=current, lastMaintenanceAt=2026-11-15T16:35:01.871Z |
| Voorafgaand aan PR #26 live waargenomen publieke gates | [Production observation 43668460201](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43668460201) | Alle vijf commerciële routes en Portal-uitvoer uit; hercontrole na nieuwe marker vereist |
| Interne NIVO-inbox | Bevoegde Hostinger Mail-verbinding; alleen-lezen gecontroleerd 15 november | Toegang bevestigd; een nieuwe echte owner-acceptatieaanvraag met beide inboxafleveringen is **niet** bewezen; geen privéberichten, adressen of headers in dit register |

**Geen bewijs van:** een werkelijk ingestuurde eigenaarstestaanvraag, daadwerkelijke klant- en NIVO-mailontvangst, MySQL-inhoud na bewuste Hostinger-appherstart, twee nieuwe ticks na die herstart, afzonderlijke echte Hostinger-backuprestore, ondertekende privacy-/salesbesluiten, menselijke incidentmailontvangst of echte dagmail-double-opt-in.

## Afzonderlijke actuele acceptatiepoorten

- [ ] **P0-A:** één eigen NIVO-lead via beveiligd `/admin`, eigen dossier-ID, Pim/consent/outbox en beide werkelijke inboxontvangsten, revisie/intrekking/rechten gecontroleerd.
- [ ] **P0-B:** bewust uitgevoerde Hostinger-appherstart, bestaand dossier teruggevonden en twee opeenvolgende geplande ticks; externe monitor nadien groen.
- [ ] **P0-C:** werkelijke bestaande Hostinger-MySQL-back-up naar **een aparte** DB; `scripts/verify-restore.mjs` met actuele privé-recovery-manifest uitgevoerd; geschoond resultaat `privacyReconciled:true`.
- [ ] **P0-D:** bevoegd NIVO-besluit over bewaartermijnen, contactbeleid, NAW-bevoegdheden, Pim-vervanger en incidentverantwoordelijke.
- [ ] **P0-E:** uitdrukkelijke, **afzonderlijke** eigenaarvrijgave per `LEAD_ENABLED`, `HOUSING_ADVICE_ENABLED`, `MEMBER_ACCOUNTS_ENABLED`, `DAYMAIL_SIGNUP_ENABLED`, `DAYMAIL_SEND_ENABLED` na geaccepteerde E2E; tot dan uit. `PORTAL_EXPORT_ENABLED=false` blijft verplicht.
- [ ] **P1:** echte Mijn Zonlio-/dagmail-/unsubscribe-/SPF-DKIM-DMARC-/bounce-E2E en daarna conversie/SEO op echte metingen.

**Safety:** geen productieformulier openbaar aangezet, geen bestaande cron opnieuw aangemaakt, geen appmail verstuurd, geen persoonsgegevens in GitHub en geen bedrijfsklare GO geclaimd. Doorgaan via [eigen leadtest](OWNER-ACCEPTANCE-06-2026-11-15.md), [eigen accounttest](OWNER-ACCOUNT-ACCEPTANCE-2026-11-15.md), [operationsrunbook](AUTONOMOUS-OPERATIONS.md), [privacyherstel](PRIVACY-OPERATIONS.md) en [masterchecklist](COMPLETION-MASTER-CHECKLIST-2026-11-14.md).

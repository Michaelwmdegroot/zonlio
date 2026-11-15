# Zonlio — release 05 eindstand en bewijsregister

**Peildatum:** 15 november 2026 (Europe/Amsterdam). Code `main`: `396d19fc8fde5890e043e94624d13e5166b6a096` vóór overdrachtsdocs. Releasemarker `nivo-workbench-05-20261115`. **Eindoordeel: technische release LIVE, commerciële livevrijgave HOLD.**

## Releasepad

| PR | Werk | Gecontroleerd |
| --- | --- | --- |
| [#13](https://github.com/Michaelwmdegroot/zonlio/pull/13) | Autonomie, privacy, account-/mailfixes, SEO en Portal-contract. | Release 04-code/CI in [AUTONOMY-04-RELEASE-2026-11-14.md](AUTONOMY-04-RELEASE-2026-11-14.md). |
| [#14](https://github.com/Michaelwmdegroot/zonlio/pull/14) | Hostinger `hbuilds/current`-symlink voorkomt stille no-op van cron CLI; regressie. | Tests + latere productie-heartbeat. |
| [#15](https://github.com/Michaelwmdegroot/zonlio/pull/15) | Interne Pim-review bij NIVO-instroom; beveiligde `Nu opvolgen`-werkvoorraad. | Node/MySQL/browsers groen, administratief asset live. |
| [#16](https://github.com/Michaelwmdegroot/zonlio/pull/16) | Release-ID 05 + extra assetcheck in read-only productieobservatie. | 22/22 GET-probes. |
| [#17](https://github.com/Michaelwmdegroot/zonlio/pull/17) | Onafhankelijke watch rapporteert werkelijk opgeslagen maintenance-heartbeat. | Synthetische regression + echte publieke monitor-uitvoer. |

## Exacte bewijsverwijzingen

- [Main Check application 43655995233](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43655995233): **success** (incl. echte MySQL8-integratie, build/audit).
- [Main Consumer browser acceptance 43655995243](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43655995243): **success**, Chromium en WebKit; synthetische data/fake SMTP.
- [Main Observe public deployment 43656090276](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43656090276): **success**, release `nivo-workbench-05-20261115`, **22/22 read-only probes**, het nieuwe admin JS-bestand gevonden, DB/admin/mail gereed. De live gates bleven uit.
- [Main Observe Zonlio operations 43656137432 (poging 2)](https://github.com/Michaelwmdegroot/zonlio/actions/runs/43656137432): **success**, `maintenanceRecorded:true`, laatste succes `2026-11-15T00:00:02.878Z`, controle `00:02:45 UTC`; `cronExpected:false`. De eerste poging gaf tweemaal `HEALTH_UNAVAILABLE`; latere succesvolle rerun neemt dat signaal niet weg.
- Eigenaarbevestiging: Hostinger-cron ingericht op `*/5 * * * *`; echte aparte SMTP-testmail ontvangen; hPanel `MAIL_SEND_PAUSED=true` gemeld, maar eerdere live beheerstatus `Beschikbaar`. Effectieve runtimepauze daarom niet bewezen; niet als nieuwe voltooiingsclaim tellen.

## Openstaande acceptatie

1. Minimaal **drie geplande succesvolle ticks**, waaronder **twee ná gecontroleerde appherstart**; aanzetten `OPS_EXPECT_CRON=true` wanneer bewezen. Eén tick is nog geen autonoom continuïteitsbewijs.
2. Één echte geautoriseerde NIVO-aanvraag met dossieropslag, interne + klantmailontvangst, Pim-opvolging en intrekking; daarnaast account/dagmail/double-opt-in/afmelden op productie.
3. Privacypolicy en bewaarbeleid bekrachtigen; back-up naar aparte MySQL-db **herstellen en read-only inspecteren**, niet op productie terugzetten.
4. Alertontvangst, async bounces/klachten en NIVO-fallback/rollen besluiten; geen personeelsinlog delen.
5. SEO-indexatie/CWV/fysieke Safari en funnelprestaties meten waar data bestaat.
6. Commerciële flags **afzonderlijk expliciet eigenaar-GO**, gecontroleerd activeren en live eindacceptatie.
7. Portal export **uit** laten totdat de Portal-ontvanger gereed is; Zonlio-kant contract v1 is afgerond.

**Actuele instructie voor nieuwe agent:** [HANDOFF-FINALIZATION-2026-11-15.md](HANDOFF-FINALIZATION-2026-11-15.md) en [NEXT-GPT6PRO-START-2026-11-15.md](NEXT-GPT6PRO-START-2026-11-15.md). Oude release04/2026-11-14-documenten blijven historisch en bevatten oude openstaande croninstallatiepunten.

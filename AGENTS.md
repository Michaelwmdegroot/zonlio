# Zonlio — afspraken voor verdere ontwikkeling

Lees eerst `docs/PILOT-HANDOFF-2026-11-14.md` en de actuele QA-/release-notities. Bestaande Node 24 / Express / MySQL-architectuur behouden. `main` kan automatisch naar Hostinger deployen. De eigenaar heeft op 14 november 2026 expliciet gevraagd op `main` verder te bouwen. Werk vanaf de actuele main-commit, test een afgebakende wijziging vóór publicatie, gebruik een atomische commit en nooit een force-push. Een ontwikkelopdracht is geen toestemming voor commerciële activering.

## Design is een gedeeld contract

- De eigenaar koos op 14 november 2026 voor de aangeleverde lichte Apple/Mac-referentie en Zonlio Brand Kit. Lees `docs/DESIGN-SYSTEM.md`.
- `src/design-system.css` is de visuele bron van waarheid. Gebruik semantische tokens, bestaande kaart-/knop-/formuliercomponenten en het goedgekeurde SVG-logo. Geen onafhankelijke thema's per scherm.
- Elke pagina laadt de centrale stylesheet na de eigen structurele stylesheets. Controleer desktop en minimaal 320/375/390 px.
- Houd prijsdata, contractaannames en scenario's uit elkaar. Een ontwerp is geen excuus voor verzonnen prijzen, automatische apparaatsturing of gegarandeerde opbrengsten.
- Previewdata horen uitsluitend in de offline reviewgenerator onder `scripts/`, nooit in `src/`, `public/` of productieresponses.

## Veilig blijven

Geen geheimen of persoonsgegevens in Git, screenshots of issues. Geen nieuwe betaalde diensten. Leadopvang blijft uit tot de P0-controles én expliciet eigenaarakkoord; een visuele goedkeuring is geen akkoord voor commerciële activatie.

Voer `npm run check`, `npm test`, `npm run build` en relevante MySQL-integratietests uit. Noteer of bewijs lokaal, gesimuleerd, CI, eigenaargerapporteerd of daadwerkelijk productie is. Werk documentatie bij na iedere substantiële fase.

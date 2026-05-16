# MINNIO – KOMPLETT SYSTEMOVERSIKT

Dette er alle filene som skal ligge på GitHub. Hvis én mangler, virker ikke
den tilhørende funksjonen.

## DE TRE SIDENE DINE (det du åpner i nettleser)

| URL | Fil | Hva den gjør |
|-----|-----|--------------|
| minnio.app/admin.html | public/admin.html | Opprett samtale, få lenke til forteller |
| minnio.app/dashboard.html | public/dashboard.html | Bok-barometer: se alle samtaler, lag bøker |
| minnio.app/s/XXXX | public/s/index.html | Selve samtalen (det forteller åpner) |

Admin-siden har nå en knapp øverst som tar deg til dashboardet.
Dashboardet krever admin-nøkkel (miljøvariabel MINNIO_ADMIN_KEY,
standard "minnio2026" hvis ikke satt).

## API-FILENE (usynlige, gjør jobben i bakgrunnen)

| Fil | Ansvar |
|-----|--------|
| api/chat.js | Minnas svar (Claude) |
| api/tts.js | Tekst til tale (ElevenLabs) |
| api/stt.js | Tale til tekst (ElevenLabs) |
| api/clean-transcript.js | Rydder rå tale før Minna hører den |
| api/analyze.js | Bakgrunns-agent: fyller bok-barometeret |
| api/compose-book.js | Bok-redaktør: lager ferdig boktekst |
| api/_chapters.js | De 12 bokkapitlene (ryggraden) |
| api/sessions-overview.js | Data til dashboardet |
| api/session/create.js | Lager ny samtale |
| api/session/[id].js | Henter/lagrer samtale |

## KONFIGFILER

| Fil | Ansvar |
|-----|--------|
| vercel.json | URL-routing |
| package.json | Avhengigheter |

## MILJØVARIABLER I VERCEL (Settings → Environment Variables)

Disse MÅ være satt, ellers feiler ting:
- ANTHROPIC_API_KEY
- ELEVENLABS_API_KEY
- KV_REST_API_URL (fra Upstash)
- KV_REST_API_TOKEN (fra Upstash)
- MINNIO_ADMIN_KEY (valgfri – passord til dashboardet)

## SLIK BRUKER DU SYSTEMET (manuell pilot)

1. Gå til minnio.app/admin.html
2. Fyll inn forteller-info, klikk "Opprett samtale"
3. Kopier lenken eller SMS-teksten, send til fortelleren
4. Fortelleren snakker med Minna
5. Gå til minnio.app/dashboard.html (knapp i admin)
6. Logg inn med admin-nøkkel
7. Se barometeret fylles. Når en samtale er rik nok:
8. Klikk "📖 Lag bokutkast" på den samtalen
9. Les boka, kvalitetssikre

## STATUS PÅ FUNKSJONER

FERDIG OG FUNGERER:
- Samtale med stemme (Minna snakker og lytter)
- Lenke-generering
- Transkripsjonsrydding
- Bakgrunns-analyse
- Bok-barometer
- Bok-tekstgenerering (vises i dashboard)

IKKE BYGD ENNÅ:
- PDF-nedlasting fra dashboard (boka vises, kan ikke lastes ned)
- Bildeopplasting i boka
- Betaling (Stripe) – gjøres manuelt i pilot
- Automatisk SMS – sendes manuelt i pilot
- Kalibrering av barometer (viser for lave tall – kjent feil)

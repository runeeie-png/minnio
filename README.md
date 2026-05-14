# Minnio – Deploy til Vercel

## Prosjektstruktur
```
minnio/
├── api/
│   └── chat.js        ← Backend som kaller Claude API
├── public/
│   └── index.html     ← Selve appen
├── vercel.json        ← Vercel-konfig
└── README.md
```

## Steg-for-steg deploy

### 1. Opprett GitHub-konto (hvis du ikke har)
- Gå til github.com og registrer deg gratis

### 2. Last opp prosjektet til GitHub
- Gå til github.com/new
- Gi repo navnet "minnio"
- Last opp alle filene (dra og slipp)

### 3. Opprett Vercel-konto
- Gå til vercel.com
- Logg inn med GitHub-kontoen din

### 4. Deploy
- Trykk "New Project" i Vercel
- Velg "minnio" repo fra GitHub
- Trykk Deploy – Vercel oppdager vercel.json automatisk

### 5. Legg til API-nøkkel
- I Vercel: gå til Project → Settings → Environment Variables
- Legg til:
  - Name: ANTHROPIC_API_KEY
  - Value: din API-nøkkel fra console.anthropic.com
- Trykk Save og redeploy

### 6. Koble domenet
- I Vercel: gå til Project → Settings → Domains
- Skriv inn: minnio.app
- Vercel viser deg DNS-innstillinger
- Gå til Namecheap (der du kjøpte domenet)
- Under Advanced DNS: legg til de to CNAME-postene Vercel viser

### Ferdig
Appen kjører på minnio.app med ekte AI-samtale.

## Kostnader
- Vercel hosting: gratis
- Claude API: ca 5-10 kr per samtale
- Domene: allerede betalt

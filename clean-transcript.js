// api/_chapters.js
// De 12 kapitlene en Minnio-bok består av.
// Dette er ryggraden i hele systemet – både Minna, bakgrunns-agenten
// og bok-barometeret bruker denne definisjonen.
//
// Basert på McAdams' Life Story Interview + Nature-studiens 54-spørsmåls
// rammeverk (Panfilova et al. 2026), tilpasset en norsk minnebok.

export const CHAPTERS = [
  {
    id: 'rotter',
    title: 'Røtter og barndomshjem',
    description: 'Hvor og når født, oppvekststed, barndomshjemmet, familiens kår',
    needs: ['fødselsår eller tiår', 'oppvekststed', 'beskrivelse av hjemmet', 'familiens levekår'],
    minRichness: 60
  },
  {
    id: 'familie_opphav',
    title: 'Foreldre og søsken',
    description: 'Mor, far, søsken – personligheter, yrker, relasjoner',
    needs: ['mors personlighet eller yrke', 'fars personlighet eller yrke', 'søsken', 'én konkret familiescene'],
    minRichness: 60
  },
  {
    id: 'barndom_scener',
    title: 'Barndommens øyeblikk',
    description: 'Konkrete barndomsminner – lek, gleder, et vondt minne',
    needs: ['ett godt barndomsminne med detaljer', 'ett vanskelig minne', 'lek eller fritid'],
    minRichness: 55
  },
  {
    id: 'skole',
    title: 'Skoleår og læring',
    description: 'Skolegang, lærere, fag, venner i skoletiden',
    needs: ['skole/skolevei', 'en lærer eller et fag', 'en skolekamerat eller episode'],
    minRichness: 50
  },
  {
    id: 'ungdom',
    title: 'Ungdomstid og drømmer',
    description: 'Tenårene, drømmer, første jobb, frihet og selvstendighet',
    needs: ['hva man drømte om å bli', 'første jobb eller ansvar', 'en ungdomsopplevelse'],
    minRichness: 50
  },
  {
    id: 'kjaerlighet',
    title: 'Kjærlighet og partnerskap',
    description: 'Hvordan man møtte partneren, forelskelse, ekteskap',
    needs: ['hvordan de møttes', 'en konkret scene fra forholdet', 'ekteskap eller samliv'],
    minRichness: 60
  },
  {
    id: 'familie_egen',
    title: 'Egen familie',
    description: 'Barn, foreldrerollen, familielivet som voksen',
    needs: ['barn (om noen)', 'en scene fra familielivet', 'hva familie betyr'],
    minRichness: 50
  },
  {
    id: 'arbeid',
    title: 'Arbeidsliv og kall',
    description: 'Yrkesvei, arbeidet man gjorde, stolthet og utfordringer i jobb',
    needs: ['hovedyrke eller livsverk', 'en konkret arbeidssituasjon', 'hva arbeidet betydde'],
    minRichness: 50
  },
  {
    id: 'motgang',
    title: 'Motgang og styrke',
    description: 'En vanskelig tid, tap, hvordan man kom seg gjennom',
    needs: ['en konkret vanskelig periode', 'hvordan man taklet det', 'hva det lærte en'],
    minRichness: 55
  },
  {
    id: 'glede',
    title: 'Glede og høydepunkter',
    description: 'De beste øyeblikkene, stoltheter, lykkelige minner',
    needs: ['et høydepunkt med detaljer', 'hva man er stolt av', 'en lykkelig dag'],
    minRichness: 50
  },
  {
    id: 'tro_verdier',
    title: 'Tro, verdier og livssyn',
    description: 'Hva man tror på, verdier, hva som gir livet mening',
    needs: ['verdier eller livssyn', 'hva som gir mening', 'syn på tro/religion (om relevant)'],
    minRichness: 45
  },
  {
    id: 'visdom_arv',
    title: 'Visdom og arv',
    description: 'Livslærdom, råd til etterslekten, hva man vil etterlate',
    needs: ['en livslærdom', 'råd til barnebarna', 'hva man vil bli husket for'],
    minRichness: 55
  }
];

// Hjelpefunksjon: lag en tom bok-struktur
export function emptyBookState() {
  const chapters = {};
  for (const ch of CHAPTERS) {
    chapters[ch.id] = {
      richness: 0,           // 0-100, hvor rikt dekket
      facts: [],             // tørre fakta hentet ut
      covered_needs: [],     // hvilke "needs" som er dekket
      status: 'tom'          // tom | påbegynt | god | rik
    };
  }
  return chapters;
}

// Hjelpefunksjon: beregn samlet bok-status
export function bookSummary(bookState) {
  if (!bookState) bookState = emptyBookState();
  let totalRichness = 0;
  let richChapters = 0;
  let goodChapters = 0;
  const chapterStatus = [];

  for (const ch of CHAPTERS) {
    const c = bookState[ch.id] || { richness: 0, status: 'tom' };
    totalRichness += c.richness;
    if (c.richness >= 70) richChapters++;
    if (c.richness >= ch.minRichness) goodChapters++;
    chapterStatus.push({
      id: ch.id,
      title: ch.title,
      richness: c.richness,
      status: c.status,
      ready: c.richness >= ch.minRichness
    });
  }

  const avgRichness = Math.round(totalRichness / CHAPTERS.length);
  // Grov estimering: hvert "godt" kapittel ≈ 4-5 sider
  const estimatedPages = Math.round(goodChapters * 4.5 + richChapters * 1.5);

  let verdict;
  if (goodChapters >= 10) verdict = 'Boka er klar til å produseres';
  else if (goodChapters >= 7) verdict = 'Snart klar – 1 økt til anbefales';
  else if (goodChapters >= 4) verdict = 'Halvveis – flere økter trengs';
  else verdict = 'Tidlig fase – mye materiale gjenstår';

  return {
    avgRichness,
    goodChapters,
    richChapters,
    totalChapters: CHAPTERS.length,
    estimatedPages,
    verdict,
    chapterStatus
  };
}

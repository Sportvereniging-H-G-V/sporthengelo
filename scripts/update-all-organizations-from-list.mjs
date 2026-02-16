import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';

const sportsDir = join(process.cwd(), 'content', 'sports');
const adaptiveDir = join(process.cwd(), 'content', 'adaptive');

// Mapping van sportnamen naar aanbieders (exact zoals in de lijst)
const organizationsMap = {
  // Reguliere sporten
  'acrobatiek': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/gymnastiek-turnen/acrogym/' }
  ],
  'apenkooi': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/gymnastiek-turnen/spelles/' }
  ],
  'atletiek': [
    { name: 'Marathon Pim Mulier (MPM)', url: 'https://www.mpmhengelo.nl/' },
    { name: 'LAAC Twente', url: 'https://www.laactwente.nl/' },
    { name: 'Urban Sports Twente', url: 'https://www.urbansportstwente.nl/' }
  ],
  'badminton': [
    { name: 'H.V. Bravo', url: 'https://hvbravo.nl/' },
    { name: 'Badminton Vereniging ELO United', url: 'https://www.elo-united.nl/' },
    { name: 'WRSH', url: 'https://www.wrsh.nl' }
  ],
  'basketbal': [
    { name: 'Twente Buzzards', url: 'https://twentebuzzards.nl/' },
    { name: 'WRSH', url: 'https://www.wrsh.nl/' },
    { name: 'Urban Sports Twente', url: 'https://www.urbansportstwente.nl/' }
  ],
  'biljart': [
    { name: 'Hengelose Seniorenbiljarters', url: 'https://www.hengeloseseniorenbiljarters.nl' },
    { name: 'Senioren Biljartvereniging De Haven', url: 'https://cafedehavenhengelo.nl/biljart-vereniging-de-haven/' },
    { name: 'Senioren Biljartvereniging Het Twentse Ros', url: 'https://bvhettwentseros.nl/' }
  ],
  'boksen': [
    { name: 'The Champ', url: 'https://boksclubthechamp.nl/' },
    { name: 'Fit-Fight Dojo', url: 'https://fit-kickboxing.nl/' }
  ],
  'bowls': [
    { name: 'Eerste Hengelose Bowlsvereniging', url: '' }
  ],
  'bridge': [
    { name: 'diverse clubs via Stichting Bridgestad Hengelo', url: 'https://www.bridgestadhengelo.nl/' }
  ],
  'conditie-fit': [
    { name: 'Body Practice', url: 'https://bodypractice.fit/' },
    { name: 'Muscle Motion', url: 'https://musclemotion.nl/' },
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl/' },
    { name: 'S.V. Trios', url: 'https://www.trioshengelo.nl/' },
    { name: 'Fit-punt', url: 'https://fit-punt.nl/' },
    { name: 'VitaDees', url: 'https://www.vitadees.nl/' },
    { name: 'WRSH', url: 'https://www.wrsh.nl' },
    { name: 'Wijkracht', url: 'https://www.wijkrachthengelo.nl/ouderen-hoofdmenu/bewegen-voor-ouderen' },
    { name: 'Nova Health', url: 'https://www.novahealth.nl/' }
  ],
  'cricket': [
    { name: 'Mixed Cricket Club Hengelo', url: 'https://www.crickethengelo.com/' }
  ],
  'dammen': [
    { name: 'Damvereniging Twente\'s Eerste', url: 'https://www.twenteseerste.nl/' }
  ],
  'showsport': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/dans-bewegen-op-muziek/breakdance/' }
  ],
  'duiken': [
    { name: 'OWG Neptunus', url: 'http://www.owg-neptunus.nl' },
    { name: 'Hengelose Sportduikers (HSD)', url: 'https://www.hengelose-sportduikers.nl/' }
  ],
  'fietscross': [
    { name: 'FCV Het Twentse Ros', url: 'https://www.fcvhettwentseros.nl/' }
  ],
  'freerunning': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/gymnastiek-turnen/free-running/' }
  ],
  'golf': [
    { name: 'Golfclub Driene', url: 'https://www.golfclubdriene.nl/' }
  ],
  'groepsspringen': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/gymnastiek-turnen/groepsspringen/' },
    { name: 'Turncentrum Twente', url: 'https://www.tctwente.com/' }
  ],
  'gymnastiek': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/' },
    { name: 'SV Trios', url: 'https://www.trioshengelo.nl/' },
    { name: 'WRSH', url: 'https://www.wrsh.nl/' },
    { name: 'HSSV Galm', url: 'http://www.galmhengelo.nl/' },
    { name: 'Turncentrum Twente', url: 'https://www.tctwente.com/' }
  ],
  'handbal': [
    { name: 'S.V. T.V.O. (Beckum)', url: 'http://www.svtvo.nl/' },
    { name: 'HV Olympia Hengelo', url: 'https://olympiahengelo.nl/' },
    { name: 'HHV Donar', url: 'http://www.hhvdonar.nl/' },
    { name: 'KSV BWO', url: 'https://www.ksvbwo.nl/' }
  ],
  'handboogschieten': [
    { name: 'Invaliden Sportvereniging Hengelo (ISVH)', url: 'https://isvh.nl/' },
    { name: 'De Vrije Schutter', url: 'https://www.devrijeschutter.nl/' }
  ],
  'hengelsport': [
    { name: 'H.S.V. Ons Genoegen', url: 'https://hsvonsgenoegenhengelo.mijnhengelsportvereniging.nl/' }
  ],
  'hockey': [
    { name: 'Hockeyclub Twente', url: 'https://www.hctwente.nl/' }
  ],
  'hondendressuur': [
    { name: 'Politiehondenvereniging HDV De Verdediger / Ons Genoegen', url: '' }
  ],
  'honk-softbal': [
    { name: 'HSV Giants', url: 'https://www.giants.nl/' },
    { name: 'Urban Sports Twente', url: 'https://www.urbansportstwente.nl/' }
  ],
  'jeu-de-boules': [
    { name: 'Jeu de boules H.K.C.', url: 'http://www.hkchengelo.nl/' },
    { name: 'Jeu de Boules Club Hasselo \'95', url: 'https://www.wijkcentranoord.nl/activiteiten/jeu-de-boules' },
    { name: 'De Zoaltboulers', url: 'https://www.zoaltboulers.com/' },
    { name: 'Tennis- en jeu de boulesvereniging Westermaat', url: 'https://www.tjvwestermaat.nl/' }
  ],
  'judo': [
    { name: 'Judo Promotie Twente', url: 'https://www.judopromotion.nl/' },
    { name: 'Judoschool Haagsma', url: 'https://dejudoschool.nl/' }
  ],
  'kano': [
    { name: 'Twentse Watersport Vereniging', url: 'https://www.twvhengelo.nl/' }
  ],
  'klootschieten': [
    { name: 'Hengelose Klootschieters Vereniging (HKV)', url: '' }
  ],
  'koersbal': [
    { name: 'Houd Koers', url: 'https://www.wijkcentranoord.nl/activiteiten-slangenbeek/koersbal' }
  ],
  'korfbal': [
    { name: 'Hengelose Korfbal Club H.K.C.', url: 'http://www.hkchengelo.nl/' }
  ],
  'luchtacrobatiek': [
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl' }
  ],
  'mahjong': [
    { name: 'Rode Draak Twente', url: 'https://www.rodedraaktwente.nl/' }
  ],
  'paardensport': [
    { name: 'Slangenbeek lr en pc', url: 'https://www.hippischtwente.nl/verenigingen/detail/hengelo/lr-en-pc-het-slangenbeek' },
    { name: 'Ponystal \'t Geerdink', url: 'https://www.hetgeerdink.nl/' },
    { name: 'Vereniging Ponystal Hengelo', url: 'https://www.ponystalhengelo.nl/' },
    { name: 'Stichting De Kapberg', url: 'https://www.stichtingdekapberg.nl/' }
  ],
  'rhonrad': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/gymnastiek-turnen/rhonradturnen/' }
  ],
  'ritmische-gymnastiek': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/gymnastiek-turnen/ritmische-gymnastiek/' }
  ],
  'roeien': [
    { name: 'Twentse Roeivereniging Tubantia', url: 'https://www.trvtubantia.nl/' }
  ],
  'ruby': [
    { name: 'Rugbyclub Dragons', url: 'https://rugbyclubdragons.nl/' }
  ],
  'schaatsen-skeeleren-2': [
    { name: 'Hengelose IJsclub', url: 'https://www.hijc.nl/' },
    { name: 'Nightskate Twente', url: 'https://www.nightskatetwente.nl/' }
  ],
  'schaken': [
    { name: 'J.S.V. Minerva', url: 'https://www.schakendhengelo.nl/jsvmin/' },
    { name: 'Hengelose Schaakclub-Stork', url: 'https://www.schakendhengelo.nl/' }
  ],
  'schermen': [
    { name: 'Hengelose Schermvereniging Agilité', url: '' }
  ],
  'schieten': [
    { name: 'Spoorweg Sport- en Ontspanningsvereniging', url: 'https://www.nshengelo.nl/schieten.html' }
  ],
  'skatehockey': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/dans-bewegen-op-muziek/streetdance/' }
  ],
  'sportmix': [
    { name: 'Muscle Motion', url: 'https://musclemotion.nl/' },
    { name: 'Wijkracht', url: 'https://www.wijkrachthengelo.nl/ouderen-hoofdmenu/bewegen-voor-ouderen' },
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl' },
    { name: 'Urban Sports Twente', url: 'https://www.urbansportstwente.nl/' },
    { name: 'HSSV Galm', url: 'http://www.galmhengelo.nl' }
  ],
  'steppen': [
    { name: 'Stepteam Twente', url: 'http://www.stepteamtwente.nl/' }
  ],
  'taekwondo': [
    { name: 'Taekwondo Oude Luttikhuis', url: 'https://tkdoudeluttikhuis.com/' }
  ],
  'tafeltennis': [
    { name: 'HTTC Vitesse', url: 'https://www.httcvitesse.nl/' }
  ],
  'tennis': [
    { name: 'TJV Westermaat', url: 'https://www.tjvwestermaat.nl/' },
    { name: 'TV Hasselo', url: 'https://www.tvhasselo.nl/' },
    { name: 'TC Groot Driene', url: 'https://www.tcgrootdriene.nl/' },
    { name: 'TC Weusthag', url: 'https://tcweusthag.nl/' },
    { name: 'TV Tie Break', url: 'https://www.tiebreak.nl/' },
    { name: 'TC Park Veldwijk', url: 'https://www.tcparkveldwijk.nl/' },
    { name: 'TV Hercules', url: 'https://www.tvhercules.nl/' },
    { name: 'TV Timmersweide', url: 'https://timmersweide.nl/' }
  ],
  'touwtrekken': [
    { name: 'TTV Oele', url: 'https://www.facebook.com/people/TTV-Oele/100063454307925/' }
  ],
  'trampoline-springen': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/dans-bewegen-op-muziek/streetdance/' }
  ],
  'turnen': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/' },
    { name: 'SV Trios', url: 'https://www.trioshengelo.nl/index.php?page=Nieuws&sid=1' },
    { name: 'Turncentrum Twente', url: 'https://www.tctwente.com/' }
  ],
  'voetbal': [
    { name: 'ATC \'65', url: 'https://www.atc65.nl/' },
    { name: 'Achilles \'12', url: 'https://www.achilles12.nl/' },
    { name: 'HVV Tubantia', url: 'https://www.hvv-tubantia.nl/' },
    { name: 'KSV BWO', url: 'https://www.ksvbwo.nl/' },
    { name: 'Juliana \'32', url: 'https://svjuliana32.nl/' },
    { name: 'SC Barbaros', url: 'https://scbarbaros.nl/' },
    { name: 'SV Wilhelminaschool', url: 'https://www.wschool.nl/' },
    { name: 'HVV Hengelo', url: 'https://hvvhengelo.nl/' }
  ],
  'zaalvoetbal': [
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl' }
  ],
  'volleybal': [
    { name: 'VV ATC', url: 'https://www.vvatc.nl/cms/' },
    { name: 'Thales-KEV combinatie', url: 'https://tkchengelo.nl/' },
    { name: 'Webton Hengelo', url: 'https://www.webton-hengelo.nl/' },
    { name: 'TVO Beckum', url: 'https://www.facebook.com/tvovolleybal/' },
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl' },
    { name: 'WRSH', url: 'https://www.wrsh.nl' },
    { name: 'Urban Sports Twente', url: 'https://www.urbansportstwente.nl/' }
  ],
  'wandelen': [
    { name: 'Hengelose Wandelunie', url: 'https://hengelo-wandel.nl/' },
    { name: 'Nivon Natuurvrienden Hengelo', url: 'https://hengelo.nivon.nl/wandelen-bij-nivon-hengelo/' },
    { name: 'Wijkracht', url: 'https://www.wijkrachthengelo.nl/ouderen-hoofdmenu/bewegen-voor-ouderen' }
  ],
  'waterpolo': [
    { name: 'Watersport Twente', url: 'https://www.wstwente.nl/' }
  ],
  'wielersport': [
    { name: 'RTC Hengelo', url: 'https://rtchengelo.nl/' },
    { name: 'Wijkracht', url: 'https://www.wijkrachthengelo.nl/ouderen-hoofdmenu/bewegen-voor-ouderen' }
  ],
  'zwemmen': [
    { name: 'Watersport Twente', url: 'https://www.wstwente.nl/' },
    { name: 'Tuindorpbad', url: 'https://tuindorpbad.nl/abonnementen/' }
  ],
  'obstakel-training': [
    { name: 'The Bootcamp Factory', url: 'https://www.thebootcampfactory.nl/' }
  ],
  'bootcamp': [
    { name: 'The Bootcamp Factory', url: 'https://www.thebootcampfactory.nl/' },
    { name: 'The Battle Continues', url: 'https://the-battle-continues-bootcamp-pt.business.site' },
    { name: 'Just Strong', url: 'https://www.juststrong.nl' }
  ],
  'scouting': [
    { name: 'alle Hengelose groepen via', url: 'http://www.scoutinghengelo.nl/' }
  ],
  'zumba': [
    { name: 'Dance Passion', url: 'https://www.dancepassion.nl' },
    { name: 'Wijkracht', url: 'https://www.wijkrachthengelo.nl/ouderen-hoofdmenu/bewegen-voor-ouderen' },
    { name: 'Latin Moves', url: 'https://www.latinmoves.nl/' }
  ],
  'small-groups-personal-training': [
    { name: 'The Battle Continues', url: 'https://the-battle-continues-bootcamp-pt.business.site' },
    { name: 'Just Strong', url: 'https://www.juststrong.nl' },
    { name: 'Nova Health', url: 'https://www.novahealth.nl/' }
  ],
  'paaldansen': [
    { name: 'Feel free & dance', url: 'https://feelfreeanddance.nl' },
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl' }
  ],
  'yoga': [
    { name: 'sportvereniging H.G.V. (kinderen)', url: 'http://www.hgvhengelo.nl' },
    { name: 'Flow Yoga', url: 'https://www.flowyogahengelo.nl/' },
    { name: 'WRSH', url: 'http://www.wrsh.nl' },
    { name: 'Fit-punt', url: 'https://fit-punt.nl' },
    { name: 'VitaDees', url: 'https://www.vitadees.nl/' },
    { name: 'Fit-Fight Dojo', url: 'https://fit-kickboxing.nl/' }
  ],
  'dans-dance': [
    { name: 'Dansstudio X-dance', url: 'http://x-dance.nl' },
    { name: 'Dansstudio Move', url: 'http://www.dansstudiomove.nl' },
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl' },
    { name: 'WRSH', url: 'http://wrsh.nl' },
    { name: 'SV Trios', url: 'http://trioshengelo.nl' }
  ],
  'fitness-groupfit': [
    { name: 'Beweegcentrum Twente', url: 'http://www.beweegcentrumtwente.nl' },
    { name: 'Muscle Motion', url: 'https://musclemotion.nl' },
    { name: 'Wijkracht', url: 'https://www.wijkrachthengelo.nl/ouderen-hoofdmenu/bewegen-voor-ouderen' },
    { name: 'Nova Health', url: 'https://www.novahealth.nl/' }
  ],
  'dodgeball-trefbal': [
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl' }
  ],
  'brisk-walking': [
    { name: 'Body Practice', url: 'https://bodypractice.fit/' }
  ],
  'kickboksen': [
    { name: 'Fit-Fight Dojo', url: 'https://fit-kickboxing.nl/' }
  ],
  'mma': [
    { name: 'Fit-Fight Dojo', url: 'https://fit-kickboxing.nl/' }
  ],
  'braziliaans-jiujitsu': [
    { name: 'Fit-Fight Dojo', url: 'https://fit-kickboxing.nl/' }
  ],
  'skateboarden-stuntskaten': [
    { name: 'Fresh Skateschool', url: 'https://freshskateschool.nl/' }
  ],
  
  // Aangepaste sporten
  'atletiek-2': [
    { name: 'Hengelose IJsclub', url: 'https://www.hijc.nl/' },
    { name: 'Marathon Pim Mulier', url: 'https://www.mpmhengelo.nl/' }
  ],
  'borstelschuiven': [
    { name: 'ISVH', url: 'https://isvh.nl/' }
  ],
  'dans': [
    { name: 'Acdabe Dans / Helen\'s Dance', url: 'https://www.acdabe.nl/' },
    { name: 'Dansstudio Move', url: 'http://www.dansstudiomove.nl/' }
  ],
  'gymnastiek-2': [
    { name: 'sportvereniging H.G.V.', url: 'https://www.hgvhengelo.nl/lesrooster/gymnastiek-turnen/gym/' }
  ],
  'handboogschieten-2': [
    { name: 'ISVH', url: 'https://isvh.nl/' }
  ],
  'hockey-2': [
    { name: 'Hockeyclub Twente', url: 'https://www.hctwente.nl/' }
  ],
  'rolstoelbasketbal': [
    { name: 'ISVH', url: 'https://isvh.nl/' }
  ],
  'schaatsen-skeeleren': [
    { name: 'Hengelose IJsclub', url: 'https://www.hijc.nl/' }
  ],
  'sportmix-2': [
    { name: 'sportvereniging H.G.V.', url: 'http://www.hgvhengelo.nl' },
    { name: 'WRSH', url: 'https://www.wrsh.nl' },
    { name: 'Urban Sports Twente', url: 'https://www.urbansportstwente.nl/' }
  ],
  'tafeltennis-2': [
    { name: 'ISVH', url: 'https://isvh.nl/' }
  ],
  'voetbal-2': [
    { name: 'HVV Tubantia', url: 'https://hvv-tubantia.nl/' }
  ],
  'zwemmen-2': [
    { name: 'ISVH', url: 'https://isvh.nl/' }
  ]
};

// Normaliseer HGV naam naar "Sportvereniging H.G.V."
function normalizeHGVName(name) {
  if (!name) return name;
  const nameLower = name.toLowerCase().trim();
  if (nameLower.includes('sportvereniging h.g.v.') || nameLower.includes('sportvereniging hgv')) {
    return 'Sportvereniging H.G.V.';
  }
  return name;
}

// Update bestand
async function updateFile(filePath, organizations) {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  
  // Normaliseer HGV namen
  const normalizedOrgs = organizations.map(org => ({
    name: normalizeHGVName(org.name),
    url: org.url || ''
  }));
  
  // Update frontmatter
  const updatedData = {
    ...data,
    organizations: normalizedOrgs,
  };
  
  // Update external_url naar eerste organisatie URL als die bestaat
  if (normalizedOrgs.length > 0 && normalizedOrgs[0].url) {
    updatedData.external_url = normalizedOrgs[0].url;
  }
  
  // Update body "Waar kun je X doen?" sectie - verwijder alle oude content en vervang
  let updatedBody = body;
  const verenigingenText = normalizedOrgs.map(org => 
    `- **${org.name}**${org.url ? ` - [Bezoek website](${org.url})` : ''}`
  ).join('\n');
  
  // Verwijder alle oude "Waar kun je X doen?" secties (ook met variaties)
  updatedBody = updatedBody.replace(/##\s+Waar (?:kun je .+? doen|moet je zijn)\?\s*\n\n?.*?(?=\n##|\n###|$)/gs, '');
  
  // Voeg nieuwe sectie toe aan het einde (voor de praktische informatie)
  const praktischeInfoMatch = updatedBody.match(/##\s+Praktische informatie/);
  if (praktischeInfoMatch) {
    const insertPos = updatedBody.indexOf('## Praktische informatie');
    updatedBody = updatedBody.slice(0, insertPos).trim() + 
      `\n\n## Waar kun je ${data.title} doen?\n\nIn Hengelo kun je ${data.title} beoefenen bij:\n\n${verenigingenText}\n\n` +
      updatedBody.slice(insertPos);
  } else {
    // Als er geen praktische informatie is, voeg toe aan het einde
    updatedBody = updatedBody.trim() + 
      `\n\n## Waar kun je ${data.title} doen?\n\nIn Hengelo kun je ${data.title} beoefenen bij:\n\n${verenigingenText}\n\n`;
  }
  
  // Verwijder lege regels en duplicaten
  updatedBody = updatedBody.replace(/\n{3,}/g, '\n\n').trim();
  
  // Format frontmatter
  const frontmatter = Object.entries(updatedData)
    .map(([key, value]) => {
      if (key === 'organizations') {
        return `organizations:\n${normalizedOrgs.map(org => `  - name: "${org.name}"\n    url: "${org.url || ''}"`).join('\n')}`;
      }
      if (typeof value === 'string') {
        return `${key}: "${value}"`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .filter(line => line !== '')
    .join('\n');
  
  const newContent = `---\n${frontmatter}\n---\n\n${updatedBody}`;
  await writeFile(filePath, newContent, 'utf-8');
}

// Main
async function main() {
  try {
    const dirs = [
      { path: sportsDir, name: 'sports' },
      { path: adaptiveDir, name: 'adaptive' }
    ];
    
    let total = 0;
    let updated = 0;
    let notFound = 0;
    const updatedFiles = [];
    const notFoundFiles = [];
    
    console.log('📝 Bestanden bijwerken...\n');
    
    for (const dir of dirs) {
      const files = (await readdir(dir.path)).filter(f => f.endsWith('.md'));
      
      for (const file of files) {
        total++;
        const filePath = join(dir.path, file);
        const content = await readFile(filePath, 'utf-8');
        const { data } = matter(content);
        
        const slug = data.slug || file.replace('.md', '');
        
        const organizations = organizationsMap[slug];
        
        if (organizations) {
          await updateFile(filePath, organizations);
          updated++;
          updatedFiles.push({ file, slug, count: organizations.length });
          console.log(`✅ ${file} (${organizations.length} aanbieder(s))`);
        } else {
          notFound++;
          notFoundFiles.push({ file, slug });
        }
      }
    }
    
    console.log(`\n📊 Samenvatting:`);
    console.log(`   Totaal gecontroleerd: ${total}`);
    console.log(`   ✏️  Bijgewerkt: ${updated}`);
    console.log(`   ⚠️  Niet in lijst: ${notFound}`);
    
    if (notFoundFiles.length > 0) {
      console.log(`\n⚠️  Bestanden niet in lijst:`);
      notFoundFiles.forEach(({ file, slug }) => {
        console.log(`   - ${file} (slug: ${slug})`);
      });
    }
    
    console.log('\n✨ Klaar!');
  } catch (error) {
    console.error('❌ Fout:', error);
    process.exit(1);
  }
}

main();


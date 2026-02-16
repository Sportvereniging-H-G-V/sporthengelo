import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';

const sportsDir = join(process.cwd(), 'content', 'sports');
const adaptiveDir = join(process.cwd(), 'content', 'adaptive');

// Normaliseer HGV naam naar "Sportvereniging H.G.V."
function normalizeHGVName(name) {
  if (!name) return name;
  
  const normalized = name.trim();
  
  // Check of het een HGV gerelateerde naam is
  const hgvPatterns = [
    /^hgvhengelo$/i,
    /^h\.g\.v\.$/i,
    /^sportvereniging\s+h\.g\.v\.$/i,
    /^sportvereniging\s+hgv$/i,
    /^hgv$/i
  ];
  
  // Als het een HGV variatie is, normaliseer naar "Sportvereniging H.G.V."
  for (const pattern of hgvPatterns) {
    if (pattern.test(normalized)) {
      return 'Sportvereniging H.G.V.';
    }
  }
  
  // Check ook of het "sportvereniging H.G.V." is (kleine s)
  if (/^sportvereniging\s+h\.g\.v\.$/i.test(normalized)) {
    return 'Sportvereniging H.G.V.';
  }
  
  // Check of het alleen "H.G.V." is (zonder sportvereniging)
  if (/^h\.g\.v\.$/i.test(normalized)) {
    return 'Sportvereniging H.G.V.';
  }
  
  return name; // Geen wijziging nodig
}

// Normaliseer HGV in markdown body content
function normalizeHGVInBody(body) {
  if (!body) return body;
  
  let normalized = body;
  
  // Vervang "**H.G.V.**" met "**Sportvereniging H.G.V.**"
  normalized = normalized.replace(/\*\*H\.G\.V\.\*\*/g, '**Sportvereniging H.G.V.**');
  
  // Vervang "**sportvereniging H.G.V.**" (kleine s) met "**Sportvereniging H.G.V.**"
  normalized = normalized.replace(/\*\*sportvereniging\s+H\.G\.V\.\*\*/gi, '**Sportvereniging H.G.V.**');
  
  // Vervang "**hgvhengelo**" met "**Sportvereniging H.G.V.**"
  normalized = normalized.replace(/\*\*hgvhengelo\*\*/gi, '**Sportvereniging H.G.V.**');
  
  // Vervang "**hgv**" met "**Sportvereniging H.G.V.**"
  normalized = normalized.replace(/\*\*hgv\*\*/gi, '**Sportvereniging H.G.V.**');
  
  return normalized;
}

// Normaliseer HGV in een bestand
async function normalizeHGVInFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  
  let updated = false;
  const updatedData = { ...data };
  
  // Normaliseer organizations in frontmatter
  if (data.organizations && Array.isArray(data.organizations)) {
    const normalizedOrgs = data.organizations.map(org => {
      if (typeof org === 'string') {
        const normalized = normalizeHGVName(org);
        if (normalized !== org) {
          updated = true;
          return normalized;
        }
        return org;
      } else if (typeof org === 'object' && org.name) {
        const normalized = normalizeHGVName(org.name);
        if (normalized !== org.name) {
          updated = true;
          return { ...org, name: normalized };
        }
        return org;
      }
      return org;
    });
    
    if (updated) {
      updatedData.organizations = normalizedOrgs;
    }
  }
  
  // Normaliseer HGV in body
  const normalizedBody = normalizeHGVInBody(body);
  if (normalizedBody !== body) {
    updated = true;
  }
  
  if (!updated) {
    return false;
  }
  
  // Format frontmatter
  const frontmatter = Object.entries(updatedData)
    .map(([key, value]) => {
      if (key === 'organizations') {
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return '';
        }
        return `organizations:\n${updatedData.organizations.map(org => {
          if (typeof org === 'string') {
            return `  - name: "${org}"`;
          }
          return `  - name: "${org.name}"\n    url: "${org.url || ''}"`;
        }).join('\n')}`;
      }
      if (typeof value === 'string') {
        return `${key}: "${value}"`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .filter(line => line !== '')
    .join('\n');
  
  const newContent = `---\n${frontmatter}\n---\n\n${normalizedBody}`;
  await writeFile(filePath, newContent, 'utf-8');
  
  return true;
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
    const updatedFiles = [];
    
    for (const dir of dirs) {
      const files = (await readdir(dir.path)).filter(f => f.endsWith('.md'));
      
      for (const file of files) {
        total++;
        const filePath = join(dir.path, file);
        const wasUpdated = await normalizeHGVInFile(filePath);
        
        if (wasUpdated) {
          updated++;
          updatedFiles.push(file);
          console.log(`✅ Bijgewerkt: ${file}`);
        }
      }
    }
    
    console.log(`\n📊 Samenvatting:`);
    console.log(`   Totaal gecontroleerd: ${total}`);
    console.log(`   ✏️  Bijgewerkt: ${updated}`);
    
    if (updatedFiles.length > 0) {
      console.log(`\n📋 Bijgewerkte bestanden:`);
      updatedFiles.forEach(file => console.log(`   - ${file}`));
    }
    
    console.log('\n✨ Klaar!');
  } catch (error) {
    console.error('❌ Fout:', error);
    process.exit(1);
  }
}

main();



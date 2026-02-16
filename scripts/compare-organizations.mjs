import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { parseString } from 'xml2js';

const wpExportPath = join(process.cwd(), 'sporthengelonl.WordPress.2025-12-04.xml');
const sportsDir = join(process.cwd(), 'content', 'sports');
const adaptiveDir = join(process.cwd(), 'content', 'adaptive');

// Normaliseer organisatienaam voor vergelijking
function normalizeOrgName(name) {
  if (!name) return '';
  return name
    .trim()
    .replace(/^(sportvereniging|vereniging)\s+/i, '')
    .toLowerCase();
}

// Normaliseer URL voor vergelijking
function normalizeUrl(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    return urlObj.href.replace(/\/$/, '').toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

// Vergelijk twee organisatie arrays
// Gebruikt normalisatie voor vergelijking, maar vergelijkt ook exacte namen
function compareOrganizations(orgs1, orgs2) {
  if (!orgs1 && !orgs2) return true;
  if (!orgs1 || !orgs2) return false;
  if (orgs1.length !== orgs2.length) return false;
  
  // Normaliseer beide arrays voor vergelijking
  const normalized1 = orgs1.map(org => ({
    name: normalizeOrgName(org.name || org),
    url: normalizeUrl(org.url || ''),
    originalName: (org.name || org).trim()
  })).sort((a, b) => a.name.localeCompare(b.name));
  
  const normalized2 = orgs2.map(org => ({
    name: normalizeOrgName(org.name || org),
    url: normalizeUrl(org.url || ''),
    originalName: (org.name || org).trim()
  })).sort((a, b) => a.name.localeCompare(b.name));
  
  // Vergelijk gesorteerde arrays - zowel genormaliseerd als exact
  for (let i = 0; i < normalized1.length; i++) {
    // Vergelijk genormaliseerde naam en URL
    if (normalized1[i].name !== normalized2[i].name) return false;
    if (normalized1[i].url !== normalized2[i].url) return false;
    // Als genormaliseerde namen matchen maar originele namen verschillen, 
    // dan is er een verschil (bijv. "H.G.V." vs "sportvereniging H.G.V.")
    if (normalized1[i].name === normalized2[i].name && 
        normalized1[i].originalName !== normalized2[i].originalName) {
      return false;
    }
  }
  
  return true;
}

// Parse WordPress export en extraheer verenigingen per sport
async function extractOrganizationsFromWP() {
  const xmlContent = await readFile(wpExportPath, 'utf-8');
  
  return new Promise((resolve, reject) => {
    parseString(xmlContent, (err, result) => {
      if (err) reject(err);
      
      const items = result.rss.channel[0].item || [];
      const orgMap = new Map();
      
      for (const item of items) {
        const title = item.title?.[0]?._ || item.title?.[0];
        const link = item.link?.[0];
        const content = item['content:encoded']?.[0] || '';
        
        if (!title || !content) continue;
        
        // Maak slug uit link of title
        const slug = link ? link.split('/').filter(Boolean).pop()?.replace(/\/$/, '') : title.toLowerCase().replace(/\s+/g, '-');
        
        // Zoek naar "Waar moet je zijn?" sectie
        const waarMatch = content.match(/<h3[^>]*>Waar moet je zijn\?<\/h3>\s*<p[^>]*>(.*?)<\/p>/is);
        
        if (waarMatch) {
          const waarContent = waarMatch[1];
          
          // Zoek naar links met verenigingsnamen
          const linkMatches = Array.from(waarContent.matchAll(/<a[^>]+href="([^"]+)"[^>]*><strong>([^<]+)<\/strong><\/a>/gi));
          
          if (linkMatches.length > 0) {
            const organizations = linkMatches.map(match => ({
              name: match[2].trim(),
              url: match[1].trim(),
            })).filter(org => org.name.length > 0);
            
            if (organizations.length > 0) {
              orgMap.set(slug, organizations);
              // Ook toevoegen met title als key voor betere matching
              const titleSlug = title.toLowerCase().replace(/\s+/g, '-');
              if (titleSlug !== slug) {
                orgMap.set(titleSlug, organizations);
              }
            }
          } else {
            // Probeer ook zonder strong tags
            const simpleLinkMatches = Array.from(waarContent.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi));
            if (simpleLinkMatches.length > 0) {
              const organizations = simpleLinkMatches.map(match => ({
                name: match[2].trim(),
                url: match[1].trim(),
              })).filter(org => org.name.length > 0);
              
              if (organizations.length > 0) {
                orgMap.set(slug, organizations);
                const titleSlug = title.toLowerCase().replace(/\s+/g, '-');
                if (titleSlug !== slug) {
                  orgMap.set(titleSlug, organizations);
                }
              }
            }
          }
        }
      }
      
      resolve(orgMap);
    });
  });
}

// Update alleen frontmatter organizations, niet de body
async function updateFrontmatterOrganizations(filePath, currentData, newOrganizations) {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  
  // Update alleen organizations in data
  const updatedData = {
    ...data,
    organizations: newOrganizations,
  };
  
  // Format frontmatter
  const frontmatter = Object.entries(updatedData)
    .map(([key, value]) => {
      if (key === 'organizations') {
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return '';
        }
        return `organizations:\n${newOrganizations.map(org => `  - name: "${org.name}"\n    url: "${org.url || ''}"`).join('\n')}`;
      }
      if (typeof value === 'string') {
        return `${key}: "${value}"`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .filter(line => line !== '') // Verwijder lege regels
    .join('\n');
  
  const newContent = `---\n${frontmatter}\n---\n\n${body}`;
  await writeFile(filePath, newContent, 'utf-8');
}

// Vergelijk en update markdown bestanden
async function compareAndUpdateFiles(orgMap) {
  const dirs = [
    { path: sportsDir, name: 'sports' },
    { path: adaptiveDir, name: 'adaptive' }
  ];
  
  const stats = {
    total: 0,
    matches: 0,
    differences: 0,
    updated: 0,
    notFound: 0,
    differencesList: []
  };
  
  for (const dir of dirs) {
    const files = (await readdir(dir.path)).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      stats.total++;
      const filePath = join(dir.path, file);
      const content = await readFile(filePath, 'utf-8');
      const { data } = matter(content);
      
      const slug = data.slug || file.replace('.md', '');
      const titleSlug = data.title?.toLowerCase().replace(/\s+/g, '-') || '';
      
      // Haal huidige organizations uit frontmatter
      const currentOrgs = data.organizations || [];
      
      // Zoek organizations in WP export
      let wpOrgs = orgMap.get(slug) || orgMap.get(titleSlug);
      
      // Als er geen vereniging gevonden is maar wel external_url, gebruik die
      if (!wpOrgs && data.external_url) {
        try {
          const urlObj = new URL(data.external_url);
          const domain = urlObj.hostname.replace('www.', '');
          const orgName = domain.split('.')[0] || 'Website';
          wpOrgs = [{ name: orgName, url: data.external_url }];
        } catch (e) {
          // Invalid URL, skip
        }
      }
      
      if (!wpOrgs || wpOrgs.length === 0) {
        stats.notFound++;
        console.log(`⚠️  Niet gevonden in WP export: ${file} (slug: ${slug})`);
        continue;
      }
      
      // Vergelijk organizations
      const isMatch = compareOrganizations(currentOrgs, wpOrgs);
      
      if (isMatch) {
        stats.matches++;
        console.log(`✅ Match: ${file}`);
      } else {
        stats.differences++;
        stats.differencesList.push({
          file,
          slug,
          current: currentOrgs,
          wp: wpOrgs
        });
        
        console.log(`❌ Verschil gevonden: ${file}`);
        console.log(`   Huidig: ${JSON.stringify(currentOrgs)}`);
        console.log(`   WP:     ${JSON.stringify(wpOrgs)}`);
        
        // Update alleen frontmatter
        await updateFrontmatterOrganizations(filePath, data, wpOrgs);
        stats.updated++;
        console.log(`   ✅ Bijgewerkt\n`);
      }
    }
  }
  
  return stats;
}

// Main
async function main() {
  try {
    console.log('🔍 WordPress export parsen...\n');
    const orgMap = await extractOrganizationsFromWP();
    console.log(`✅ ${orgMap.size} unieke slugs met verenigingen gevonden\n`);
    
    console.log('📝 Markdown bestanden vergelijken en bijwerken...\n');
    const stats = await compareAndUpdateFiles(orgMap);
    
    console.log('\n📊 Samenvatting:');
    console.log(`   Totaal gecontroleerd: ${stats.total}`);
    console.log(`   ✅ Matches (geen wijziging): ${stats.matches}`);
    console.log(`   ❌ Verschillen gevonden: ${stats.differences}`);
    console.log(`   ✏️  Bijgewerkt: ${stats.updated}`);
    console.log(`   ⚠️  Niet gevonden in WP export: ${stats.notFound}`);
    
    if (stats.differencesList.length > 0) {
      console.log('\n📋 Lijst van verschillen:');
      stats.differencesList.forEach(({ file, current, wp }) => {
        console.log(`\n   ${file}:`);
        console.log(`     Huidig: ${JSON.stringify(current)}`);
        console.log(`     WP:     ${JSON.stringify(wp)}`);
      });
    }
    
    console.log('\n✨ Klaar!');
  } catch (error) {
    console.error('❌ Fout:', error);
    process.exit(1);
  }
}

main();


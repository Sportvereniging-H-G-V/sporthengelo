import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { parseString } from 'xml2js';

const wpExportPath = join(process.cwd(), 'sporthengelonl.WordPress.2025-12-04.xml');
const sportsDir = join(process.cwd(), 'content', 'sports');
const adaptiveDir = join(process.cwd(), 'content', 'adaptive');

// Parse WordPress export en extraheer ALLE verenigingen per sport
async function extractAllOrganizationsFromWP() {
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
        
        // Zoek naar "Waar moet je zijn?" sectie - probeer verschillende patronen
        let waarContent = null;
        
        // Patroon 1: <h3>Waar moet je zijn?</h3><p>...</p>
        let waarMatch = content.match(/<h3[^>]*>Waar moet je zijn\?<\/h3>\s*<p[^>]*>(.*?)<\/p>/is);
        if (waarMatch) {
          waarContent = waarMatch[1];
        } else {
          // Patroon 2: <h3>Waar moet je zijn?</h3> gevolgd door meerdere paragrafen
          waarMatch = content.match(/<h3[^>]*>Waar moet je zijn\?<\/h3>(.*?)(?=<h[123]|<\/div>|$)/is);
          if (waarMatch) {
            waarContent = waarMatch[1];
          }
        }
        
        if (waarContent) {
          const organizations = [];
          
          // Zoek naar alle links in de waarContent
          // Patroon 1: <a href="..." ...><strong>...</strong></a>
          const strongLinkMatches = Array.from(waarContent.matchAll(/<a[^>]+href="([^"]+)"[^>]*><strong>([^<]+)<\/strong><\/a>/gi));
          for (const match of strongLinkMatches) {
            organizations.push({
              name: match[2].trim(),
              url: match[1].trim(),
            });
          }
          
          // Patroon 2: <a href="...">...</a> (zonder strong)
          if (organizations.length === 0) {
            const simpleLinkMatches = Array.from(waarContent.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi));
            for (const match of simpleLinkMatches) {
              const name = match[2].trim();
              const url = match[1].trim();
              // Skip als het alleen een URL is of leeg
              if (name && name.length > 0 && !name.match(/^https?:\/\//i)) {
                organizations.push({ name, url });
              }
            }
          }
          
          // Patroon 3: In lijsten (ol/ul)
          if (organizations.length === 0) {
            const listMatches = Array.from(waarContent.matchAll(/<li[^>]*>.*?<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>.*?<\/li>/gi));
            for (const match of listMatches) {
              organizations.push({
                name: match[2].trim(),
                url: match[1].trim(),
              });
            }
          }
          
          if (organizations.length > 0) {
            orgMap.set(slug, { title, organizations });
            // Ook toevoegen met title als key voor betere matching
            const titleSlug = title.toLowerCase().replace(/\s+/g, '-');
            if (titleSlug !== slug) {
              orgMap.set(titleSlug, { title, organizations });
            }
          }
        }
      }
      
      resolve(orgMap);
    });
  });
}

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
function compareOrganizations(orgs1, orgs2) {
  if (!orgs1 && !orgs2) return { match: true, missing: [], extra: [] };
  if (!orgs1 || orgs1.length === 0) return { match: false, missing: orgs2 || [], extra: [] };
  if (!orgs2 || orgs2.length === 0) return { match: false, missing: [], extra: orgs1 || [] };
  
  // Normaliseer beide arrays
  const normalized1 = orgs1.map(org => ({
    name: normalizeOrgName(org.name || org),
    url: normalizeUrl(org.url || ''),
    original: typeof org === 'string' ? org : org
  }));
  
  const normalized2 = orgs2.map(org => ({
    name: normalizeOrgName(org.name || org),
    url: normalizeUrl(org.url || ''),
    original: typeof org === 'string' ? org : org
  }));
  
  // Vind ontbrekende en extra
  const missing = [];
  const extra = [];
  
  for (const org2 of normalized2) {
    const found = normalized1.find(org1 => 
      org1.name === org2.name && org1.url === org2.url
    );
    if (!found) {
      missing.push(org2.original);
    }
  }
  
  for (const org1 of normalized1) {
    const found = normalized2.find(org2 => 
      org2.name === org1.name && org2.url === org1.url
    );
    if (!found) {
      extra.push(org1.original);
    }
  }
  
  return {
    match: missing.length === 0 && extra.length === 0,
    missing,
    extra
  };
}

// Main
async function main() {
  try {
    console.log('🔍 WordPress export parsen...\n');
    const orgMap = await extractAllOrganizationsFromWP();
    console.log(`✅ ${orgMap.size} unieke slugs met verenigingen gevonden\n`);
    
    const dirs = [
      { path: sportsDir, name: 'sports' },
      { path: adaptiveDir, name: 'adaptive' }
    ];
    
    const results = {
      total: 0,
      matches: 0,
      differences: [],
      notFound: []
    };
    
    console.log('📝 Alle sporten controleren...\n');
    
    for (const dir of dirs) {
      const files = (await readdir(dir.path)).filter(f => f.endsWith('.md'));
      
      for (const file of files) {
        results.total++;
        const filePath = join(dir.path, file);
        const content = await readFile(filePath, 'utf-8');
        const { data } = matter(content);
        
        const slug = data.slug || file.replace('.md', '');
        const titleSlug = data.title?.toLowerCase().replace(/\s+/g, '-') || '';
        
        // Haal huidige organizations uit frontmatter
        const currentOrgs = data.organizations || [];
        
        // Zoek organizations in WP export
        const wpData = orgMap.get(slug) || orgMap.get(titleSlug);
        
        if (!wpData) {
          results.notFound.push({
            file,
            slug,
            title: data.title,
            current: currentOrgs
          });
          continue;
        }
        
        const wpOrgs = wpData.organizations || [];
        
        // Vergelijk
        const comparison = compareOrganizations(currentOrgs, wpOrgs);
        
        if (comparison.match) {
          results.matches++;
        } else {
          results.differences.push({
            file,
            slug,
            title: data.title,
            current: currentOrgs,
            wp: wpOrgs,
            missing: comparison.missing,
            extra: comparison.extra
          });
        }
      }
    }
    
    // Rapport
    console.log('\n📊 SAMENVATTING:');
    console.log(`   Totaal gecontroleerd: ${results.total}`);
    console.log(`   ✅ Matches: ${results.matches}`);
    console.log(`   ❌ Verschillen: ${results.differences.length}`);
    console.log(`   ⚠️  Niet gevonden in WP export: ${results.notFound.length}`);
    
    if (results.differences.length > 0) {
      console.log('\n❌ SPORTEN MET VERSCHILLEN:\n');
      results.differences.forEach((diff, idx) => {
        console.log(`${idx + 1}. ${diff.file} (${diff.title || diff.slug})`);
        console.log(`   Huidig op site:`);
        if (diff.current.length === 0) {
          console.log(`     - Geen aanbieders`);
        } else {
          diff.current.forEach(org => {
            const name = typeof org === 'string' ? org : org.name;
            const url = typeof org === 'object' ? org.url : '';
            console.log(`     - ${name}${url ? ` (${url})` : ''}`);
          });
        }
        console.log(`   In WordPress export:`);
        diff.wp.forEach(org => {
          console.log(`     - ${org.name} (${org.url})`);
        });
        if (diff.missing.length > 0) {
          console.log(`   ⚠️  Ontbreekt op site:`);
          diff.missing.forEach(org => {
            const name = typeof org === 'string' ? org : org.name;
            const url = typeof org === 'object' ? org.url : '';
            console.log(`     - ${name}${url ? ` (${url})` : ''}`);
          });
        }
        if (diff.extra.length > 0) {
          console.log(`   ⚠️  Extra op site (niet in export):`);
          diff.extra.forEach(org => {
            const name = typeof org === 'string' ? org : org.name;
            const url = typeof org === 'object' ? org.url : '';
            console.log(`     - ${name}${url ? ` (${url})` : ''}`);
          });
        }
        console.log('');
      });
    }
    
    if (results.notFound.length > 0) {
      console.log('\n⚠️  SPORTEN NIET GEVONDEN IN WP EXPORT:\n');
      results.notFound.forEach((nf, idx) => {
        console.log(`${idx + 1}. ${nf.file} (${nf.title || nf.slug})`);
        if (nf.current.length > 0) {
          console.log(`   Huidige aanbieders:`);
          nf.current.forEach(org => {
            const name = typeof org === 'string' ? org : org.name;
            const url = typeof org === 'object' ? org.url : '';
            console.log(`     - ${name}${url ? ` (${url})` : ''}`);
          });
        }
        console.log('');
      });
    }
    
    console.log('\n✨ Klaar!');
  } catch (error) {
    console.error('❌ Fout:', error);
    process.exit(1);
  }
}

main();



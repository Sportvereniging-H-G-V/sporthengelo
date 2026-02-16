import { readFile, writeFile, readdir } from 'fs/promises';
import { join } from 'path';
import matter from 'gray-matter';
import { parseString } from 'xml2js';

const wpExportPath = join(process.cwd(), 'sporthengelonl.WordPress.2025-12-04.xml');
const sportsDir = join(process.cwd(), 'content', 'sports');
const adaptiveDir = join(process.cwd(), 'content', 'adaptive');

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
              name: match[2].trim().replace(/^(sportvereniging|vereniging)\s+/i, ''),
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
                name: match[2].trim().replace(/^(sportvereniging|vereniging)\s+/i, ''),
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

// Update markdown bestanden met verenigingen
async function updateMarkdownFiles(orgMap) {
  const dirs = [sportsDir, adaptiveDir];
  let updated = 0;
  let notFound = 0;
  
  for (const dir of dirs) {
    const files = (await readdir(dir)).filter(f => f.endsWith('.md'));
    
    for (const file of files) {
      const filePath = join(dir, file);
      const content = await readFile(filePath, 'utf-8');
      const { data, content: body } = matter(content);
      
      const slug = data.slug || file.replace('.md', '');
      const titleSlug = data.title?.toLowerCase().replace(/\s+/g, '-') || '';
      
      // Probeer verschillende slugs
      let organizations = orgMap.get(slug) || orgMap.get(titleSlug);
      
      // Als er geen vereniging gevonden is maar wel external_url, gebruik die
      if (!organizations && data.external_url) {
        try {
          const urlObj = new URL(data.external_url);
          const domain = urlObj.hostname.replace('www.', '');
          const orgName = domain.split('.')[0] || 'Website';
          organizations = [{ name: orgName, url: data.external_url }];
        } catch (e) {
          // Invalid URL, skip
        }
      }
      
      if (organizations && organizations.length > 0) {
        // Update frontmatter met organizations array
        const updatedData = {
          ...data,
          organizations: organizations,
        };
        
        // Update de "Waar kun je X doen?" sectie
        let updatedBody = body;
        const waarSectionRegex = /## Waar kun je .+? doen\?\s*\n\n?In Hengelo kun je .+? beoefenen bij:\s*\n\n?/s;
        
        if (waarSectionRegex.test(updatedBody)) {
          // Vervang lege sectie met verenigingen
          const verenigingenText = organizations.map(org => 
            `- **${org.name}**${org.url ? ` - [Bezoek website](${org.url})` : ''}`
          ).join('\n');
          
          updatedBody = updatedBody.replace(
            waarSectionRegex,
            `## Waar kun je ${data.title} doen?\n\nIn Hengelo kun je ${data.title} beoefenen bij:\n\n${verenigingenText}\n\n`
          );
        }
        
        // Schrijf terug
        const frontmatter = Object.entries(updatedData)
          .map(([key, value]) => {
            if (key === 'organizations') {
              return `organizations:\n${organizations.map(org => `  - name: "${org.name}"\n    url: "${org.url || ''}"`).join('\n')}`;
            }
            if (typeof value === 'string') {
              return `${key}: "${value}"`;
            }
            return `${key}: ${JSON.stringify(value)}`;
          })
          .join('\n');
        
        const newContent = `---\n${frontmatter}\n---\n\n${updatedBody}`;
        await writeFile(filePath, newContent, 'utf-8');
        
        console.log(`✅ Updated: ${file} (${organizations.length} vereniging(en))`);
        updated++;
      } else {
        console.log(`⚠️  Not found in WP export: ${file} (slug: ${slug})`);
        notFound++;
      }
    }
  }
  
  console.log(`\n📊 Samenvatting:`);
  console.log(`   ✅ Bijgewerkt: ${updated}`);
  console.log(`   ⚠️  Niet gevonden: ${notFound}`);
}

// Main
async function main() {
  try {
    console.log('🔍 WordPress export parsen...\n');
    const orgMap = await extractOrganizationsFromWP();
    console.log(`✅ ${orgMap.size} sporten met verenigingen gevonden\n`);
    
    console.log('📝 Markdown bestanden bijwerken...\n');
    await updateMarkdownFiles(orgMap);
    
    console.log('\n✨ Klaar!');
  } catch (error) {
    console.error('❌ Fout:', error);
    process.exit(1);
  }
}

main();


import { readFile, writeFile, readdir } from 'fs/promises';
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
        
        // Zoek naar "Waar moet je zijn?" sectie
        let waarContent = null;
        
        let waarMatch = content.match(/<h3[^>]*>Waar moet je zijn\?<\/h3>\s*<p[^>]*>(.*?)<\/p>/is);
        if (waarMatch) {
          waarContent = waarMatch[1];
        } else {
          waarMatch = content.match(/<h3[^>]*>Waar moet je zijn\?<\/h3>(.*?)(?=<h[123]|<\/div>|$)/is);
          if (waarMatch) {
            waarContent = waarMatch[1];
          }
        }
        
        if (waarContent) {
          const organizations = [];
          
          // Zoek naar alle links
          const strongLinkMatches = Array.from(waarContent.matchAll(/<a[^>]+href="([^"]+)"[^>]*><strong>([^<]+)<\/strong><\/a>/gi));
          for (const match of strongLinkMatches) {
            organizations.push({
              name: match[2].trim(),
              url: match[1].trim(),
            });
          }
          
          if (organizations.length === 0) {
            const simpleLinkMatches = Array.from(waarContent.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi));
            for (const match of simpleLinkMatches) {
              const name = match[2].trim();
              const url = match[1].trim();
              if (name && name.length > 0 && !name.match(/^https?:\/\//i)) {
                organizations.push({ name, url });
              }
            }
          }
          
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
            orgMap.set(slug, organizations);
            const titleSlug = title.toLowerCase().replace(/\s+/g, '-');
            if (titleSlug !== slug) {
              orgMap.set(titleSlug, organizations);
            }
          }
        }
      }
      
      resolve(orgMap);
    });
  });
}

// Update frontmatter organizations
async function updateFileOrganizations(filePath, wpOrgs) {
  const content = await readFile(filePath, 'utf-8');
  const { data, content: body } = matter(content);
  
  const updatedData = {
    ...data,
    organizations: wpOrgs,
  };
  
  // Update external_url naar eerste organisatie URL als die bestaat
  if (wpOrgs.length > 0 && wpOrgs[0].url) {
    updatedData.external_url = wpOrgs[0].url;
  }
  
  // Format frontmatter
  const frontmatter = Object.entries(updatedData)
    .map(([key, value]) => {
      if (key === 'organizations') {
        if (!value || (Array.isArray(value) && value.length === 0)) {
          return '';
        }
        return `organizations:\n${wpOrgs.map(org => `  - name: "${org.name}"\n    url: "${org.url || ''}"`).join('\n')}`;
      }
      if (typeof value === 'string') {
        return `${key}: "${value}"`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .filter(line => line !== '')
    .join('\n');
  
  const newContent = `---\n${frontmatter}\n---\n\n${body}`;
  await writeFile(filePath, newContent, 'utf-8');
}

// Update body "Waar kun je X doen?" sectie
function updateBodyWhereSection(body, title, wpOrgs) {
  if (!body || !wpOrgs || wpOrgs.length === 0) return body;
  
  const verenigingenText = wpOrgs.map(org => 
    `- **${org.name}**${org.url ? ` - [Bezoek website](${org.url})` : ''}`
  ).join('\n');
  
  // Vervang bestaande sectie
  const waarSectionRegex = /## Waar kun je .+? doen\?\s*\n\n?In Hengelo kun je .+? beoefenen bij:\s*\n\n?(- \*\*.*?\*\*.*?\n?)*/s;
  
  if (waarSectionRegex.test(body)) {
    return body.replace(
      waarSectionRegex,
      `## Waar kun je ${title} doen?\n\nIn Hengelo kun je ${title} beoefenen bij:\n\n${verenigingenText}\n\n`
    );
  }
  
  return body;
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
    
    let total = 0;
    let updated = 0;
    const updatedFiles = [];
    
    console.log('📝 Bestanden bijwerken...\n');
    
    for (const dir of dirs) {
      const files = (await readdir(dir.path)).filter(f => f.endsWith('.md'));
      
      for (const file of files) {
        total++;
        const filePath = join(dir.path, file);
        const content = await readFile(filePath, 'utf-8');
        const { data, content: body } = matter(content);
        
        const slug = data.slug || file.replace('.md', '');
        const titleSlug = data.title?.toLowerCase().replace(/\s+/g, '-') || '';
        
        // Zoek organizations in WP export
        const wpOrgs = orgMap.get(slug) || orgMap.get(titleSlug);
        
        if (wpOrgs && wpOrgs.length > 0) {
          // Update file
          await updateFileOrganizations(filePath, wpOrgs);
          
          // Update body
          const updatedBody = updateBodyWhereSection(body, data.title || slug, wpOrgs);
          if (updatedBody !== body) {
            const { data: updatedData } = matter(content);
            const frontmatter = Object.entries(updatedData)
              .map(([key, value]) => {
                if (key === 'organizations') {
                  return `organizations:\n${wpOrgs.map(org => `  - name: "${org.name}"\n    url: "${org.url || ''}"`).join('\n')}`;
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
          
          updated++;
          updatedFiles.push(file);
          console.log(`✅ Bijgewerkt: ${file} (${wpOrgs.length} aanbieder(s))`);
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



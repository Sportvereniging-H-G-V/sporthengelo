import type { APIRoute } from 'astro';
import { z } from 'zod';

// Ensure this route is not prerendered (server-side only)
export const prerender = false;

// Simple in-memory rate limiting (token bucket per IP)
const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();
const RATE_LIMIT_TOKENS = 5;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get('cf-connecting-ip') || 
                   request.headers.get('x-forwarded-for') || 
                   'unknown';
  return forwarded.split(',')[0].trim();
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const limit = rateLimitMap.get(key);
  
  if (!limit) {
    rateLimitMap.set(key, { tokens: RATE_LIMIT_TOKENS - 1, lastRefill: now });
    return true;
  }
  
  // Refill tokens if window has passed
  const timeSinceRefill = now - limit.lastRefill;
  if (timeSinceRefill >= RATE_LIMIT_WINDOW) {
    limit.tokens = RATE_LIMIT_TOKENS - 1;
    limit.lastRefill = now;
    return true;
  }
  
  // Check if tokens available
  if (limit.tokens > 0) {
    limit.tokens--;
    return true;
  }
  
  return false;
}

const formSchema = z.object({
  sportName: z.string().min(1, 'Naam sport is verplicht'),
  organizationName: z.string().min(1, 'Naam vereniging is verplicht'),
  category: z.enum(['regulier', 'aangepast', 'beide'], {
    errorMap: () => ({ message: 'Categorie moet "regulier", "aangepast" of "beide" zijn' }),
  }),
  website: z.string().url('Voer een geldige URL in'),
  description: z.string().optional(),
  reporterName: z.string().min(1, 'Naam is verplicht'),
  reporterEmail: z.string().email('Ongeldig e-mailadres'),
  company: z.string().optional(), // honeypot
  cfTurnstileResponse: z.string().optional(), // Turnstile token (optional if not configured)
});

// Vaste titel voor GitLab issues
const ISSUE_TITLE = 'Nieuwe sport/vereniging ingestuurd';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request);
    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: 'Te veel verzoeken. Probeer het later opnieuw.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Honeypot check
    const body = await request.json();
    if (body.company && body.company.length > 0) {
      // Bot detected, silently fail
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify Turnstile token if configured
    const runtime = (locals as any)?.runtime;
    const runtimeEnv = runtime?.env || {};
    const turnstileSecret = import.meta.env.TURNSTILE_SECRET_KEY || runtimeEnv.TURNSTILE_SECRET_KEY;
    const turnstileToken = body.cfTurnstileResponse;
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
    
    // In development, use test secret key if no secret is configured
    const secretToUse = turnstileSecret || (isDev ? '1x0000000000000000000000000000000AA' : null);
    
    if (secretToUse) {
      // Turnstile is configured, so token is required
      if (!turnstileToken) {
        return new Response(
          JSON.stringify({ error: 'Beveiligingscontrole is verplicht. Ververs de pagina en probeer opnieuw.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Verify token with Cloudflare Turnstile API
      const turnstileVerifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
      const turnstileResponse = await fetch(turnstileVerifyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: secretToUse,
          response: turnstileToken,
          remoteip: request.headers.get('cf-connecting-ip') || 
                   request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 
                   undefined,
        }),
      });

      const turnstileResult = await turnstileResponse.json();
      
      if (!turnstileResult.success) {
        console.error('Turnstile verification failed:', turnstileResult);
        return new Response(
          JSON.stringify({ error: 'Beveiligingscontrole mislukt. Ververs de pagina en probeer opnieuw.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    } else if (turnstileToken) {
      // Token provided but secret not configured - log warning but allow
      console.warn('Turnstile token received but TURNSTILE_SECRET_KEY not configured');
    }

    // Validate
    const validationResult = formSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return new Response(
        JSON.stringify({ 
          error: firstError.message,
          field: firstError.path[0],
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = validationResult.data;

    // Get environment variables
    // In Astro with Cloudflare adapter, env vars are available via import.meta.env
    // Also check runtime.env for Cloudflare Workers context
    const gitlabApiUrl = import.meta.env.GITLAB_API_URL || runtimeEnv.GITLAB_API_URL;
    const gitlabProjectId = import.meta.env.GITLAB_PROJECT_ID || runtimeEnv.GITLAB_PROJECT_ID;
    const gitlabAccessToken = import.meta.env.GITLAB_ACCESS_TOKEN || runtimeEnv.GITLAB_ACCESS_TOKEN;

    // Log which variables are missing (without exposing values)
    const missingVars = [];
    if (!gitlabApiUrl) missingVars.push('GITLAB_API_URL');
    if (!gitlabProjectId) missingVars.push('GITLAB_PROJECT_ID');
    if (!gitlabAccessToken) missingVars.push('GITLAB_ACCESS_TOKEN');

    if (missingVars.length > 0) {
      console.error('GitLab environment variables not configured:', missingVars.join(', '));
      return new Response(
        JSON.stringify({ 
          error: 'Server configuratie fout. Neem contact op met de beheerder.',
          details: `Ontbrekende variabelen: ${missingVars.join(', ')}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prepare issue description in Markdown format
    const issueDescription = `## Sport informatie

**Naam sport:**  
${data.sportName}

**Naam vereniging:**  
${data.organizationName}

**Categorie:**  
${data.category}

**Website:**  
${data.website}

${data.description ? `\n## Omschrijving\n\n${data.description}\n` : ''}

---

## Contactgegevens

**Naam:**  
${data.reporterName}

**E-mail:**  
${data.reporterEmail}
`;

    // Prepare GitLab issue payload
    const payload = {
      title: ISSUE_TITLE,
      description: issueDescription,
      labels: ['ontbrekende-sport', data.category],
    };

    // Create issue in GitLab
    const gitlabUrl = `${gitlabApiUrl}/projects/${encodeURIComponent(gitlabProjectId)}/issues`;
    console.log('Creating GitLab issue at:', gitlabUrl.replace(/\/\/.*@/, '//***@')); // Log URL without token
    
    let response;
    try {
      response = await fetch(gitlabUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PRIVATE-TOKEN': gitlabAccessToken,
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      
      return new Response(
        JSON.stringify({ 
          error: 'Kon geen verbinding maken met GitLab. Controleer de API URL.',
          details: fetchError instanceof Error ? fetchError.message : 'Unknown error'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitLab API error:', response.status, errorText);
      
      // Try to parse error message from GitLab
      let errorMessage = 'Fout bij verzenden. Probeer het later opnieuw.';
      let errorDetails = '';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.message) {
          errorMessage = `GitLab fout: ${errorJson.message}`;
        }
        if (Array.isArray(errorJson.error)) {
          errorDetails = errorJson.error.join(', ');
        } else if (typeof errorJson.error === 'string') {
          errorDetails = errorJson.error;
        }
      } catch {
        // Use default error message
        errorDetails = errorText.substring(0, 200); // First 200 chars
      }
      
      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          details: errorDetails || `HTTP ${response.status}`
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const issueData = await response.json();
    console.log('GitLab issue created:', issueData.id);

    // Success - return JSON with success flag for client-side redirect
    return new Response(
      JSON.stringify({ success: true, issueId: issueData.id }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Onverwachte fout opgetreden';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log full error for debugging (server-side only)
    if (errorStack) {
      console.error('Error stack:', errorStack);
    }
    
    return new Response(
      JSON.stringify({ 
        error: 'Onverwachte fout opgetreden. Probeer het later opnieuw.',
        details: import.meta.env.DEV ? errorMessage : undefined
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};


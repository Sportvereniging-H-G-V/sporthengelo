import type { APIRoute } from 'astro';

// Ensure this route is not prerendered (server-side only)
export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // Get environment variables from both import.meta.env and runtime.env
    const runtime = (locals as any)?.runtime;
    const runtimeEnv = runtime?.env || {};
    
    const turnstileSiteKey = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || runtimeEnv.PUBLIC_TURNSTILE_SITE_KEY || '';
    
    return new Response(
      JSON.stringify({ 
        siteKey: turnstileSiteKey || (import.meta.env.DEV ? '1x00000000000000000000AA' : '')
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        } 
      }
    );
  } catch (error) {
    console.error('Error getting Turnstile config:', error);
    
    return new Response(
      JSON.stringify({ siteKey: '' }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};

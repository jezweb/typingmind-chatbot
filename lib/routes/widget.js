/**
 * Widget routes module
 * Handles widget delivery
 */

/**
 * Handle widget.js delivery
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Widget JavaScript code
 */
export async function handleWidgetDelivery(request, env) {
  let widgetCode = await env.AGENT_CONFIG.get('widget:code');
  
  if (!widgetCode) {
    widgetCode = 'console.error("Widget not deployed. Please run npm run deploy:widget");';
  }
  
  return new Response(widgetCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
/**
 * Status route module
 * Provides instance status information and metrics
 */

import { securityHeaders } from '../security.js';
import { getInstanceConfig } from '../database.js';
import { checkRateLimitStatus } from '../rate-limiter.js';

/**
 * Get instance status information
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @param {Object} ctx - Request context
 * @param {string} instanceId - Instance ID
 * @returns {Response} Status information
 */
export async function handleInstanceStatus(request, env, ctx, instanceId) {
  try {
    // Get instance configuration
    const instanceConfig = await getInstanceConfig(env.DB, instanceId);
    
    if (!instanceConfig) {
      return new Response(JSON.stringify({
        error: 'Instance not found',
        instanceId
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...securityHeaders
        }
      });
    }
    
    // Get current rate limit status (without incrementing)
    const clientId = request.headers.get('CF-Connecting-IP') || 'anonymous';
    const hourlyStatus = await checkRateLimitStatus(
      env.RATE_LIMITS,
      instanceId,
      clientId,
      'hourly',
      instanceConfig.rateLimit.messagesPerHour
    );
    const sessionStatus = await checkRateLimitStatus(
      env.RATE_LIMITS,
      instanceId,
      'session-' + clientId,
      'session',
      instanceConfig.rateLimit.messagesPerSession
    );
    
    // Get metrics from KV storage
    const metricsKey = `status:${instanceId}:metrics`;
    const metrics = await env.AGENT_CONFIG.get(metricsKey, { type: 'json' }) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      lastResponseTimes: [],
      lastError: null,
      lastChecked: new Date().toISOString()
    };
    
    // Calculate uptime percentage
    const uptime = metrics.totalRequests > 0 
      ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
      : 100;
    
    // Prepare response
    const statusResponse = {
      instance: {
        id: instanceConfig.id,
        name: instanceConfig.name,
        status: 'online' // Could be enhanced with actual health checks
      },
      metrics: {
        avgResponseTime: Math.round(metrics.avgResponseTime || 0),
        uptime: parseFloat(uptime),
        totalRequests: metrics.totalRequests,
        successfulRequests: metrics.successfulRequests,
        failedRequests: metrics.failedRequests,
        rateLimits: {
          messagesPerHour: {
            used: hourlyStatus.count,
            limit: instanceConfig.rateLimit.messagesPerHour,
            remaining: instanceConfig.rateLimit.messagesPerHour - hourlyStatus.count,
            resetsIn: hourlyStatus.ttl || 3600 // seconds until reset
          },
          messagesPerSession: {
            used: sessionStatus.count,
            limit: instanceConfig.rateLimit.messagesPerSession,
            remaining: instanceConfig.rateLimit.messagesPerSession - sessionStatus.count
          }
        }
      },
      lastError: metrics.lastError,
      lastChecked: new Date().toISOString()
    };
    
    // Check if HTML format is requested
    const url = new URL(request.url);
    const format = url.searchParams.get('format');
    
    if (format === 'html') {
      // Return HTML status page
      const html = generateStatusHTML(statusResponse);
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          ...securityHeaders
        }
      });
    }
    
    // Return JSON by default
    return new Response(JSON.stringify(statusResponse, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        ...securityHeaders
      }
    });
    
  } catch (error) {
    console.error('[Status] Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...securityHeaders
      }
    });
  }
}

/**
 * Generate HTML status page
 * @param {Object} status - Status data
 * @returns {string} HTML content
 */
function generateStatusHTML(status) {
  const { instance, metrics, lastError, lastChecked } = status;
  const isOnline = instance.status === 'online';
  const statusColor = isOnline ? '#4caf50' : '#f44336';
  const statusText = isOnline ? 'Online' : 'Offline';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>${instance.name} - Status</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    
    .header {
      background: white;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
      text-align: center;
    }
    
    h1 {
      font-size: 2em;
      margin-bottom: 10px;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      padding: 8px 16px;
      border-radius: 20px;
      background-color: ${statusColor};
      color: white;
      font-weight: 500;
      margin-top: 10px;
    }
    
    .status-dot {
      width: 10px;
      height: 10px;
      background-color: white;
      border-radius: 50%;
      margin-right: 8px;
      animation: ${isOnline ? 'pulse' : 'none'} 2s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .metric-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .metric-label {
      font-size: 0.9em;
      color: #666;
      margin-bottom: 5px;
    }
    
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      color: #333;
    }
    
    .metric-unit {
      font-size: 0.6em;
      color: #999;
      margin-left: 5px;
    }
    
    .progress-bar {
      width: 100%;
      height: 10px;
      background-color: #e0e0e0;
      border-radius: 5px;
      overflow: hidden;
      margin-top: 10px;
    }
    
    .progress-fill {
      height: 100%;
      background-color: #1976d2;
      transition: width 0.3s ease;
    }
    
    .progress-fill.warning {
      background-color: #ff9800;
    }
    
    .progress-fill.danger {
      background-color: #f44336;
    }
    
    .error-section {
      background: #ffebee;
      border: 1px solid #ffcdd2;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
    }
    
    .error-title {
      color: #c62828;
      font-weight: bold;
      margin-bottom: 10px;
    }
    
    .footer {
      text-align: center;
      color: #666;
      font-size: 0.9em;
      margin-top: 30px;
    }
    
    .refresh-notice {
      color: #999;
      font-size: 0.8em;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${instance.name}</h1>
      <p>Instance ID: ${instance.id}</p>
      <div class="status-badge">
        <span class="status-dot"></span>
        ${statusText}
      </div>
    </div>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Response Time</div>
        <div class="metric-value">
          ${metrics.avgResponseTime}<span class="metric-unit">ms</span>
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Uptime</div>
        <div class="metric-value">
          ${metrics.uptime}<span class="metric-unit">%</span>
        </div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Total Requests</div>
        <div class="metric-value">${metrics.totalRequests}</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Failed Requests</div>
        <div class="metric-value">${metrics.failedRequests}</div>
      </div>
    </div>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Hourly Rate Limit</div>
        <div class="metric-value">
          ${metrics.rateLimits.messagesPerHour.used}<span class="metric-unit">/ ${metrics.rateLimits.messagesPerHour.limit}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${getRateLimitClass(metrics.rateLimits.messagesPerHour)}" 
               style="width: ${(metrics.rateLimits.messagesPerHour.used / metrics.rateLimits.messagesPerHour.limit * 100)}%">
          </div>
        </div>
        <div class="refresh-notice">Resets in ${formatTime(metrics.rateLimits.messagesPerHour.resetsIn)}</div>
      </div>
      
      <div class="metric-card">
        <div class="metric-label">Session Rate Limit</div>
        <div class="metric-value">
          ${metrics.rateLimits.messagesPerSession.used}<span class="metric-unit">/ ${metrics.rateLimits.messagesPerSession.limit}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill ${getRateLimitClass(metrics.rateLimits.messagesPerSession)}" 
               style="width: ${(metrics.rateLimits.messagesPerSession.used / metrics.rateLimits.messagesPerSession.limit * 100)}%">
          </div>
        </div>
      </div>
    </div>
    
    ${lastError ? `
    <div class="error-section">
      <div class="error-title">Last Error</div>
      <p>${lastError}</p>
    </div>
    ` : ''}
    
    <div class="footer">
      <p>Last checked: ${new Date(lastChecked).toLocaleString()}</p>
      <p class="refresh-notice">This page auto-refreshes every 30 seconds</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Get CSS class for rate limit progress bar
 * @param {Object} rateLimit - Rate limit data
 * @returns {string} CSS class
 */
function getRateLimitClass(rateLimit) {
  const percentage = (rateLimit.used / rateLimit.limit) * 100;
  if (percentage >= 90) return 'danger';
  if (percentage >= 70) return 'warning';
  return '';
}

/**
 * Format time duration
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time
 */
function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h`;
}

/**
 * Update instance metrics (called from chat route)
 * @param {Object} env - Environment bindings
 * @param {string} instanceId - Instance ID
 * @param {number} responseTime - Response time in ms
 * @param {boolean} success - Whether request was successful
 * @param {string} error - Error message if any
 */
export async function updateInstanceMetrics(env, instanceId, responseTime, success, error = null) {
  const metricsKey = `status:${instanceId}:metrics`;
  
  // Get existing metrics
  const metrics = await env.AGENT_CONFIG.get(metricsKey, { type: 'json' }) || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    avgResponseTime: 0,
    lastResponseTimes: [],
    lastError: null,
    lastChecked: new Date().toISOString()
  };
  
  // Update counters
  metrics.totalRequests++;
  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
    if (error) {
      metrics.lastError = error;
    }
  }
  
  // Update response times (keep last 10)
  metrics.lastResponseTimes.push(responseTime);
  if (metrics.lastResponseTimes.length > 10) {
    metrics.lastResponseTimes.shift();
  }
  
  // Calculate average response time
  metrics.avgResponseTime = metrics.lastResponseTimes.reduce((a, b) => a + b, 0) / metrics.lastResponseTimes.length;
  
  // Update last checked time
  metrics.lastChecked = new Date().toISOString();
  
  // Store updated metrics (with 1 hour TTL)
  await env.AGENT_CONFIG.put(metricsKey, JSON.stringify(metrics), {
    expirationTtl: 3600
  });
}
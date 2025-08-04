/**
 * Agent management API handlers
 */

export async function handleListAgents(request, env) {
  try {
    const agents = [];
    const list = await env.AGENT_CONFIG.list({ prefix: 'agent:' });
    
    for (const key of list.keys) {
      const agent = await env.AGENT_CONFIG.get(key.name, 'json');
      if (agent) {
        agents.push({
          ...agent,
          internalId: key.name.replace('agent:', '')
        });
      }
    }
    
    return new Response(JSON.stringify(agents), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('List agents error:', error);
    return new Response(JSON.stringify({ error: 'Failed to list agents' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleGetAgent(request, env) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    
    const agent = await env.AGENT_CONFIG.get(`agent:${id}`, 'json');
    
    if (!agent) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(agent), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Get agent error:', error);
    return new Response(JSON.stringify({ error: 'Failed to get agent' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleCreateAgent(request, env) {
  try {
    const agentData = await request.json();
    
    // Validate required fields
    if (!agentData.id || !agentData.name || !agentData.allowedDomains) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: id, name, allowedDomains' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Generate internal ID
    const internalId = generateAgentId();
    
    // Set defaults
    const agent = {
      id: agentData.id, // TypingMind agent ID
      name: agentData.name,
      apiKey: agentData.apiKey || null,
      allowedDomains: agentData.allowedDomains || [],
      allowedPaths: agentData.allowedPaths || [],
      rateLimit: {
        messagesPerHour: agentData.rateLimit?.messagesPerHour || 100,
        messagesPerSession: agentData.rateLimit?.messagesPerSession || 30
      },
      features: {
        imageUpload: agentData.features?.imageUpload !== false,
        markdown: agentData.features?.markdown !== false,
        persistSession: agentData.features?.persistSession || false
      },
      theme: {
        primaryColor: agentData.theme?.primaryColor || '#007bff',
        position: agentData.theme?.position || 'bottom-right'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to KV
    await env.AGENT_CONFIG.put(`agent:${internalId}`, JSON.stringify(agent));
    
    return new Response(JSON.stringify({ 
      ...agent, 
      internalId 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Create agent error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create agent' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleUpdateAgent(request, env) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    const updates = await request.json();
    
    const existing = await env.AGENT_CONFIG.get(`agent:${id}`, 'json');
    
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Merge updates
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    // Ensure critical fields aren't removed
    if (!updated.id || !updated.name || !updated.allowedDomains) {
      return new Response(JSON.stringify({ 
        error: 'Cannot remove required fields' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env.AGENT_CONFIG.put(`agent:${id}`, JSON.stringify(updated));
    
    return new Response(JSON.stringify(updated), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Update agent error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update agent' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function handleDeleteAgent(request, env) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/').pop();
    
    const existing = await env.AGENT_CONFIG.get(`agent:${id}`, 'json');
    
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    await env.AGENT_CONFIG.delete(`agent:${id}`);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Delete agent error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete agent' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Generate unique agent ID
 */
function generateAgentId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
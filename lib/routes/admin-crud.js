/**
 * Admin CRUD routes module
 * Handles create, read, update, delete operations for instances
 */

import { securityHeaders } from '../security.js';
import { 
  validateAdminSession,
  createUnauthorizedRedirect,
  createUnauthorizedResponse
} from '../auth.js';
import {
  getInstanceById,
  createInstance,
  updateInstance,
  deleteInstance,
  cloneInstance
} from '../database.js';
import { validateInstanceId } from '../security.js';
import { createInstanceForm, editInstanceForm } from '../templates/admin-forms.js';

/**
 * Create new instance form
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Create form HTML
 */
export async function handleCreateInstanceForm(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedRedirect();
  }
  
  const html = createInstanceForm();
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      ...securityHeaders
    }
  });
}

/**
 * Create new instance endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Create result
 */
export async function handleCreateInstance(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedResponse();
  }
  
  try {
    const data = await request.json();
    
    // Validate instance ID
    if (!validateInstanceId(data.id)) {
      return new Response(JSON.stringify({ error: 'Invalid instance ID format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Create instance with all related data
    await createInstance(env.DB, data);
    
    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Admin] Create instance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to create instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Delete instance endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Delete result
 */
export async function handleDeleteInstance(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedResponse();
  }
  
  try {
    const { id } = request.params;
    
    // Delete instance (cascading deletes will handle related tables)
    await deleteInstance(env.DB, id);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Admin] Delete instance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to delete instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Edit instance form
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Edit form HTML
 */
export async function handleEditInstanceForm(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedRedirect();
  }
  
  const { id } = request.params;
  
  // Get instance data with all related data
  const instanceData = await getInstanceById(env.DB, id);
  
  if (!instanceData) {
    return new Response('Instance not found', { status: 404 });
  }
  
  const html = editInstanceForm(id, instanceData);
  
  return new Response(html, {
    headers: { 
      'Content-Type': 'text/html',
      ...securityHeaders
    }
  });
}

/**
 * Update instance endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Update result
 */
export async function handleUpdateInstance(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedResponse();
  }
  
  try {
    const { id } = request.params;
    const data = await request.json();
    
    // Update instance with all related data
    await updateInstance(env.DB, id, data);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Admin] Update instance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Clone instance endpoint
 * @param {Request} request - HTTP request
 * @param {Object} env - Environment bindings
 * @returns {Response} Clone result
 */
export async function handleCloneInstance(request, env) {
  // Validate session
  const isValid = await validateAdminSession(request, env);
  if (!isValid) {
    return createUnauthorizedResponse();
  }
  
  try {
    const { id } = request.params;
    const { name } = await request.json();
    
    // Generate new instance ID
    const newId = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    
    // Clone instance with all settings
    try {
      await cloneInstance(env.DB, id, newId, name);
    } catch (error) {
      if (error.message === 'Source instance not found') {
        return new Response(JSON.stringify({ error: 'Source instance not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      throw error;
    }
    
    return new Response(JSON.stringify({ success: true, id: newId }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('[Admin] Clone instance error:', error);
    return new Response(JSON.stringify({ error: 'Failed to clone instance' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
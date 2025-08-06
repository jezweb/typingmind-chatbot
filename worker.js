import { Router } from 'itty-router';
import { handleCORSPreflight } from './lib/security.js';
import { handleGetInstance, handleChat } from './lib/routes/chat.js';
import { handleWidgetDelivery } from './lib/routes/widget.js';
import {
  handleAdminJs,
  handleAdminLoginPage,
  handleAdminLogin,
  handleAdminLogout,
  handleAdminDashboard
} from './lib/routes/admin.js';
import {
  handleCreateInstanceForm,
  handleCreateInstance,
  handleDeleteInstance,
  handleEditInstanceForm,
  handleUpdateInstance,
  handleCloneInstance
} from './lib/routes/admin-crud.js';

const router = Router();

// Handle CORS preflight
router.options('*', (request) => {
  return handleCORSPreflight(request);
});

// Chat routes
router.get('/instance/:id', handleGetInstance);
router.post('/chat', handleChat);

// Widget delivery
router.get('/widget.js', handleWidgetDelivery);

// Admin routes
router.get('/admin/admin.js', handleAdminJs);
router.get('/admin', handleAdminLoginPage);
router.post('/admin/login', handleAdminLogin);
router.post('/admin/logout', handleAdminLogout);
router.get('/admin/dashboard', handleAdminDashboard);

// Admin CRUD routes
router.get('/admin/instances/new', handleCreateInstanceForm);
router.post('/admin/instances', handleCreateInstance);
router.delete('/admin/instances/:id', handleDeleteInstance);
router.get('/admin/instances/:id/edit', handleEditInstanceForm);
router.put('/admin/instances/:id', handleUpdateInstance);
router.post('/admin/instances/:id/clone', handleCloneInstance);

// Test route
router.get('/test', () => {
  return new Response('Test route works!', {
    headers: { 'Content-Type': 'text/plain' }
  });
});

// Health check
router.get('/', () => {
  return new Response('TypingMind Chatbot Multi-Instance API', {
    headers: { 'Content-Type': 'text/plain' }
  });
});

// 404 handler
router.all('*', () => new Response('Not Found', { status: 404 }));

// Export worker
export default {
  async fetch(request, env, ctx) {
    return router.handle(request, env, ctx);
  }
};
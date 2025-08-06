/**
 * Admin layout template module
 * Provides base HTML layout for admin pages
 */

/**
 * Generate base HTML layout for admin pages
 * @param {Object} options - Layout options
 * @param {string} options.title - Page title
 * @param {string} options.content - Page content HTML
 * @param {boolean} options.includeAdminJs - Include admin.js script (default: true)
 * @param {string} options.styles - Additional styles
 * @returns {string} Complete HTML page
 */
export function adminLayout({ title, content, includeAdminJs = true, styles = '' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - TypingMind Chatbot</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f5f5f5; }
    .header { background: white; padding: 1rem 2rem; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header h1 { margin: 0; color: #333; }
    .container { padding: 2rem; }
    .btn { padding: 0.5rem 1rem; border: none; border-radius: 4px; cursor: pointer; text-decoration: none; display: inline-block; }
    .btn-primary { background: #007bff; color: white; }
    .btn-primary:hover { background: #0056b3; }
    .btn-secondary { background: #6c757d; color: white; margin-right: 1rem; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.875rem; }
    .btn-info { background: #17a2b8; color: white; }
    .btn-success { background: #28a745; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    code { background: #f8f9fa; padding: 0.2rem 0.4rem; border-radius: 3px; font-size: 0.875rem; }
    ${styles}
  </style>
</head>
<body>
  ${content}
  ${includeAdminJs ? '<script src="/admin/admin.js"></script>' : ''}
</body>
</html>`;
}

/**
 * Generate form layout with standard styling
 * @param {Object} options - Form options
 * @param {string} options.title - Page title
 * @param {string} options.heading - Page heading
 * @param {string} options.formContent - Form fields HTML
 * @param {string} options.formId - Form element ID
 * @param {string} options.submitText - Submit button text
 * @param {string} options.cancelUrl - Cancel button URL (default: /admin/dashboard)
 * @returns {string} Complete HTML page
 */
export function formLayout({ 
  title, 
  heading, 
  formContent, 
  formId, 
  submitText, 
  cancelUrl = '/admin/dashboard' 
}) {
  const styles = `
    .container { max-width: 800px; margin: 0 auto; padding: 0 2rem; }
    .form-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 1.5rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 600; }
    input[type="text"], input[type="number"], textarea, select { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
    textarea { resize: vertical; min-height: 100px; }
    .checkbox-group { display: flex; align-items: center; }
    .checkbox-group input { width: auto; margin-right: 0.5rem; }
    .help-text { font-size: 0.875rem; color: #6c757d; margin-top: 0.25rem; }
    .section { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #dee2e6; }
    .section h3 { margin-top: 0; }
  `;

  const content = `
    <div class="header">
      <h1>${heading}</h1>
    </div>
    <div class="container">
      <form class="form-card" id="${formId}">
        ${formContent}
        <div style="margin-top: 2rem;">
          <a href="${cancelUrl}" class="btn btn-secondary">Cancel</a>
          <button type="submit" class="btn btn-primary">${submitText}</button>
        </div>
      </form>
    </div>
  `;

  return adminLayout({ title, content, styles });
}
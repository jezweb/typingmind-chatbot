import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import uglify from 'uglify-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read source files
const widgetJs = fs.readFileSync(path.join(__dirname, 'src/widget.js'), 'utf8');
const stylesCSS = fs.readFileSync(path.join(__dirname, 'src/styles.css'), 'utf8');
const iconsJs = fs.readFileSync(path.join(__dirname, 'src/icons.js'), 'utf8');

// Extract icons object
const iconsMatch = iconsJs.match(/export const icons = ({[\s\S]*?});/);
const iconsObject = iconsMatch ? iconsMatch[1] : '{}';

// Prepare the final widget code
let finalCode = widgetJs
  .replace('const icons = WIDGET_ICONS;', `const icons = ${iconsObject};`)
  .replace('const styles = WIDGET_STYLES;', `const styles = \`${stylesCSS.replace(/`/g, '\\`')}\`;`);

// Development build (unminified)
fs.writeFileSync(
  path.join(__dirname, 'dist/widget.js'),
  finalCode
);

console.log('✓ Development build created: dist/widget.js');

// Production build (minified)
try {
  const minified = uglify.minify(finalCode, {
    compress: {
      drop_console: false, // Keep console for debugging
      drop_debugger: true,
      pure_funcs: ['console.log']
    },
    mangle: {
      reserved: ['TypingMindChat'] // Don't mangle the public API
    },
    output: {
      comments: false
    }
  });
  
  if (minified.error) {
    throw minified.error;
  }
  
  fs.writeFileSync(
    path.join(__dirname, 'dist/widget.min.js'),
    minified.code
  );
  
  const devSize = (finalCode.length / 1024).toFixed(2);
  const minSize = (minified.code.length / 1024).toFixed(2);
  
  console.log(`✓ Production build created: dist/widget.min.js`);
  console.log(`  Development: ${devSize} KB`);
  console.log(`  Production: ${minSize} KB`);
  console.log(`  Compression: ${((1 - minified.code.length / finalCode.length) * 100).toFixed(1)}%`);
  
} catch (error) {
  console.error('✗ Failed to create production build:', error.message);
  process.exit(1);
}
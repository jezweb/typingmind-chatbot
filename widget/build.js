import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to inject icons and styles
function injectAssets() {
  return {
    name: 'inject-assets',
    transform(code, id) {
      if (id.endsWith('widget.js')) {
        // Read assets
        const stylesCSS = fs.readFileSync(path.join(__dirname, 'src/styles.css'), 'utf8');
        const iconsJs = fs.readFileSync(path.join(__dirname, 'src/icons.js'), 'utf8');
        
        // Extract icons object
        const iconsMatch = iconsJs.match(/export const icons = ({[\s\S]*?});/);
        const iconsObject = iconsMatch ? iconsMatch[1] : '{}';
        
        // Replace placeholders
        code = code.replace('const icons = WIDGET_ICONS;', `const icons = ${iconsObject};`);
        code = code.replace('const styles = WIDGET_STYLES;', `const styles = \`${stylesCSS.replace(/`/g, '\\`')}\`;`);
        
        return code;
      }
      return null;
    }
  };
}

async function build() {
  try {
    console.log('Building widget...');
    
    // Create bundle
    const bundle = await rollup({
      input: path.join(__dirname, 'src/widget.js'),
      plugins: [
        nodeResolve(),
        injectAssets()
      ]
    });
    
    // Generate development build
    const { output: devOutput } = await bundle.generate({
      format: 'iife',
      name: 'TypingMindWidget'
    });
    
    // Write development build
    const devCode = devOutput[0].code;
    fs.writeFileSync(
      path.join(__dirname, 'dist/widget.js'),
      devCode
    );
    
    console.log('✓ Development build created: dist/widget.js');
    
    // Generate production build with minification
    const prodBundle = await rollup({
      input: path.join(__dirname, 'src/widget.js'),
      plugins: [
        nodeResolve(),
        injectAssets(),
        terser({
          compress: {
            drop_console: false, // Keep console for debugging
            drop_debugger: true,
            pure_funcs: ['console.log']
          },
          mangle: {
            reserved: ['TypingMindChat'] // Don't mangle the public API
          },
          format: {
            comments: false
          }
        })
      ]
    });
    
    const { output: prodOutput } = await prodBundle.generate({
      format: 'iife',
      name: 'TypingMindWidget'
    });
    
    // Write production build
    const prodCode = prodOutput[0].code;
    fs.writeFileSync(
      path.join(__dirname, 'dist/widget.min.js'),
      prodCode
    );
    
    // Calculate sizes
    const devSize = (devCode.length / 1024).toFixed(2);
    const minSize = (prodCode.length / 1024).toFixed(2);
    
    console.log(`✓ Production build created: dist/widget.min.js`);
    console.log(`  Development: ${devSize} KB`);
    console.log(`  Production: ${minSize} KB`);
    console.log(`  Compression: ${((1 - prodCode.length / devCode.length) * 100).toFixed(1)}%`);
    
    // Close bundles
    await bundle.close();
    await prodBundle.close();
    
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

// Run build
build();
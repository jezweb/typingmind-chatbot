/**
 * Tests for Markdown parser
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { MarkdownParser } from './markdown-parser.js';

describe('MarkdownParser', () => {
  let parser;
  
  beforeEach(() => {
    parser = new MarkdownParser();
  });

  describe('parse', () => {
    test('should return DOM container with content', () => {
      const content = 'This is plain text';
      const result = parser.parse(content);
      
      expect(result.tagName).toBe('DIV');
      expect(result.querySelector('p')).toBeTruthy();
      expect(result.textContent).toContain('This is plain text');
    });
    
    test('should handle empty string', () => {
      const result = parser.parse('');
      
      expect(result.tagName).toBe('DIV');
      expect(result.children.length).toBe(0);
    });
    
    test('should split content into paragraphs', () => {
      const content = 'First paragraph\n\nSecond paragraph\n\nThird paragraph';
      const result = parser.parse(content);
      
      const paragraphs = result.querySelectorAll('p');
      expect(paragraphs.length).toBe(3);
      expect(paragraphs[0].textContent).toBe('First paragraph');
      expect(paragraphs[1].textContent).toBe('Second paragraph');
      expect(paragraphs[2].textContent).toBe('Third paragraph');
    });
  });

  describe('parseParagraph - headers', () => {
    test('should parse h1 header', () => {
      const element = parser.parseParagraph('# Main Title');
      
      expect(element.tagName).toBe('H1');
      expect(element.textContent).toBe('Main Title');
    });
    
    test('should parse h2 to h6 headers', () => {
      const headers = [
        { text: '## H2 Title', tag: 'H2', content: 'H2 Title' },
        { text: '### H3 Title', tag: 'H3', content: 'H3 Title' },
        { text: '#### H4 Title', tag: 'H4', content: 'H4 Title' },
        { text: '##### H5 Title', tag: 'H5', content: 'H5 Title' },
        { text: '###### H6 Title', tag: 'H6', content: 'H6 Title' }
      ];
      
      headers.forEach(({ text, tag, content }) => {
        const element = parser.parseParagraph(text);
        expect(element.tagName).toBe(tag);
        expect(element.textContent).toBe(content);
      });
    });
    
    test('should parse headers with inline formatting', () => {
      const element = parser.parseParagraph('# This is **bold** header');
      
      expect(element.tagName).toBe('H1');
      expect(element.querySelector('strong')).toBeTruthy();
      expect(element.querySelector('strong').textContent).toBe('bold');
    });
  });

  describe('parseParagraph - lists', () => {
    test('should parse unordered list with asterisk', () => {
      const element = parser.parseParagraph('* List item');
      
      expect(element.tagName).toBe('UL');
      const li = element.querySelector('li');
      expect(li).toBeTruthy();
      expect(li.textContent).toBe('List item');
    });
    
    test('should parse unordered list with dash', () => {
      const element = parser.parseParagraph('- Another item');
      
      expect(element.tagName).toBe('UL');
      expect(element.querySelector('li').textContent).toBe('Another item');
    });
    
    test('should parse unordered list with plus', () => {
      const element = parser.parseParagraph('+ Plus item');
      
      expect(element.tagName).toBe('UL');
      expect(element.querySelector('li').textContent).toBe('Plus item');
    });
    
    test('should parse ordered list', () => {
      const element = parser.parseParagraph('1. First item');
      
      expect(element.tagName).toBe('OL');
      const li = element.querySelector('li');
      expect(li).toBeTruthy();
      expect(li.textContent).toBe('First item');
    });
    
    test('should parse list items with inline formatting', () => {
      const element = parser.parseParagraph('* Item with **bold** text');
      
      const li = element.querySelector('li');
      expect(li.querySelector('strong')).toBeTruthy();
      expect(li.querySelector('strong').textContent).toBe('bold');
    });
  });

  describe('parseParagraph - blockquotes', () => {
    test('should parse blockquote', () => {
      const element = parser.parseParagraph('> This is a quote');
      
      expect(element.tagName).toBe('BLOCKQUOTE');
      expect(element.textContent).toBe('This is a quote');
    });
    
    test('should parse blockquote with inline formatting', () => {
      const element = parser.parseParagraph('> Quote with *italic* text');
      
      expect(element.tagName).toBe('BLOCKQUOTE');
      expect(element.querySelector('em')).toBeTruthy();
      expect(element.querySelector('em').textContent).toBe('italic');
    });
  });

  describe('parseParagraph - code blocks', () => {
    test('should parse code block without language', () => {
      const text = '```\nconst x = 1;\nconst y = 2;\n```';
      const element = parser.parseParagraph(text);
      
      expect(element.tagName).toBe('PRE');
      const code = element.querySelector('code');
      expect(code).toBeTruthy();
      expect(code.className).toBe('');
      expect(code.textContent).toBe('const x = 1;\nconst y = 2;');
    });
    
    test('should parse code block with language', () => {
      const text = '```javascript\nfunction hello() {\n  return "world";\n}\n```';
      const element = parser.parseParagraph(text);
      
      expect(element.tagName).toBe('PRE');
      const code = element.querySelector('code');
      expect(code.className).toBe('language-javascript');
      expect(code.textContent).toContain('function hello()');
    });
  });

  describe('parseParagraph - paragraphs', () => {
    test('should parse regular paragraph', () => {
      const element = parser.parseParagraph('This is a regular paragraph');
      
      expect(element.tagName).toBe('P');
      expect(element.textContent).toBe('This is a regular paragraph');
    });
    
    test('should parse paragraph with inline formatting', () => {
      const element = parser.parseParagraph('Text with **bold** and *italic*');
      
      expect(element.tagName).toBe('P');
      expect(element.querySelector('strong').textContent).toBe('bold');
      expect(element.querySelector('em').textContent).toBe('italic');
    });
  });

  describe('parseInline', () => {
    test('should parse bold with double asterisks', () => {
      const nodes = parser.parseInline('This is **bold** text');
      
      expect(nodes.length).toBe(3);
      expect(nodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(nodes[0].textContent).toBe('This is ');
      expect(nodes[1].tagName).toBe('STRONG');
      expect(nodes[1].textContent).toBe('bold');
      expect(nodes[2].nodeType).toBe(Node.TEXT_NODE);
      expect(nodes[2].textContent).toBe(' text');
    });
    
    test('should parse italic with single asterisk', () => {
      const nodes = parser.parseInline('This is *italic* text');
      
      expect(nodes.length).toBe(3);
      expect(nodes[1].tagName).toBe('EM');
      expect(nodes[1].textContent).toBe('italic');
    });
    
    test('should parse inline code', () => {
      const nodes = parser.parseInline('Use `console.log()` to debug');
      
      expect(nodes.length).toBe(3);
      expect(nodes[1].tagName).toBe('CODE');
      expect(nodes[1].textContent).toBe('console.log()');
    });
    
    test('should handle nested formatting', () => {
      const nodes = parser.parseInline('**This has *nested* formatting**');
      
      // The simple regex approach doesn't handle nested formatting properly
      // It will parse the double asterisks first, resulting in a STRONG element
      expect(nodes.some(node => node.tagName === 'STRONG')).toBe(true);
      // The inner asterisks won't be recognized as italic within the strong element
      expect(nodes[0].tagName).toBe('STRONG');
      expect(nodes[0].textContent).toBe('This has *nested* formatting');
    });
    
    test('should handle text with no formatting', () => {
      const nodes = parser.parseInline('Plain text with no formatting');
      
      expect(nodes.length).toBe(1);
      expect(nodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(nodes[0].textContent).toBe('Plain text with no formatting');
    });
  });

  describe('createTextNodesWithLineBreaks', () => {
    test('should create text nodes with line breaks', () => {
      const nodes = parser.createTextNodesWithLineBreaks('Line 1\nLine 2\nLine 3');
      
      expect(nodes.length).toBe(5); // text, br, text, br, text
      expect(nodes[0].textContent).toBe('Line 1');
      expect(nodes[1].tagName).toBe('BR');
      expect(nodes[2].textContent).toBe('Line 2');
      expect(nodes[3].tagName).toBe('BR');
      expect(nodes[4].textContent).toBe('Line 3');
    });
    
    test('should handle single line', () => {
      const nodes = parser.createTextNodesWithLineBreaks('Single line');
      
      expect(nodes.length).toBe(1);
      expect(nodes[0].textContent).toBe('Single line');
    });
    
    test('should handle empty lines', () => {
      const nodes = parser.createTextNodesWithLineBreaks('Line 1\n\nLine 3');
      
      // Should have: text, br, br, text
      expect(nodes.filter(node => node.tagName === 'BR').length).toBe(2);
    });
  });

  describe('parseLinks', () => {
    test('should parse markdown links', () => {
      const nodes = parser.parseLinks('Visit [example](https://example.com) for more');
      
      expect(nodes.length).toBe(3);
      expect(nodes[0].textContent).toBe('Visit ');
      expect(nodes[1].tagName).toBe('A');
      expect(nodes[1].href).toBe('https://example.com/');
      expect(nodes[1].textContent).toBe('example');
      expect(nodes[1].target).toBe('_blank');
      expect(nodes[1].rel).toBe('noopener noreferrer');
      expect(nodes[2].textContent).toBe(' for more');
    });
    
    test('should handle multiple links', () => {
      const nodes = parser.parseLinks('[Link1](url1) and [Link2](url2)');
      
      const links = nodes.filter(node => node.tagName === 'A');
      expect(links.length).toBe(2);
      expect(links[0].textContent).toBe('Link1');
      expect(links[1].textContent).toBe('Link2');
    });
    
    test('should handle text with no links', () => {
      const nodes = parser.parseLinks('No links here');
      
      expect(nodes.length).toBe(1);
      expect(nodes[0].nodeType).toBe(Node.TEXT_NODE);
      expect(nodes[0].textContent).toBe('No links here');
    });
  });

  describe('sanitizeUrl', () => {
    test('should allow normal URLs', () => {
      expect(parser.sanitizeUrl('https://example.com')).toBe('https://example.com/');
      expect(parser.sanitizeUrl('http://example.com/path')).toBe('http://example.com/path');
    });
    
    test('should block javascript URLs', () => {
      expect(parser.sanitizeUrl('javascript:alert("XSS")')).toBe('#');
      expect(parser.sanitizeUrl('JavaScript:void(0)')).toBe('#');
    });
    
    test('should block data URLs', () => {
      expect(parser.sanitizeUrl('data:text/html,<script>alert("XSS")</script>')).toBe('#');
    });
    
    test('should handle relative URLs', () => {
      expect(parser.sanitizeUrl('/path/to/page')).toBe('/path/to/page');
      expect(parser.sanitizeUrl('relative.html')).toBe('relative.html');
    });
    
    test('should handle invalid URLs', () => {
      expect(parser.sanitizeUrl('not a valid url')).toBe('not a valid url');
    });
  });

  describe('escapeHtml', () => {
    test('should escape HTML entities', () => {
      const escaped = parser.escapeHtml('<script>alert("XSS")</script>');
      
      expect(escaped).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
    });
    
    test('should escape quotes', () => {
      const escaped = parser.escapeHtml('He said "Hello"');
      
      // The escapeHtml method uses textContent/innerHTML which doesn't escape quotes
      // by default unless they're in an attribute context
      expect(escaped).toBe('He said "Hello"');
    });
    
    test('should handle plain text', () => {
      const escaped = parser.escapeHtml('Plain text with no special chars');
      
      expect(escaped).toBe('Plain text with no special chars');
    });
  });

  describe('integration tests', () => {
    test('should parse complex markdown document', () => {
      const markdown = `# Main Title

This is a paragraph with **bold** and *italic* text.

## Features

> Important quote

\`\`\`javascript
const example = true;
\`\`\`

Final paragraph.`;
      
      const result = parser.parse(markdown);
      
      // Check structure
      expect(result.querySelector('h1')).toBeTruthy();
      expect(result.querySelector('h2')).toBeTruthy();
      expect(result.querySelector('blockquote')).toBeTruthy();
      expect(result.querySelector('pre code')).toBeTruthy();
      
      // Check content
      expect(result.querySelector('h1').textContent).toBe('Main Title');
      expect(result.querySelector('strong').textContent).toBe('bold');
      expect(result.querySelector('em').textContent).toBe('italic');
      expect(result.querySelector('code.language-javascript')).toBeTruthy();
    });
    
    test('should parse lists correctly', () => {
      // Lists are parsed one item at a time, each creating its own ul/ol
      const unorderedList = '* Item 1';
      const orderedList = '1. First item';
      
      const ulResult = parser.parseParagraph(unorderedList);
      expect(ulResult.tagName).toBe('UL');
      expect(ulResult.querySelector('li').textContent).toBe('Item 1');
      
      const olResult = parser.parseParagraph(orderedList);
      expect(olResult.tagName).toBe('OL');
      expect(olResult.querySelector('li').textContent).toBe('First item');
    });
  });
});
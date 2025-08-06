// Markdown Parser Module
// Safe markdown to DOM conversion with XSS prevention

export class MarkdownParser {
  constructor() {
    // Inline markdown patterns
    this.inlinePatterns = [
      { regex: /\*\*(.*?)\*\*/, tag: 'strong' },
      { regex: /\*(.*?)\*/, tag: 'em' },
      { regex: /`(.*?)`/, tag: 'code' }
    ];
  }
  
  // Parse markdown content to DOM nodes
  parse(content) {
    const container = document.createElement('div');
    
    // Split content into paragraphs
    const paragraphs = content.split(/\n\n/);
    
    paragraphs.forEach(paragraph => {
      if (paragraph.trim()) {
        const element = this.parseParagraph(paragraph);
        container.appendChild(element);
      }
    });
    
    return container;
  }
  
  // Parse a single paragraph
  parseParagraph(text) {
    // Check for headers
    const headerMatch = text.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const header = document.createElement(`h${level}`);
      const inlineNodes = this.parseInline(headerText);
      inlineNodes.forEach(node => header.appendChild(node));
      return header;
    }
    
    // Check for list items
    const unorderedListMatch = text.match(/^[-*+]\s+(.+)$/);
    if (unorderedListMatch) {
      const li = document.createElement('li');
      const inlineNodes = this.parseInline(unorderedListMatch[1]);
      inlineNodes.forEach(node => li.appendChild(node));
      
      const ul = document.createElement('ul');
      ul.appendChild(li);
      return ul;
    }
    
    const orderedListMatch = text.match(/^\d+\.\s+(.+)$/);
    if (orderedListMatch) {
      const li = document.createElement('li');
      const inlineNodes = this.parseInline(orderedListMatch[1]);
      inlineNodes.forEach(node => li.appendChild(node));
      
      const ol = document.createElement('ol');
      ol.appendChild(li);
      return ol;
    }
    
    // Check for blockquote
    const blockquoteMatch = text.match(/^>\s+(.+)$/);
    if (blockquoteMatch) {
      const blockquote = document.createElement('blockquote');
      const inlineNodes = this.parseInline(blockquoteMatch[1]);
      inlineNodes.forEach(node => blockquote.appendChild(node));
      return blockquote;
    }
    
    // Check for code block
    if (text.startsWith('```')) {
      const lines = text.split('\n');
      const language = lines[0].substring(3).trim();
      const codeContent = lines.slice(1, -1).join('\n');
      
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (language) {
        code.className = `language-${language}`;
      }
      code.textContent = codeContent;
      pre.appendChild(code);
      return pre;
    }
    
    // Default to paragraph
    const p = document.createElement('p');
    const inlineNodes = this.parseInline(text);
    inlineNodes.forEach(node => p.appendChild(node));
    return p;
  }
  
  // Parse inline markdown
  parseInline(text) {
    const nodes = [];
    let remaining = text;
    
    while (remaining) {
      let earliestMatch = null;
      let earliestIndex = remaining.length;
      let matchedPattern = null;
      
      // Find the earliest match
      for (const pattern of this.inlinePatterns) {
        const match = remaining.match(pattern.regex);
        if (match && match.index < earliestIndex) {
          earliestMatch = match;
          earliestIndex = match.index;
          matchedPattern = pattern;
        }
      }
      
      if (earliestMatch) {
        // Add text before the match
        if (earliestIndex > 0) {
          const textBefore = remaining.substring(0, earliestIndex);
          nodes.push(...this.createTextNodesWithLineBreaks(textBefore));
        }
        
        // Add the matched element
        const element = document.createElement(matchedPattern.tag);
        element.textContent = earliestMatch[1];
        nodes.push(element);
        
        // Update remaining text
        remaining = remaining.substring(earliestIndex + earliestMatch[0].length);
      } else {
        // No more matches, add remaining text
        nodes.push(...this.createTextNodesWithLineBreaks(remaining));
        break;
      }
    }
    
    return nodes;
  }
  
  // Create text nodes with line breaks
  createTextNodesWithLineBreaks(text) {
    const nodes = [];
    const lines = text.split('\n');
    
    lines.forEach((line, index) => {
      if (index > 0) {
        nodes.push(document.createElement('br'));
      }
      if (line) {
        nodes.push(document.createTextNode(line));
      }
    });
    
    return nodes;
  }
  
  // Parse links (safe)
  parseLinks(text) {
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const nodes = [];
    let lastIndex = 0;
    let match;
    
    while ((match = linkRegex.exec(text)) !== null) {
      // Add text before link
      if (match.index > lastIndex) {
        const textBefore = text.substring(lastIndex, match.index);
        nodes.push(document.createTextNode(textBefore));
      }
      
      // Create link element
      const link = document.createElement('a');
      link.href = this.sanitizeUrl(match[2]);
      link.textContent = match[1];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      nodes.push(link);
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      nodes.push(document.createTextNode(text.substring(lastIndex)));
    }
    
    return nodes;
  }
  
  // Sanitize URL to prevent XSS
  sanitizeUrl(url) {
    // Remove any javascript: or data: URLs
    if (url.match(/^(javascript|data):/i)) {
      return '#';
    }
    
    // Ensure URL is properly encoded
    try {
      return new URL(url).href;
    } catch {
      // If not a valid URL, treat as relative
      return url;
    }
  }
  
  // Escape HTML entities
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
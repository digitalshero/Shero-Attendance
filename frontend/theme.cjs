const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const newContent = content
    .replace(/\b(bg|text|border|ring|hover:bg|hover:text|hover:border|focus:ring|focus:border)-blue-(\d+)\b/g, '$1-teal-$2')
    .replace(/\bblue-(\d+)\/(\d+)\b/g, 'teal-$1/$2');
    
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles++;
    console.log('Updated:', file);
  }
});

console.log('Total files updated:', changedFiles);

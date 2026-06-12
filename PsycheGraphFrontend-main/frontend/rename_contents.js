import fs from 'fs';
import path from 'path';

const directory = 'c:/Users/Yuvaraj/Documents/Psygraph/Psygraph Frontend/PsycheGraphFrontend/frontend/src';

const replacements = [
  { match: /Practioners/g, replace: 'Practitioners' },
  { match: /practioners/g, replace: 'practitioners' },
  { match: /PRACTIONERS/g, replace: 'PRACTITIONERS' },
  { match: /Practioner/g, replace: 'Practitioner' },
  { match: /practioner/g, replace: 'practitioner' },
  { match: /PRACTIONER/g, replace: 'PRACTITIONER' },
];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  
  for (const { match, replace } of replacements) {
    newContent = newContent.replace(match, replace);
  }
  
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
      replaceInFile(fullPath);
    }
  }
}

processDirectory(directory);
console.log('Content replacement complete.');

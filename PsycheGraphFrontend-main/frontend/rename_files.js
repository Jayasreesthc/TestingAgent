import fs from 'fs';
import path from 'path';

const directory = 'c:/Users/Yuvaraj/Documents/Psygraph/Psygraph Frontend/PsycheGraphFrontend/frontend/src';

function renameFilesAndDirectories(dir) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    let newItemName = item;
    if (item.includes('Practioner')) {
      newItemName = item.replace(/Practioner/g, 'Practitioner');
    } else if (item.includes('practioner')) {
      newItemName = item.replace(/practioner/g, 'practitioner');
    }
    
    if (newItemName !== item) {
      const newPath = path.join(dir, newItemName);
      fs.renameSync(fullPath, newPath);
      console.log(`Renamed: ${fullPath} -> ${newPath}`);
      
      // If it's a directory we just renamed, process the new path
      if (stat.isDirectory()) {
         renameFilesAndDirectories(newPath);
      }
    } else if (stat.isDirectory()) {
      renameFilesAndDirectories(fullPath);
    }
  }
}

renameFilesAndDirectories(directory);
console.log('File and directory rename complete.');

const fs = require('fs');
const path = require('path');

const getExampleFiles = () => {
  const examplesDir = path.join(process.cwd(), 'public', 'examples');
  try {
    const files = fs.readdirSync(examplesDir);
    return files;
  } catch (error) {
    console.error('Error reading examples directory:', error);
    return [];
  }
};

module.exports = {
  getExampleFiles
}; 
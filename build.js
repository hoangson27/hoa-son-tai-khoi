const fs = require('fs');
const path = require('path');

const chaptersViDir = path.join(__dirname, 'chapters_vi');
const chaptersDir = path.join(__dirname, 'chapters');

if (!fs.existsSync(chaptersDir)) {
  fs.mkdirSync(chaptersDir);
}

const files = fs.readdirSync(chaptersViDir).filter(f => f.endsWith('.txt'));

// Parse numbers and sort
const chapters = files.map(file => {
  const match = file.match(/^(\d+)/);
  const number = match ? parseInt(match[1], 10) : 0;
  return { file, number };
}).filter(c => c.number > 0).sort((a, b) => a.number - b.number);

const manifestChapters = [];
let index = 0;

for (const { file, number } of chapters) {
  const filePath = path.join(chaptersViDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  
  let lines = content.split(/\r?\n/);
  
  let titlePart = '';
  let sourceLink = '';
  
  // Find first non-empty line
  let titleIndex = 0;
  while (titleIndex < lines.length && lines[titleIndex].trim() === '') {
    titleIndex++;
  }
  if (titleIndex < lines.length) {
    titlePart = lines[titleIndex].trim();
  }
  
  let linkIndex = titleIndex + 1;
  while (linkIndex < lines.length && lines[linkIndex].trim() === '') {
    linkIndex++;
  }
  if (linkIndex < lines.length && lines[linkIndex].trim().startsWith('http')) {
    sourceLink = lines[linkIndex].trim();
  } else {
    // If it's not a link, we just assume no link and body starts here
    linkIndex = titleIndex;
  }
  
  // Find where body starts
  let bodyStartIndex = linkIndex + 1;
  while (bodyStartIndex < lines.length) {
    const line = lines[bodyStartIndex].trim();
    if (line === '' || line === '~*~') {
      bodyStartIndex++;
    } else {
      break;
    }
  }
  
  let bodyLines = lines.slice(bodyStartIndex);
  let bodyContent = bodyLines.join('\n');
  
  const title = `Chương ${number}. ${titlePart}`;
  const chars = bodyContent.length;
  
  const jsonFile = `chapters/${number}.json`;
  
  const chapterData = {
    index,
    number,
    rangeEnd: null,
    title,
    source: sourceLink,
    body: bodyContent,
    status: 'ok'
  };
  
  fs.writeFileSync(path.join(__dirname, jsonFile), JSON.stringify(chapterData, null, 2), 'utf8');
  
  manifestChapters.push({
    index,
    number,
    rangeEnd: null,
    title,
    source: sourceLink,
    file: jsonFile,
    chars,
    status: 'ok'
  });
  
  index++;
}

const manifest = {
  name: "Hoa Son",
  generatedAt: new Date().toISOString(),
  count: manifestChapters.length,
  sourceFileCount: manifestChapters.length,
  firstChapter: manifestChapters[0]?.number || 0,
  lastChapter: manifestChapters[manifestChapters.length - 1]?.number || 0,
  missing: [],
  duplicateNumbers: [],
  chapters: manifestChapters
};

fs.writeFileSync(path.join(__dirname, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(`Successfully generated ${manifestChapters.length} chapters and manifest.json`);

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nodeModulesDir = path.join(__dirname, '..', 'node_modules');

function searchAndFix(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'android') {
          const buildGradle = path.join(fullPath, 'build.gradle');
          if (fs.existsSync(buildGradle)) {
            let content = fs.readFileSync(buildGradle, 'utf8');
            if (content.includes('proguard-android.txt')) {
              content = content.replace(/proguard-android\.txt/g, 'proguard-android-optimize.txt');
              fs.writeFileSync(buildGradle, content, 'utf8');
              console.log(`[fix-proguard] Updated ${buildGradle}`);
            }
          }
        } else if (!entry.name.startsWith('.') && entry.name !== 'build' && entry.name !== 'out') {
          searchAndFix(fullPath);
        }
      }
    }
  } catch (err) {
    // Ignore access/read errors for temporary folders
  }
}

searchAndFix(nodeModulesDir);

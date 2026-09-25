const fs = require('node:fs');
const path = require('node:path');

const FILES = {
  mois: 'mois.json',
  objectifs: 'objectifs.json',
  patrimoine: 'patrimoine.json',
};

function timestamp(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
}

function createStorage(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });

  const fileFor = (name) => {
    if (!Object.prototype.hasOwnProperty.call(FILES, name)) {
      throw new Error(`Fichier de données inconnu : ${name}`);
    }
    return path.join(dataDir, FILES[name]);
  };

  function loadAll() {
    const result = { dataDir, warnings: [] };
    for (const name of Object.keys(FILES)) {
      const file = fileFor(name);
      if (!fs.existsSync(file)) {
        result[name] = null;
        continue;
      }
      try {
        result[name] = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        // Never let a re-seed overwrite unreadable user data: move it aside first.
        const aside = path.join(dataDir, `${name}.illisible_${timestamp()}.json`);
        fs.renameSync(file, aside);
        result[name] = null;
        result.warnings.push(
          `${FILES[name]} était illisible. Il a été mis de côté sous « ${path.basename(aside)} » et les données de démarrage ont été rechargées.`,
        );
      }
    }
    return result;
  }

  function save(name, data) {
    if (data === null || typeof data !== 'object') {
      throw new Error('Données invalides');
    }
    const file = fileFor(name);
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  }

  function backupTo(folder) {
    const stamp = timestamp();
    const written = [];
    for (const [name, fileName] of Object.entries(FILES)) {
      const src = path.join(dataDir, fileName);
      if (!fs.existsSync(src)) continue;
      const dest = path.join(folder, `fianance_${name}_${stamp}.json`);
      fs.copyFileSync(src, dest);
      written.push(dest);
    }
    return written;
  }

  return { dataDir, loadAll, save, backupTo };
}

module.exports = { createStorage };

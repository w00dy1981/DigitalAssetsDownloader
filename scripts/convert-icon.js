const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');

async function convertIcon() {
  const { default: pngToIco } = await import('png-to-ico');
  const icon = await pngToIco(join(__dirname, '../AppIcon.png'));
  await writeFile(join(__dirname, '../build/icon.ico'), icon);
}

convertIcon().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

const pngToIco = require('png-to-ico').default || require('png-to-ico');
const fs = require('fs');
const path = require('path');

async function convertIcon() {
  try {
    const inputPath = path.join(__dirname, '../build/icon.png');
    const outputPath = path.join(__dirname, '../build/icon.ico');

    console.log('Converting PNG to ICO...');
    console.log('Input:', inputPath);
    console.log('Output:', outputPath);

    // Convert PNG to ICO with multiple sizes (16, 32, 48, 64, 128, 256)
    const icoBuffer = await pngToIco(inputPath);

    fs.writeFileSync(outputPath, icoBuffer);

    console.log('✓ Successfully created icon.ico');
    console.log(`✓ Icon saved to: ${outputPath}`);
  } catch (error) {
    console.error('✗ Error converting icon:', error.message);
    process.exit(1);
  }
}

convertIcon();

# Digital Asset Downloader

A modern, cross-platform desktop application for bulk downloading and processing digital assets (images, PDFs, etc.) from Excel/CSV data sources. Built with Electron, React, and TypeScript for professional workflows.

![Digital Asset Downloader](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.7-orange)

---

## ✨ Key Features

### 📊 **Data Processing**
- **Excel/CSV Support**: Load .xlsx, .xls, .xlsm, and .csv files
- **Multi-sheet Support**: Select and preview data from multiple sheets
- **Smart Column Mapping**: Map part numbers, image URLs, PDF URLs, and custom filenames

### 🚀 **Download Engine**
- **Multi-threaded Downloads**: Configurable concurrent downloads (1-20 threads)
- **Source Folder Search**: Find files by part number or custom filename matching
- **Advanced Retry Logic**: Exponential backoff with 3 attempts and 30s timeout
- **Progress Tracking**: Real-time progress with ETAs and success/failure counters

### 🎨 **Image Processing**
- **Smart Background Detection**: Automatic transparency detection and removal
- **PNG to JPEG Conversion**: Optimized 95% quality JPEG output
- **Batch Processing**: Process hundreds of images efficiently
- **Selective Processing**: Only processes images that actually need background fixes

### ⚙️ **Professional Features**
- **Network Path Logging**: Separate download paths vs. CSV log paths for enterprise workflows
- **Comprehensive CSV Logging**: Detailed logs matching enterprise reporting standards
- **Auto-Updates**: Automatic application updates via GitHub Releases
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Dark Theme**: Professional UI optimized for extended use

---

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript
- **Desktop**: Electron 28
- **Image Processing**: Sharp (cross-platform)
- **Excel Processing**: ExcelJS
- **HTTP Client**: Axios with retry logic
- **Configuration**: electron-store
- **Auto-Updates**: electron-updater

---

## 📦 Installation

### Windows (Recommended)
1. Go to [Releases](https://github.com/w00dy1981/DigitalAssetsDownloader/releases)
2. Download the latest `.exe` installer
3. Run the installer and follow the setup wizard
4. The app will auto-update when new versions are available

### macOS
1. Go to [Releases](https://github.com/w00dy1981/DigitalAssetsDownloader/releases)
2. Download the latest `.dmg` file
3. Open the DMG and drag the app to Applications
4. Launch from Applications folder

### Linux
1. Go to [Releases](https://github.com/w00dy1981/DigitalAssetsDownloader/releases)
2. Download the `.AppImage` or `.deb` file
3. Make executable and run: `chmod +x *.AppImage && ./Digital-Asset-Downloader*.AppImage`

---

## 🚀 Usage

### 1. **File Selection**
- Load your Excel/CSV file with drag & drop or file picker
- Select the appropriate sheet if using Excel
- Preview your data to ensure proper loading

### 2. **Column Configuration**
- **Part Number Column**: Required for file identification
- **Image URL Columns**: Select one or more columns containing image URLs
- **PDF URL Column**: Optional column for PDF downloads
- **Filename Column**: Optional for custom filename matching in source folders

### 3. **Download Setup**
- **Download Folders**: Choose where to save images and PDFs
- **Source Folders**: Optional local folders to search for existing files
- **Network Paths**: Enterprise logging paths (separate from download locations)
- **Processing Options**: Configure background removal and image quality

### 4. **Processing & Download**
- **Review Settings**: Verify all configuration before starting
- **Start Downloads**: Begin bulk download with real-time progress
- **Monitor Progress**: Track success/failure rates and ETAs
- **Review Results**: Export detailed CSV logs for reporting

---

## ⚙️ Configuration

### Settings Tab
Access via the Settings tab or `Ctrl/Cmd + ,`:

- **Default Paths**: Configure default locations for files and networks
- **Download Behavior**: Set concurrent downloads, timeouts, and retry logic
- **Image Processing**: Configure background removal and quality settings
- **UI Preferences**: Customize interface behavior and startup options
- **Update Settings**: Control automatic updates and release channels

### Auto-Save
All settings are automatically saved and restored between sessions.

---

## 🔄 Auto-Updates

The application includes a professional auto-update system:

- **Automatic Checking**: Checks for updates on startup (configurable)
- **Background Downloads**: Downloads updates without interrupting work
- **User Control**: Choose when to install updates
- **Release Channels**: Stable (recommended) or Beta (early access)
- **Manual Checks**: Check for updates anytime via Settings

---

## 🏢 Enterprise Features

### Network Path Integration
- **Separate Logging**: Download to local paths, log network paths to CSV
- **ERP Compatibility**: Works with existing enterprise file systems
- **Batch Processing**: Handle thousands of assets efficiently

### Comprehensive Logging
- **Detailed CSV Reports**: Include status, file sizes, processing info
- **Error Categorization**: Clear error messages for troubleshooting
- **Success Metrics**: Track completion rates and performance

### Configuration Management
- **Persistent Settings**: All preferences saved automatically
- **Import/Export**: Share configurations between users
- **Reset Options**: Restore defaults when needed

---

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Setup
```bash
# Clone the repository
git clone https://github.com/w00dy1981/DigitalAssetsDownloader.git
cd DigitalAssetsDownloader

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build Commands
```bash
# Build for production
npm run build

# Package for current platform
npm run dist

# Package for Windows
npm run dist:win

# Package for macOS
npm run dist:mac

# Package for Linux
npm run dist:linux
```

### Publishing Releases
```bash
# Set GitHub token
export GH_TOKEN="your_github_token"

# Publish new release
npm run publish
```

---

## 🐛 Troubleshooting

### Common Issues

**App won't start**
- Ensure you have the latest version installed
- Check Windows Defender/antivirus isn't blocking the app
- Try running as administrator (Windows)

**Downloads failing**
- Check internet connection
- Verify URLs are accessible
- Check firewall/proxy settings
- Review error messages in the progress log

**Excel files not loading**
- Ensure file isn't corrupted
- Try opening in Excel first to verify
- Check file permissions
- Supported formats: .xlsx, .xls, .xlsm, .csv

**Background processing not working**
- Enable background processing in settings
- Check that images actually have transparency
- Verify Sharp library is properly installed

### Getting Help
1. Check the [Issues](https://github.com/w00dy1981/DigitalAssetsDownloader/issues) page
2. Create a new issue with:
   - Operating system and version
   - Application version
   - Steps to reproduce the problem
   - Error messages or screenshots

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Sharp**: High-performance image processing
- **ExcelJS**: Excel file reading and writing
- **Electron**: Cross-platform desktop framework
- **React**: Modern UI framework

---

**Built for professional workflows. Designed for efficiency. Optimized for results.**
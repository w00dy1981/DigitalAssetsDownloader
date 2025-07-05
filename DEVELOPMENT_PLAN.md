# Digital Asset Downloader - Electron + React Migration Plan

## Project Overview

### Current State Analysis
- **Existing Application**: 2,485-line Python script with PySide6 GUI
- **Source File**: `/OLD_Standalone_App/Digital_Asset_Downloader.py`
- **Core Functionality**: 
  - Multi-threaded bulk downloads from Excel/CSV data
  - Advanced image processing with 4 background removal methods
  - Support for both URL downloads and local file copying
  - Intelligent filename matching from source folders
  - Comprehensive logging and error handling

### Key Code References from Original App

#### 1. **BackgroundProcessor Class** (Lines 45-287)
```python
class BackgroundProcessor:
    """Advanced background processing class with multiple methods"""
    def __init__(self, method="smart_detect", quality=95, edge_threshold=30):
```
- Contains 4 processing methods: `smart_detect`, `ai_removal`, `color_replace`, `edge_detection`
- Smart detection samples edge pixels and uses color clustering
- Supports configurable JPEG quality (60-100%)

#### 2. **DownloadWorker Class** (Lines 290-486)
```python
class DownloadWorker(QObject):
    """Worker object for handling downloads in a separate thread"""
```
Key methods to replicate:
- `sanitize_filename()` - Removes non-alphanumeric chars (Line 312)
- `convert_to_jpg()` - Image format conversion (Line 320)
- `download_file()` - Core download logic with retry (Line 332)
  - Handles both URLs and local file paths
  - Implements source folder searching
  - 5s connect timeout, 30s read timeout
  - 3 retry attempts with exponential backoff

#### 3. **Source Folder Search Logic** (Lines 340-362)
```python
# Check if we have a source folder and part number in the source folder
if source_folder and os.path.isdir(source_folder):
    # Look for files matching part_no in source folder
    for root, dirs, files in os.walk(source_folder):
        for file in files:
            if part_no and part_no.lower() in file.lower():
```
Critical feature: Searches source folders using part numbers OR custom filename column

#### 4. **Configuration Schema** (Lines 1200-1225)
```python
config = {
    "excel_file": self.excel_file,
    "sheet_name": self.current_sheet_name,
    "part_no_column": self.part_column_var.get(),
    "image_columns": [col for col, var in self.image_column_vars.items() if var.get()],
    "pdf_column": self.pdf_column_var.get(),
    "filename_column": self.filename_column_var.get(),
    "image_folder": self.image_folder_var.get(),
    "pdf_folder": self.pdf_folder_var.get(),
    "source_image_folder": self.source_image_folder_var.get(),
    "image_file_path": self.image_file_path_var.get(),
    "pdf_file_path": self.pdf_file_path_var.get(),
    "max_workers": self.thread_slider.value()
}
```

### Modernization Goals
- **Cross-platform desktop application** using Electron + React + TypeScript
- **Feature parity** with all existing functionality
- **Enhanced UI/UX** with modern design patterns
- **Improved performance** through better architecture
- **Easy distribution** with auto-update capability

---

## Phase 1: Project Setup & Foundation
**Session Goal**: Establish the development environment and basic project structure

### Core Setup Tasks
- [x] Initialize Electron + React + TypeScript project with proper folder structure
- [x] Configure webpack for main/renderer process separation
- [x] Set up ESLint, Prettier with strict TypeScript rules
- [x] Configure electron-builder for cross-platform builds
- [x] Set up development environment with hot reload

### Architecture Tasks
- [x] Create modular architecture separating concerns:
  - `/src/main` - Electron main process (file system, native dialogs)
  - `/src/renderer` - React application
  - `/src/shared` - Shared types and interfaces
  - `/src/services` - Business logic (downloads, processing)
  - `/src/workers` - Background workers for downloads/processing
- [x] Define TypeScript interfaces for all data models
- [x] Set up IPC communication patterns

### Basic Window & Navigation
- [x] Create main window with saved bounds persistence
- [x] Implement tab-based navigation matching original UI flow:
  - File Selection tab (ref: `create_file_selection_tab()` Line 690)
  - Column Selection tab (ref: `create_column_selection_tab()` Line 780)
  - Process/Download tab (ref: `create_process_tab()` Line 880)
- [x] Add basic styling framework (Material-UI or Ant Design)
- [x] Implement window state management

### Key UI Layout Reference (Lines 590-687)
```python
def __init__(self):
    self.setWindowTitle("Digital Asset Downloader")
    self.setMinimumSize(900, 700)
    # Tab widget setup
    self.tab_widget = QTabWidget()
```

### Session Handoff Notes
```
Phase 1 Complete Checklist:
- [x] `npm run dev` starts application with hot reload
- [x] Three-tab navigation structure working
- [x] Window size/position persists between sessions
- [x] TypeScript compilation has no errors
- [x] Basic IPC communication tested
```

---

## Phase 2: File Selection & Data Processing
**Session Goal**: Implement Excel/CSV file handling with sheet selection

### Excel/CSV Processing Tasks
- [ ] Install and configure ExcelJS for .xlsx/.xls/.xlsm support
- [ ] Implement file picker with drag & drop support
- [ ] Create sheet detection and selection UI
- [ ] Parse Excel data into structured format
- [ ] Handle different Excel formats (.xls requires special handling)

### File Selection UI Reference (Lines 690-780)
```python
def create_file_selection_tab(self):
    # Excel file selection
    self.excel_file_var = QLineEdit()
    self.browse_excel_btn = QPushButton("Browse...")
    
    # Sheet selection
    self.sheet_dropdown = QComboBox()
    self.load_sheet_btn = QPushButton("Load Sheet")
```

### Excel Loading Logic Reference (Lines 800-850)
```python
def load_excel_file(self, file_path):
    """Load Excel file and populate sheet dropdown"""
    try:
        self.excel_file = file_path
        if file_path.endswith('.xlsx') or file_path.endswith('.xlsm'):
            self.workbook = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        else:  # .xls files
            self.df_dict = pd.read_excel(file_path, sheet_name=None)
```

### Data Model Tasks
- [ ] Create TypeScript interfaces:
  ```typescript
  interface SpreadsheetData {
    columns: string[]
    rows: Record<string, any>[]
    sheetName: string
    filePath: string
  }
  ```
- [ ] Implement data validation for loaded sheets
- [ ] Add column type detection

### Session Handoff Notes
```
Phase 2 Complete Checklist:
- [ ] Excel files (.xlsx, .xls, .xlsm) load successfully
- [ ] Sheet selection dropdown populates correctly
- [ ] Data loads into memory with proper structure
- [ ] Error handling for invalid files works
- [ ] Navigation to Column Selection enabled after load
```

---

## Phase 3: Column Mapping & Configuration
**Session Goal**: Implement column selection UI with all mapping options

### Column Selection UI Reference (Lines 780-880)
```python
def create_column_selection_tab(self):
    # Part Number Column (required)
    self.part_column_var = StringVar()
    
    # Image URL Columns (multiple selection)
    self.image_column_vars = {}
    
    # PDF URL Column (single selection)
    self.pdf_column_var = StringVar()
    
    # Image Filename Column (for source folder matching)
    self.filename_column_var = StringVar()
```

### Column Selection Logic Reference (Lines 950-1000)
```python
def update_column_selection_ui(self):
    """Dynamically create column selection UI based on loaded data"""
    # Clear existing widgets
    for widget in self.column_frame.winfo_children():
        widget.destroy()
```

### Configuration Management Tasks
- [ ] Create configuration schema matching original (Line 1200):
  ```typescript
  interface DownloadConfig {
    excelFile: string
    sheetName: string
    partNoColumn: string
    imageColumns: string[]
    pdfColumn: string
    filenameColumn: string  // Key feature for source folder search
    imageFolder: string
    pdfFolder: string
    sourceImageFolder: string
    imageFilePath: string  // Network path for logging
    pdfFilePath: string    // Network path for logging
    maxWorkers: number
    backgroundProcessing: {
      enabled: boolean
      method: 'smart_detect' | 'ai_removal' | 'color_replace' | 'edge_detection'
      quality: number
      edgeThreshold: number
    }
  }
  ```

### Validation Reference (Lines 1050-1100)
```python
def validate_download_config(self):
    """Validate configuration before allowing downloads"""
    if not self.part_column_var.get():
        QMessageBox.warning(self, "Configuration Error", "Please select a Part Number column")
        return False
```

### Session Handoff Notes
```
Phase 3 Complete Checklist:
- [ ] All column types can be selected correctly
- [ ] Configuration saves to ~/.digital_asset_downloader/
- [ ] Previous configuration loads on startup
- [ ] Column selection state persists during navigation
- [ ] Validation prevents invalid configurations
```

---

## Phase 4: Advanced Download Engine
**Session Goal**: Port the sophisticated download functionality with all features

### Download Manager Core Reference (Lines 290-486)
```python
class DownloadWorker(QObject):
    """Worker object for handling downloads in a separate thread"""
    progress = Signal(dict)  # Signal to update progress
    finished = Signal()  # Signal when all downloads complete
```

### Key Download Features to Implement:

#### 1. Source Folder Search (Lines 340-362)
```python
if source_folder and os.path.isdir(source_folder):
    # Look for files matching part_no in source folder
    for root, dirs, files in os.walk(source_folder):
        for file in files:
            if part_no and part_no.lower() in file.lower():
                # Found matching file
            elif specific_filename and specific_filename.lower() in file.lower():
                # Found file matching custom filename column
```

#### 2. Download Logic (Lines 380-450)
```python
def download_file(self, url, filepath, retry_count=3):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    for attempt in range(retry_count):
        try:
            response = requests.get(url, headers=headers, stream=True, 
                                  timeout=(5, 30))  # 5s connect, 30s read
```

#### 3. Filename Sanitization (Line 312)
```python
def sanitize_filename(self, name):
    """Remove all non-alphanumeric characters except underscores"""
    name_str = str(name)
    name_str = re.sub(r'\s+', '_', name_str)
    return re.sub(r'[^a-zA-Z0-9_]', '', name_str)
```

### Network Path Features Reference (Lines 1150-1180)
```python
# Separate paths for actual download vs. logging
local_filepath = os.path.join(image_folder, f"{part_no}.jpg")
network_filepath = os.path.join(image_file_path, f"{part_no}.jpg")  # For CSV log
```

### Session Handoff Notes
```
Phase 4 Complete Checklist:
- [ ] Downloads work for URLs and local files
- [ ] Source folder searching finds files correctly
- [ ] Retry logic handles transient failures
- [ ] Progress tracking updates in real-time
- [ ] Network paths log separately from download paths
```

---

## Phase 5: Advanced Image Processing
**Session Goal**: Implement all four background processing methods

### BackgroundProcessor Class Reference (Lines 45-287)

#### 1. Smart Background Detection (Lines 95-150)
```python
def smart_background_detection(self, image):
    """Intelligent background detection and replacement"""
    # Sample points from edges and corners
    sample_points = []
    edge_width = min(10, width // 10)
    
    # Find dominant background color using clustering
    from collections import Counter
    color_counter = Counter(sample_colors)
```

#### 2. AI Background Removal (Lines 85-93)
```python
def ai_background_removal(self, image):
    """Use AI-based background removal (requires rembg)"""
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='PNG')
    result = remove(img_byte_arr.getvalue())
```

#### 3. Color Range Replacement (Lines 200-230)
```python
def color_based_replacement(self, image):
    """Replace specific color ranges with white background"""
    background_colors = [
        ([0, 177, 64], [100, 255, 150]),    # Green screen
        ([40, 40, 40], [80, 255, 80]),      # Dark gray
        ([0, 0, 0], [50, 50, 50]),          # Black
    ]
```

#### 4. Edge Detection Method (Lines 240-287)
```python
def edge_based_removal(self, image):
    """Use edge detection to identify and remove background"""
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 50, self.edge_threshold)
```

### Processing Configuration Dialog Reference (Lines 490-580)
```python
class BackgroundProcessingDialog(QDialog):
    """Dialog for configuring background processing options"""
    # Method selection
    # Quality slider (60-100%)
    # Edge threshold control
    # Test with sample image
```

### Session Handoff Notes
```
Phase 5 Complete Checklist:
- [ ] All four processing methods work correctly
- [ ] Test image preview shows results
- [ ] JPEG conversion maintains quality
- [ ] Processing doesn't block UI
- [ ] Settings persist between sessions
```

---

## Phase 6: Process Tab & Download UI
**Session Goal**: Create the main download interface with all controls

### Process Tab UI Reference (Lines 880-1050)
```python
def create_process_tab(self):
    # Download Folders group
    self.image_folder_var = StringVar()
    self.source_image_folder_var = StringVar()  # Optional source folder
    self.pdf_folder_var = StringVar()
    
    # File Paths (for network logging)
    self.image_file_path_var = StringVar()
    self.pdf_file_path_var = StringVar()
    
    # Download Options
    self.thread_slider = QSlider(Qt.Horizontal)
    self.thread_slider.setRange(1, 20)
```

### Progress Tracking Reference (Lines 1400-1450)
```python
def update_download_progress(self, progress_info):
    """Update UI with download progress"""
    self.current_file_label.setText(f"Current: {progress_info['current_file']}")
    self.successful_label.setText(f"✓ Successful: {progress_info['successful']}")
    self.failed_label.setText(f"✗ Failed: {progress_info['failed']}")
    
    # Color-coded progress bar
    if success_rate > 0.8:
        self.progress_bar.setStyleSheet("QProgressBar::chunk { background-color: #28a745; }")
```

### CSV Logging Reference (Lines 1460-1500)
```python
def write_to_log(self, item, result):
    """Write download result to CSV log"""
    log_data = [
        row_num,
        part_no,
        url,
        status,
        http_status,
        content_type,
        file_size,
        message,
        local_file_path,
        network_file_path,
        "Yes" if background_processed else "No"
    ]
```

### Control Button Logic Reference (Lines 1100-1150)
```python
def start_downloads(self):
    """Start the download process"""
    # Validate configuration
    # Prepare download items
    # Create worker thread
    # Toggle UI state
```

### Session Handoff Notes
```
Phase 6 Complete Checklist:
- [ ] All UI controls function correctly
- [ ] Progress updates smoothly without blocking
- [ ] Cancel stops downloads gracefully
- [ ] Log file generates with all columns
- [ ] Summary shows real-time updates
```

---

## Phase 7: Advanced Features & Polish
**Session Goal**: Add completion dialogs, shortcuts, and final touches

### Completion Dialog Reference (Lines 500-560)
```python
class CompletionDialog(QDialog):
    """Dialog displayed when downloads are complete"""
    def __init__(self, successful, failed, log_file, parent=None):
        # Show success/failure counts
        # Display log file location
        # Provide "View Log" button
```

### Configuration Auto-load Reference (Lines 1600-1650)
```python
def check_previous_config(self):
    """Check for previous configuration and offer to load"""
    if os.path.exists(self.config_file):
        reply = QMessageBox.question(
            self, "Previous Configuration",
            "A previous configuration was found. Would you like to load it?",
            QMessageBox.Yes | QMessageBox.No
        )
```

### User Experience Enhancements
- [ ] Add keyboard shortcuts:
  - Ctrl/Cmd+O: Open Excel file
  - Ctrl/Cmd+S: Save configuration
  - Tab/Shift+Tab: Navigation
- [ ] Implement tooltips for all controls
- [ ] Add input validation with error messages
- [ ] Create help documentation

### Performance Optimization
- [ ] Implement virtual scrolling for large datasets
- [ ] Add download chunking for memory efficiency
- [ ] Optimize image processing with worker threads
- [ ] Add caching for processed images

### Session Handoff Notes
```
Phase 7 Complete Checklist:
- [ ] Completion dialog shows correct stats
- [ ] Keyboard shortcuts work correctly
- [ ] Large files (1000+ rows) perform well
- [ ] Memory usage stays under 200MB
- [ ] All tooltips and help text present
```

---

## Phase 8: Testing, Distribution & Release
**Session Goal**: Comprehensive testing and release preparation

### Testing Suite
- [ ] Unit tests for:
  - Download manager logic
  - Image processing algorithms
  - File path handling
  - Configuration management
- [ ] Integration tests for:
  - Excel to download pipeline
  - Source folder searching
  - Background processing flow
- [ ] E2E tests for complete workflows

### Critical Test Cases from Original App:
1. **Source Folder Search** (Lines 340-362)
   - Test with part numbers
   - Test with custom filename column
   - Test case-insensitive matching
   
2. **Filename Sanitization** (Line 312)
   - Test special character removal
   - Test space replacement with underscores
   
3. **Image Conversion** (Line 320)
   - Test PNG to JPG conversion
   - Test quality settings

### Distribution Setup
- [ ] Configure electron-builder for:
  - Windows installer (.exe)
  - macOS DMG with code signing
  - Linux AppImage and .deb
- [ ] Implement auto-updater
- [ ] Create portable versions

### Session Handoff Notes
```
Phase 8 Complete Checklist:
- [ ] All tests pass with >80% coverage
- [ ] Installers build for all platforms
- [ ] Auto-update tested and working
- [ ] Documentation complete and reviewed
- [ ] Ready for v1.0.0 release
```

---

## Technical Architecture

### Frontend Stack
- **Framework**: React 18 with TypeScript
- **UI Library**: Material-UI v5 or Ant Design
- **State Management**: Zustand or Redux Toolkit
- **Styling**: Emotion with theme support
- **Forms**: React Hook Form with validation

### Backend Stack
- **Runtime**: Node.js 18+ with Electron
- **Excel Processing**: ExcelJS
- **Image Processing**: Sharp + custom algorithms
- **HTTP Client**: Axios with retry interceptors
- **File System**: Node.js fs with promises
- **Workers**: Node.js Worker Threads

### Key Libraries
- **AI Background Removal**: rembg-node or TensorFlow.js
- **Image Processing**: Sharp for Node.js
- **CSV Generation**: fast-csv
- **Path Handling**: path and url modules
- **Configuration**: electron-store

---

## Feature Parity Checklist with Code References

### Core Features
- [ ] Excel file support (.xlsx, .xls, .xlsm) - Line 800
- [ ] Multiple sheet selection - Line 810
- [ ] Column mapping (part number, images, PDFs, filename) - Line 780
- [ ] URL downloading with retry - Line 380
- [ ] Local file copying from source folders - Line 340
- [ ] Directory scanning for images - Line 345
- [ ] Smart filename matching - Line 350
- [ ] Network path logging separate from download paths - Line 1150

### Image Processing
- [ ] Format conversion to JPEG - Line 320
- [ ] Smart background detection - Line 95
- [ ] AI background removal - Line 85
- [ ] Color range replacement - Line 200
- [ ] Edge detection method - Line 240
- [ ] Quality settings (60-100%) - Line 47
- [ ] Processing preview - Line 520

### UI/UX Features
- [ ] Three-tab navigation flow - Line 590
- [ ] Drag & drop file selection - Line 700
- [ ] Real-time progress tracking - Line 1400
- [ ] Success/failure counters - Line 1410
- [ ] Elapsed time display - Line 1420
- [ ] Scrollable summary log - Line 900
- [ ] Color-coded progress bar - Line 1430
- [ ] Processing indicators - Line 1440

### Configuration
- [ ] Save/load previous settings - Line 1200
- [ ] Auto-load on startup prompt - Line 1600
- [ ] Configuration persistence - Line 1210
- [ ] Folder path memory - Line 1220
- [ ] Column selection memory - Line 1230

### Advanced Features
- [ ] Concurrent download control (1-20) - Line 890
- [ ] Cancellation support - Line 1500
- [ ] Comprehensive CSV logging - Line 1460
- [ ] Platform-specific file opening - Line 550
- [ ] Completion dialog - Line 500
- [ ] Error categorization - Line 400
- [ ] Retry with exponential backoff - Line 390

---

## Migration Considerations

### Data Compatibility
- Ensure CSV log format matches original (Line 1460)
- Maintain same filename sanitization rules (Line 312)
- Keep network path format consistent (Line 1150)

### User Experience
- Preserve three-tab workflow (Line 590)
- Keep similar control layouts
- Maintain keyboard shortcuts where possible

### Performance Targets
- Match or exceed Python version speed
- Reduce memory usage
- Improve startup time

---

*This document should be updated as development progresses. Each phase should be completed fully before moving to the next. Line numbers reference the original Digital_Asset_Downloader.py file.*
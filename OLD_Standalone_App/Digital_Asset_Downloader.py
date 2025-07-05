import sys
import os
import pandas as pd
import time
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from PIL import Image, ImageFilter
import io
import csv
import re
import logging
import numpy as np
from urllib.parse import urlparse
import shutil
from rembg import remove  # For advanced background removal
import cv2  # For advanced image processing

from PySide6.QtWidgets import (
    QApplication, QMainWindow, QTabWidget, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QProgressBar, QFileDialog, QComboBox,
    QCheckBox, QRadioButton, QScrollArea, QFrame, QGridLayout, QGroupBox,
    QMessageBox, QSpacerItem, QSizePolicy, QTextEdit, QSlider, QDialog,
    QSpinBox, QButtonGroup
)
from PySide6.QtCore import Qt, QSize, QThread, Signal, QObject, Slot, QTimer
from PySide6.QtGui import QIcon, QFont, QPixmap, QColor, QPalette

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("digital-asset-downloader")

class BackgroundProcessor:
    """Advanced background processing class with multiple methods"""
    
    def __init__(self, method="smart_detect", quality=95, edge_threshold=30):
        self.method = method
        self.quality = quality
        self.edge_threshold = edge_threshold
    
    def process_image(self, image_data):
        """Main processing method that routes to appropriate background removal technique"""
        try:
            image = Image.open(io.BytesIO(image_data))
            
            # Convert to RGB if needed
            if image.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                if image.mode == 'RGBA':
                    background.paste(image, mask=image.split()[-1])
                else:
                    background.paste(image)
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Route to appropriate processing method
            if self.method == "ai_removal":
                processed_image = self.ai_background_removal(image)
            elif self.method == "color_replace":
                processed_image = self.color_based_replacement(image)
            elif self.method == "edge_detection":
                processed_image = self.edge_based_removal(image)
            elif self.method == "smart_detect":
                processed_image = self.smart_background_detection(image)
            else:
                processed_image = image
            
            # Convert back to bytes
            output = io.BytesIO()
            processed_image.save(output, format='JPEG', quality=self.quality)
            return output.getvalue()
            
        except Exception as e:
            logger.error(f"Background processing failed: {str(e)}")
            return image_data  # Return original if processing fails
    
    def ai_background_removal(self, image):
        """Use AI-based background removal (requires rembg)"""
        try:
            # Convert PIL to bytes for rembg
            img_bytes = io.BytesIO()
            image.save(img_bytes, format='PNG')
            img_bytes = img_bytes.getvalue()
            
            # Remove background using AI
            output = remove(img_bytes)
            
            # Convert back to PIL and place on white background
            result_image = Image.open(io.BytesIO(output))
            if result_image.mode == 'RGBA':
                background = Image.new('RGB', result_image.size, (255, 255, 255))
                background.paste(result_image, mask=result_image.split()[-1])
                return background
            
            return result_image
        except Exception as e:
            logger.warning(f"AI background removal failed, falling back to smart detection: {str(e)}")
            return self.smart_background_detection(image)
    
    def smart_background_detection(self, image):
        """Intelligent background detection and replacement"""
        img_array = np.array(image)
        height, width, _ = img_array.shape
        
        # Sample points from edges and corners
        sample_points = []
        edge_width = min(10, width // 10)  # Sample from edge strip
        edge_height = min(10, height // 10)
        
        # Top and bottom edges
        for x in range(0, width, max(1, width // 20)):
            for y in range(edge_height):
                sample_points.append((y, x))
                sample_points.append((height - 1 - y, x))
        
        # Left and right edges
        for y in range(0, height, max(1, height // 20)):
            for x in range(edge_width):
                sample_points.append((y, x))
                sample_points.append((y, width - 1 - x))
        
        # Get colors at sample points
        sample_colors = []
        for y, x in sample_points:
            if 0 <= y < height and 0 <= x < width:
                sample_colors.append(tuple(img_array[y, x]))
        
        if not sample_colors:
            return image
        
        # Find dominant background color using clustering
        from collections import Counter
        color_counter = Counter(sample_colors)
        
        # Get most common colors
        common_colors = color_counter.most_common(5)
        
        for bg_color, count in common_colors:
            # Check if this color is likely a background (not white-ish)
            brightness = sum(bg_color) / 3
            
            # Skip if already white/light gray
            if brightness > 240:
                continue
            
            # Check color consistency
            if self.is_solid_background_color(img_array, bg_color):
                return self.replace_background_color(img_array, bg_color)
        
        return image
    
    def is_solid_background_color(self, img_array, bg_color, threshold=25):
        """Check if a color appears to be a solid background"""
        height, width, _ = img_array.shape
        
        # Check corners more thoroughly
        corner_regions = [
            (0, 0, min(50, height//4), min(50, width//4)),  # Top-left
            (0, max(0, width-50), min(50, height//4), width),  # Top-right
            (max(0, height-50), 0, height, min(50, width//4)),  # Bottom-left
            (max(0, height-50), max(0, width-50), height, width)  # Bottom-right
        ]
        
        matching_pixels = 0
        total_pixels = 0
        
        for y1, x1, y2, x2 in corner_regions:
            for y in range(y1, y2, 2):  # Sample every other pixel for performance
                for x in range(x1, x2, 2):
                    total_pixels += 1
                    pixel = img_array[y, x]
                    color_distance = sum(abs(int(pixel[k]) - int(bg_color[k])) for k in range(3))
                    if color_distance < threshold:
                        matching_pixels += 1
        
        # If more than 60% of corner pixels match this color, it's likely background
        return (matching_pixels / total_pixels) > 0.6 if total_pixels > 0 else False
    
    def replace_background_color(self, img_array, bg_color, threshold=30):
        """Replace background color with white"""
        height, width, _ = img_array.shape
        result_array = img_array.copy()
        
        # Create mask for background pixels
        mask = np.zeros((height, width), dtype=bool)
        
        for y in range(height):
            for x in range(width):
                pixel = img_array[y, x]
                color_distance = sum(abs(int(pixel[k]) - int(bg_color[k])) for k in range(3))
                if color_distance < threshold:
                    mask[y, x] = True
        
        # Apply morphological operations to clean up mask
        try:
            import cv2
            mask_uint8 = mask.astype(np.uint8) * 255
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
            mask_uint8 = cv2.morphologyEx(mask_uint8, cv2.MORPH_CLOSE, kernel)
            mask = mask_uint8 > 0
        except ImportError:
            pass  # Skip morphological operations if OpenCV not available
        
        # Replace background with white
        result_array[mask] = [255, 255, 255]
        
        logger.info(f"Replaced background color {bg_color} with white")
        return Image.fromarray(result_array)
    
    def color_based_replacement(self, image):
        """Replace specific color ranges with white background"""
        img_array = np.array(image)
        height, width, _ = img_array.shape
        
        # Define common background colors to replace
        background_colors = [
            # Green screen colors
            ([0, 177, 64], [100, 255, 150]),    # Bright green range
            ([40, 40, 40], [80, 255, 80]),      # Green range
            # Black/dark colors
            ([0, 0, 0], [50, 50, 50]),          # Black to dark gray
            # Blue screen colors
            ([100, 149, 237], [135, 206, 250]), # Light blue range
            ([0, 0, 139], [0, 0, 255]),         # Dark to bright blue
        ]
        
        result_array = img_array.copy()
        replaced = False
        
        for lower, upper in background_colors:
            # Create mask for this color range
            mask = np.all((img_array >= lower) & (img_array <= upper), axis=2)
            
            if np.sum(mask) > (height * width * 0.1):  # If more than 10% of image matches
                result_array[mask] = [255, 255, 255]
                replaced = True
                logger.info(f"Replaced color range {lower}-{upper} with white")
        
        return Image.fromarray(result_array) if replaced else image
    
    def edge_based_removal(self, image):
        """Use edge detection to identify and remove background"""
        try:
            import cv2
            
            # Convert to OpenCV format
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Apply Gaussian blur
            blurred = cv2.GaussianBlur(cv_image, (5, 5), 0)
            
            # Edge detection
            edges = cv2.Canny(blurred, 50, 150)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                # Find the largest contour (likely the main subject)
                largest_contour = max(contours, key=cv2.contourArea)
                
                # Create mask
                mask = np.zeros(edges.shape, dtype=np.uint8)
                cv2.fillPoly(mask, [largest_contour], 255)
                
                # Apply morphological operations to smooth the mask
                kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (10, 10))
                mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
                mask = cv2.GaussianBlur(mask, (5, 5), 0)
                
                # Create result image
                result = np.full_like(np.array(image), 255)  # White background
                mask_3d = np.stack([mask, mask, mask], axis=2) / 255.0
                
                result = (np.array(image) * mask_3d + result * (1 - mask_3d)).astype(np.uint8)
                
                return Image.fromarray(result)
        
        except ImportError:
            logger.warning("OpenCV not available for edge-based removal, falling back to smart detection")
            return self.smart_background_detection(image)
        except Exception as e:
            logger.error(f"Edge-based removal failed: {str(e)}")
            return image
        
        return image


class DownloadWorker(QObject):
    """Worker object for handling downloads in a separate thread"""
    progress = Signal(dict)  # Signal to update progress
    finished = Signal()  # Signal when all downloads complete
    
    def __init__(self, download_items, max_workers=5, bg_processor=None):
        super().__init__()
        self.download_items = download_items
        self.max_workers = max_workers
        self.cancelled = False
        self.bg_processor = bg_processor
        
    def cancel(self):
        """Cancel the download process"""
        self.cancelled = True
        
    def get_file_extension(self, url, default_ext):
        """Determine file extension from URL or Content-Type"""
        # For images, always return .jpg
        if default_ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']:
            return '.jpg'
        return default_ext
        
    def sanitize_filename(self, name):
        """Remove all non-alphanumeric characters except underscores for filenames only"""
        # Convert to string in case input is numeric
        name_str = str(name)
        # Replace any whitespace with underscore
        name_str = re.sub(r'\s+', '_', name_str)
        # Keep only alphanumeric characters and underscores
        return re.sub(r'[^a-zA-Z0-9_]', '', name_str)
    
    def convert_to_jpg(self, image_data):
        """Convert image data to JPG format"""
        try:
            image = Image.open(io.BytesIO(image_data))
            if image.mode in ('RGBA', 'LA'):
                # Convert RGBA images to RGB by placing on white background
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[-1])
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=95)
            return output.getvalue()
        except Exception as e:
            raise Exception(f"Image conversion failed: {str(e)}")
            
    def download_file(self, url, filepath, retry_count=3, part_no=None, source_folder=None, specific_filename=None):
        """Download file method with robust error handling and timeouts"""
        # Check if we have a source folder and part number in the source folder
        if source_folder and os.path.isdir(source_folder):
            try:
                # Search for files matching the part number or filename in the source folder
                matching_files = []
                
                # If we have a specific filename from the filename column, use that first
                if specific_filename:
                    specific_filename = specific_filename.lower()
                    for file in os.listdir(source_folder):
                        if specific_filename in file.lower():
                            full_path = os.path.join(source_folder, file)
                            if os.path.isfile(full_path):
                                matching_files.append(full_path)
                
                # If no matches with specific filename, fall back to part number
                if not matching_files and part_no:
                    part_no_clean = str(part_no).strip().lower()
                    for file in os.listdir(source_folder):
                        if part_no_clean in file.lower():
                            full_path = os.path.join(source_folder, file)
                            if os.path.isfile(full_path):
                                matching_files.append(full_path)
                
                # If matching files found, use the first one
                if matching_files:
                    # Create directory if it doesn't exist
                    os.makedirs(os.path.dirname(filepath), exist_ok=True)
                    
                    # Read and process the file
                    with open(matching_files[0], 'rb') as f:
                        content = f.read()
                    
                    # Process the image if it's an image file and background processor is enabled
                    if (self.bg_processor and 
                        any(matching_files[0].lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp'])):
                        try:
                            content = self.bg_processor.process_image(content)
                        except Exception as e:
                            logger.warning(f"Background processing failed for {matching_files[0]}: {str(e)}")
                    
                    # Write processed content
                    with open(filepath, 'wb') as f:
                        f.write(content)
                    
                    return {
                        'success': True,
                        'status_code': 200,
                        'content_type': 'local_file_processed',
                        'size': len(content),
                        'message': f'File copied and processed from source folder'
                    }
                else:
                    return {
                        'success': False,
                        'status_code': 0,
                        'content_type': '',
                        'size': 0,
                        'message': f'No files matching part number {part_no} found in source folder'
                    }
                    
            except Exception as e:
                return {
                    'success': False,
                    'status_code': 0,
                    'content_type': '',
                    'size': 0,
                    'message': f'Error accessing source folder: {str(e)}'
                }
        
        # Check if the URL is a local directory
        if os.path.isdir(url):
            try:
                # Path is a directory, look for image files in it
                image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp']
                found_files = []
                
                # Search for image files in the directory
                for file in os.listdir(url):
                    full_path = os.path.join(url, file)
                    if os.path.isfile(full_path) and any(file.lower().endswith(ext) for ext in image_extensions):
                        found_files.append(full_path)
                
                # If image files found, use the first one
                if found_files:
                    # Create directory if it doesn't exist
                    os.makedirs(os.path.dirname(filepath), exist_ok=True)
                    
                    # Read and process the file
                    with open(found_files[0], 'rb') as f:
                        content = f.read()
                    
                    # Process background if enabled
                    if self.bg_processor:
                        try:
                            content = self.bg_processor.process_image(content)
                        except Exception as e:
                            logger.warning(f"Background processing failed: {str(e)}")
                    
                    # Write processed content
                    with open(filepath, 'wb') as f:
                        f.write(content)
                    
                    return {
                        'success': True,
                        'status_code': 200,
                        'content_type': 'local_file_processed',
                        'size': len(content),
                        'message': f'File copied and processed from directory ({len(found_files)} images found)'
                    }
                else:
                    return {
                        'success': False,
                        'status_code': 0,
                        'content_type': '',
                        'size': 0,
                        'message': 'No image files found in directory'
                    }
                    
            except Exception as e:
                return {
                    'success': False,
                    'status_code': 0,
                    'content_type': '',
                    'size': 0,
                    'message': f'Error accessing directory: {str(e)}'
                }
        
        # Check if the URL is a local file path
        elif os.path.isfile(url):  # If the URL is a valid local file path
            try:
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                
                # Read and process the file
                with open(url, 'rb') as f:
                    content = f.read()
                
                # Process background if it's an image and processor is enabled
                if (self.bg_processor and 
                    any(url.lower().endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp'])):
                    try:
                        content = self.bg_processor.process_image(content)
                    except Exception as e:
                        logger.warning(f"Background processing failed: {str(e)}")
                
                # Write processed content
                with open(filepath, 'wb') as f:
                    f.write(content)
                
                return {
                    'success': True,
                    'status_code': 200,
                    'content_type': 'local_file_processed',
                    'size': len(content),
                    'message': 'File copied and processed successfully'
                }
            except Exception as e:
                return {
                    'success': False,
                    'status_code': 0,
                    'content_type': '',
                    'size': 0,
                    'message': f'Error copying file: {str(e)}'
                }
        
        # Handle normal URLs
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        for attempt in range(retry_count):
            try:
                # Use session for better connection handling
                with requests.Session() as session:
                    # Set timeouts for connect and read operations
                    response = session.get(
                        url, 
                        headers=headers, 
                        timeout=(5, 30),  # (connect timeout, read timeout)
                        stream=True  # Stream response for large files
                    )
                    response.raise_for_status()
                    
                    # Get content in chunks to avoid memory issues
                    content = b''
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            content += chunk
                    
                    content_type = response.headers.get('Content-Type', '')
                    
                    # Convert images to JPG and process background
                    if content_type.startswith('image/') and not filepath.lower().endswith('.pdf'):
                        try:
                            content = self.convert_to_jpg(content)
                            
                            # Process background if enabled
                            if self.bg_processor:
                                content = self.bg_processor.process_image(content)
                        except Exception as e:
                            if attempt == retry_count - 1:
                                return {
                                    'success': False,
                                    'status_code': response.status_code,
                                    'content_type': content_type,
                                    'size': 0,
                                    'message': f"Image processing failed: {str(e)}"
                                }
                            continue  # Try again if not last attempt
                    
                    # Create directory if it doesn't exist
                    os.makedirs(os.path.dirname(filepath), exist_ok=True)
                    
                    # Write file in binary mode
                    with open(filepath, 'wb') as f:
                        f.write(content)
                    
                    return {
                        'success': True,
                        'status_code': response.status_code,
                        'content_type': content_type,
                        'size': len(content),
                        'message': 'Success'
                    }
                    
            except requests.exceptions.Timeout:
                if attempt == retry_count - 1:
                    return {
                        'success': False,
                        'status_code': 0,
                        'content_type': '',
                        'size': 0,
                        'message': f'Timeout error after {retry_count} attempts'
                    }
                time.sleep(2 ** attempt)  # Exponential backoff
                
            except requests.exceptions.RequestException as e:
                if attempt == retry_count - 1:
                    return {
                        'success': False,
                        'status_code': getattr(e.response, 'status_code', 0) if hasattr(e, 'response') else 0,
                        'content_type': '',
                        'size': 0,
                        'message': str(e)
                    }
                time.sleep(2 ** attempt)  # Exponential backoff
                
            except Exception as e:
                if attempt == retry_count - 1:
                    return {
                        'success': False,
                        'status_code': 0,
                        'content_type': '',
                        'size': 0,
                        'message': f'Unexpected error: {str(e)}'
                    }
                time.sleep(2 ** attempt)  # Exponential backoff
    
    def process_downloads(self):
        """Process all downloads using thread pool"""
        total = len(self.download_items)
        processed = 0
        successful = 0
        failed = 0
        results = []
        
        # Work in smaller batches to prevent overwhelming resources
        batch_size = min(10, self.max_workers * 2)
        
        for i in range(0, total, batch_size):
            if self.cancelled:
                break
                
            batch = self.download_items[i:i + batch_size]
            
            with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
                futures = {}
                
                # Submit tasks
                for item in batch:
                    if self.cancelled:
                        break
                    future = executor.submit(
                        self.download_file, 
                        item['url'], 
                        item['filepath'],
                        3,  # retry_count
                        item.get('part_no', None),  # part_no 
                        item.get('source_folder', None),  # source_folder
                        item.get('specific_filename', None)  # specific_filename
                    )
                    futures[future] = item
                
                # Process completed downloads
                for future in as_completed(futures):
                    if self.cancelled:
                        # Cancel remaining futures
                        for f in futures:
                            if not f.done():
                                f.cancel()
                        break
                        
                    item = futures[future]
                    try:
                        result = future.result(timeout=60)
                        
                        # Record result
                        results.append({
                            'item': item,
                            'result': result
                        })
                        
                        if result['success']:
                            successful += 1
                        else:
                            failed += 1
                            
                        # Update progress
                        processed += 1
                        progress_info = {
                            'current': processed,
                            'total': total,
                            'successful': successful,
                            'failed': failed,
                            'item': item,
                            'result': result
                        }
                        self.progress.emit(progress_info)
                        
                    except Exception as e:
                        # Handle exceptions from future
                        results.append({
                            'item': item,
                            'result': {
                                'success': False,
                                'status_code': 0,
                                'content_type': '',
                                'size': 0,
                                'message': str(e)
                            }
                        })
                        
                        failed += 1
                        processed += 1
                        
                        progress_info = {
                            'current': processed,
                            'total': total,
                            'successful': successful,
                            'failed': failed,
                            'item': item,
                            'result': {
                                'success': False,
                                'status_code': 0,
                                'content_type': '',
                                'size': 0,
                                'message': str(e)
                            }
                        }
                        self.progress.emit(progress_info)
            
            # Small delay between batches
            time.sleep(0.1)
        
        self.finished.emit()
        return results


class CompletionDialog(QDialog):
    """Dialog displayed when downloads are complete"""
    def __init__(self, successful, failed, log_file, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Download Complete")
        self.setMinimumWidth(500)
        self.setMinimumHeight(400)
        
        layout = QVBoxLayout()
        self.setLayout(layout)
        
        # Header
        header = QLabel("✓ Download Process Complete")
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_font = QFont()
        header_font.setPointSize(16)
        header_font.setBold(True)
        header.setFont(header_font)
        layout.addWidget(header)
        
        # Results frame
        results_frame = QFrame()
        results_layout = QVBoxLayout()
        results_frame.setLayout(results_layout)
        results_frame.setFrameShape(QFrame.Shape.StyledPanel)
        results_frame.setStyleSheet("background-color: #f8f9fa; border-radius: 5px;")
        
        # Success count
        success_layout = QHBoxLayout()
        success_icon = QLabel("✓")
        success_icon.setStyleSheet("color: #28a745;")  # Green
        success_label = QLabel(f"Successful: {successful}")
        success_layout.addWidget(success_icon)
        success_layout.addWidget(success_label)
        success_layout.addStretch()
        results_layout.addLayout(success_layout)
        
        # Failed count
        failed_layout = QHBoxLayout()
        failed_icon = QLabel("✗")
        failed_icon.setStyleSheet("color: #dc3545;")  # Red
        failed_label = QLabel(f"Failed: {failed}")
        failed_layout.addWidget(failed_icon)
        failed_layout.addWidget(failed_label)
        failed_layout.addStretch()
        results_layout.addLayout(failed_layout)
        
        # Log file info
        log_layout = QHBoxLayout()
        log_icon = QLabel("📝")
        log_text = QTextEdit()
        log_text.setPlainText(f"Log file saved to:\n{log_file}")
        log_text.setReadOnly(True)
        log_text.setMaximumHeight(60)
        log_layout.addWidget(log_icon)
        log_layout.addWidget(log_text)
        results_layout.addLayout(log_layout)
        
        layout.addWidget(results_frame)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        view_log_btn = QPushButton("View Log")
        view_log_btn.setStyleSheet(
            "background-color: #007bff; color: white; padding: 8px; border-radius: 4px;"
        )
        view_log_btn.clicked.connect(lambda: self.open_log_file(log_file))
        
        close_btn = QPushButton("Close")
        close_btn.setStyleSheet(
            "background-color: #28a745; color: white; padding: 8px; border-radius: 4px;"
        )
        close_btn.clicked.connect(self.accept)
        
        button_layout.addWidget(view_log_btn)
        button_layout.addStretch()
        button_layout.addWidget(close_btn)
        
        layout.addLayout(button_layout)
        
    def open_log_file(self, log_file):
        """Open the log file if it exists"""
        if os.path.exists(log_file):
            # Use platform-appropriate method to open file
            if sys.platform == 'win32':
                os.startfile(log_file)
            elif sys.platform == 'darwin':  # macOS
                import subprocess
                subprocess.call(('open', log_file))
            else:  # Linux
                import subprocess
                subprocess.call(('xdg-open', log_file))


class BackgroundProcessingDialog(QDialog):
    """Dialog for configuring background processing options"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Background Processing Configuration")
        self.setMinimumWidth(500)
        self.setMinimumHeight(350)
        
        layout = QVBoxLayout()
        self.setLayout(layout)
        
        # Header
        header = QLabel("🎨 Background Processing Settings")
        header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        header_font = QFont()
        header_font.setPointSize(16)
        header_font.setBold(True)
        header.setFont(header_font)
        layout.addWidget(header)
        
        # Processing method selection
        method_group = QGroupBox("Processing Method")
        method_layout = QVBoxLayout()
        method_group.setLayout(method_layout)
        
        self.method_group = QButtonGroup()
        
        # Smart Detection (default)
        self.smart_radio = QRadioButton("Smart Detection (Recommended)")
        self.smart_radio.setChecked(True)
        self.smart_radio.setToolTip("Automatically detects and replaces solid color backgrounds")
        method_layout.addWidget(self.smart_radio)
        self.method_group.addButton(self.smart_radio, 0)
        
        # AI Removal
        self.ai_radio = QRadioButton("AI Background Removal (Advanced)")
        self.ai_radio.setToolTip("Uses AI models for precise background removal (requires rembg library)")
        method_layout.addWidget(self.ai_radio)
        self.method_group.addButton(self.ai_radio, 1)
        
        # Color Replace
        self.color_radio = QRadioButton("Color Range Replacement")
        self.color_radio.setToolTip("Replaces specific color ranges (green screen, black, etc.)")
        method_layout.addWidget(self.color_radio)
        self.method_group.addButton(self.color_radio, 2)
        
        # Edge Detection
        self.edge_radio = QRadioButton("Edge Detection")
        self.edge_radio.setToolTip("Uses edge detection to identify subjects (requires OpenCV)")
        method_layout.addWidget(self.edge_radio)
        self.method_group.addButton(self.edge_radio, 3)
        
        layout.addWidget(method_group)
        
        # Quality settings
        quality_group = QGroupBox("Quality Settings")
        quality_layout = QGridLayout()
        quality_group.setLayout(quality_layout)
        
        # JPEG Quality
        quality_label = QLabel("JPEG Quality:")
        self.quality_spin = QSpinBox()
        self.quality_spin.setRange(60, 100)
        self.quality_spin.setValue(95)
        self.quality_spin.setSuffix("%")
        quality_layout.addWidget(quality_label, 0, 0)
        quality_layout.addWidget(self.quality_spin, 0, 1)
        
        # Edge threshold (for edge detection)
        threshold_label = QLabel("Edge Threshold:")
        self.threshold_spin = QSpinBox()
        self.threshold_spin.setRange(10, 100)
        self.threshold_spin.setValue(30)
        self.threshold_spin.setToolTip("Lower values = more sensitive edge detection")
        quality_layout.addWidget(threshold_label, 1, 0)
        quality_layout.addWidget(self.threshold_spin, 1, 1)
        
        layout.addWidget(quality_group)
        
        # Preview section
        preview_group = QGroupBox("Preview & Test")
        preview_layout = QVBoxLayout()
        preview_group.setLayout(preview_layout)
        
        test_btn = QPushButton("Test with Sample Image")
        test_btn.setStyleSheet(
            "background-color: #17a2b8; color: white; padding: 8px; border-radius: 4px;"
        )
        test_btn.clicked.connect(self.test_processing)
        preview_layout.addWidget(test_btn)
        
        self.preview_label = QLabel("Select an image to test the background processing")
        self.preview_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.preview_label.setStyleSheet("border: 2px dashed #ccc; padding: 20px; margin: 10px;")
        preview_layout.addWidget(self.preview_label)
        
        layout.addWidget(preview_group)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        cancel_btn = QPushButton("Cancel")
        cancel_btn.setStyleSheet(
            "background-color: #6c757d; color: white; padding: 8px; border-radius: 4px;"
        )
        cancel_btn.clicked.connect(self.reject)
        
        ok_btn = QPushButton("Apply Settings")
        ok_btn.setStyleSheet(
            "background-color: #28a745; color: white; padding: 8px; border-radius: 4px;"
        )
        ok_btn.clicked.connect(self.accept)
        
        button_layout.addWidget(cancel_btn)
        button_layout.addStretch()
        button_layout.addWidget(ok_btn)
        
        layout.addLayout(button_layout)
    
    def test_processing(self):
        """Test background processing with a sample image"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select Test Image",
            "",
            "Image Files (*.jpg *.jpeg *.png *.gif *.bmp);;All Files (*.*)"
        )
        
        if not file_path:
            return
        
        try:
            # Create processor with current settings
            processor = self.get_processor()
            
            # Read and process the image
            with open(file_path, 'rb') as f:
                original_data = f.read()
            
            processed_data = processor.process_image(original_data)
            
            # Save processed image temporarily
            temp_dir = os.path.join(os.path.expanduser("~"), ".digital_asset_downloader", "temp")
            os.makedirs(temp_dir, exist_ok=True)
            
            original_path = os.path.join(temp_dir, "original.jpg")
            processed_path = os.path.join(temp_dir, "processed.jpg")
            
            with open(original_path, 'wb') as f:
                f.write(original_data)
            
            with open(processed_path, 'wb') as f:
                f.write(processed_data)
            
            # Show result message
            QMessageBox.information(
                self,
                "Processing Complete",
                f"Background processing test completed!\n\n"
                f"Original: {original_path}\n"
                f"Processed: {processed_path}\n\n"
                f"Check the processed image to see the results."
            )
            
            # Update preview
            self.preview_label.setText(f"✓ Processed: {os.path.basename(file_path)}")
            self.preview_label.setStyleSheet("border: 2px solid #28a745; padding: 20px; margin: 10px; color: #28a745;")
            
        except Exception as e:
            QMessageBox.critical(
                self,
                "Processing Error",
                f"Error during background processing test:\n{str(e)}"
            )
    
    def get_processor(self):
        """Get configured background processor"""
        method_map = {
            0: "smart_detect",
            1: "ai_removal",
            2: "color_replace",
            3: "edge_detection"
        }
        
        method = method_map[self.method_group.checkedId()]
        quality = self.quality_spin.value()
        threshold = self.threshold_spin.value()
        
        return BackgroundProcessor(method=method, quality=quality, edge_threshold=threshold)


class DigitalAssetDownloader(QMainWindow):
    """Main application window for Digital Asset Downloader"""
    def __init__(self):
        super().__init__()
        
        # Initialize class attributes
        self.image_columns = []
        self.selected_pdf_column = ""
        self.selected_part_column = ""
        self.summary_label = None  # Will be initialized in create_process_tab
        self.bg_processor = None  # Background processor instance
        
        # Initialize app properties
        self.setWindowTitle("Digital Asset Downloader - Enhanced")
        self.setMinimumSize(900, 700)
        
        # Initialize data storage
        self.df = None
        self.available_sheets = []
        self.available_columns = []
        self.download_thread = None
        self.download_worker = None
        
        # Initialize configuration with empty values
        self.config = {
            "excel_file": "",
            "sheet_name": "",
            "part_no_column": "",
            "image_columns": [],
            "pdf_column": "",
            "image_folder": "",
            "pdf_folder": "",
            "max_workers": 5,
            "image_file_path": "",
            "pdf_file_path": "",
            "source_image_folder": "",
            "filename_column": "",
            "background_processing": {
                "enabled": False,
                "method": "smart_detect",
                "quality": 95,
                "edge_threshold": 30
            }
        }
        
        # Create central widget and main layout
        self.central_widget = QWidget()
        self.setCentralWidget(self.central_widget)
        
        self.main_layout = QVBoxLayout()
        self.central_widget.setLayout(self.main_layout)
        
        # Create application header
        self.create_header()
        
        # Create tab widget
        self.tab_widget = QTabWidget()
        self.main_layout.addWidget(self.tab_widget)
        
        # Create tab pages
        self.create_file_selection_tab()
        self.create_column_selection_tab()
        self.create_process_tab()
        
        # Create status bar
        self.create_status_bar()
        
        # Timer for elapsed time tracking
        self.elapsed_timer = QTimer()
        self.elapsed_timer.timeout.connect(self.update_elapsed_time)
        self.start_time = None
        
        # Connect tab changed signal
        self.tab_widget.currentChanged.connect(self.on_tab_changed)
    
    def create_header(self):
        """Create application header with title and styling"""
        header_frame = QFrame()
        header_layout = QVBoxLayout()
        header_frame.setLayout(header_layout)
        header_frame.setStyleSheet("background-color: #f8f9fa; border-radius: 5px;")
        
        # Title layout
        title_layout = QHBoxLayout()
        
        # App icon (could be replaced with an actual icon)
        icon_label = QLabel("📥")
        icon_font = QFont()
        icon_font.setPointSize(24)
        icon_label.setFont(icon_font)
        
        # Title text
        title_label = QLabel("Digital Asset Downloader - Enhanced")
        title_font = QFont()
        title_font.setPointSize(18)
        title_font.setBold(True)
        title_label.setFont(title_font)
        
        # Version
        version_label = QLabel("v2.0")
        version_label.setStyleSheet("color: gray;")
        
        title_layout.addWidget(icon_label)
        title_layout.addWidget(title_label)
        title_layout.addWidget(version_label)
        title_layout.addStretch()
        
        header_layout.addLayout(title_layout)
        
        self.main_layout.addWidget(header_frame)
    
    def create_file_selection_tab(self):
        """Create tab for Excel/CSV file selection"""
        file_tab = QWidget()
        file_layout = QVBoxLayout()
        file_tab.setLayout(file_layout)
        
        # Excel File Selection
        excel_group = QGroupBox("Excel File Selection")
        excel_layout = QGridLayout()
        excel_group.setLayout(excel_layout)
        
        excel_label = QLabel("Excel File:")
        excel_label.setFont(QFont("", 10, QFont.Weight.Bold))
        self.excel_path_edit = QLineEdit()
        self.excel_path_edit.setReadOnly(True)
        browse_excel_btn = QPushButton("Browse")
        browse_excel_btn.clicked.connect(self.browse_excel_file)
        
        excel_layout.addWidget(excel_label, 0, 0)
        excel_layout.addWidget(self.excel_path_edit, 0, 1)
        excel_layout.addWidget(browse_excel_btn, 0, 2)
        
        # Sheet Selection
        sheet_label = QLabel("Sheet Name:")
        sheet_label.setFont(QFont("", 10, QFont.Weight.Bold))
        self.sheet_combo = QComboBox()
        self.sheet_combo.setMinimumWidth(250)
        self.sheet_combo.setEnabled(False)
        load_sheet_btn = QPushButton("Load Sheet")
        load_sheet_btn.clicked.connect(self.load_sheet)
        load_sheet_btn.setEnabled(False)
        
        excel_layout.addWidget(sheet_label, 1, 0)
        excel_layout.addWidget(self.sheet_combo, 1, 1)
        excel_layout.addWidget(load_sheet_btn, 1, 2)
        
        # Add to layout
        file_layout.addWidget(excel_group)
        
        # Instructions
        instructions = QLabel(
            "1. Select an Excel file containing URLs to download\n"
            "2. Choose the sheet containing your data\n"
            "3. Click 'Load Sheet' to load your data"
        )
        instructions.setAlignment(Qt.AlignmentFlag.AlignLeft)
        instructions.setStyleSheet("color: #6c757d; margin: 20px;")
        file_layout.addWidget(instructions)
        
        # Add spacer
        file_layout.addStretch()
        
        # Navigation buttons
        button_layout = QHBoxLayout()
        
        next_btn = QPushButton("Next →")
        next_btn.setStyleSheet(
            "background-color: #6f42c1; color: white; padding: 10px; font-weight: bold; border-radius: 4px;"
        )
        next_btn.setMinimumWidth(120)
        next_btn.clicked.connect(self.on_next_clicked)
        
        button_layout.addStretch()
        button_layout.addWidget(next_btn)
        
        file_layout.addLayout(button_layout)
        
        # Connect signals
        self.excel_path_edit.textChanged.connect(self.update_sheet_controls)
        self.sheet_combo.currentTextChanged.connect(self.update_load_sheet_button)
        
        # Add tab
        self.tab_widget.addTab(file_tab, "File Selection")
        
    def create_column_selection_tab(self):
        """Create tab for column selection"""
        column_tab = QWidget()
        column_layout = QVBoxLayout()
        column_tab.setLayout(column_layout)
        
        # Create scrollable area for columns
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setFrameShape(QFrame.Shape.NoFrame)
        
        # Container for column selections
        self.column_container = QWidget()
        self.column_layout = QVBoxLayout()
        self.column_container.setLayout(self.column_layout)
        
        # Add placeholder text
        self.column_placeholder = QLabel(
            "Please load an Excel file and sheet first.\n"
            "Then columns will appear here for selection."
        )
        self.column_placeholder.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.column_placeholder.setStyleSheet("color: #6c757d; margin: 40px;")
        self.column_layout.addWidget(self.column_placeholder)
        
        scroll_area.setWidget(self.column_container)
        column_layout.addWidget(scroll_area)
        
        # Navigation buttons
        button_layout = QHBoxLayout()
        
        back_btn = QPushButton("← Back")
        back_btn.setStyleSheet(
            "background-color: #6c757d; color: white; padding: 10px; border-radius: 4px;"
        )
        back_btn.setMinimumWidth(100)
        back_btn.clicked.connect(lambda: self.tab_widget.setCurrentIndex(0))
        
        refresh_btn = QPushButton("Refresh Columns")
        refresh_btn.setStyleSheet(
            "background-color: #17a2b8; color: white; padding: 10px; border-radius: 4px;"
        )
        refresh_btn.clicked.connect(self.refresh_columns)
        
        next_btn = QPushButton("Next →")
        next_btn.setStyleSheet(
            "background-color: #6f42c1; color: white; padding: 10px; font-weight: bold; border-radius: 4px;"
        )
        next_btn.setMinimumWidth(100)
        next_btn.clicked.connect(lambda: self.tab_widget.setCurrentIndex(2))
        
        button_layout.addWidget(back_btn)
        button_layout.addWidget(refresh_btn)
        button_layout.addStretch()
        button_layout.addWidget(next_btn)
        
        column_layout.addLayout(button_layout)
        
        # Add tab
        self.tab_widget.addTab(column_tab, "Column Selection")
    
    def create_process_tab(self):
        """Create tab for processing downloads"""
        process_tab = QWidget()
        process_layout = QVBoxLayout()
        process_tab.setLayout(process_layout)
        
        # Folder selection group
        folder_group = QGroupBox("Download Folders")
        folder_layout = QGridLayout()
        folder_group.setLayout(folder_layout)
        
        # Image folder
        img_label = QLabel("Image Download Folder:")
        img_label.setFont(QFont("", 10, QFont.Weight.Bold))
        self.img_folder_edit = QLineEdit()
        self.img_folder_edit.setReadOnly(True)
        img_browse_btn = QPushButton("Browse")
        img_browse_btn.clicked.connect(self.browse_image_folder)
        
        folder_layout.addWidget(img_label, 0, 0)
        folder_layout.addWidget(self.img_folder_edit, 0, 1)
        folder_layout.addWidget(img_browse_btn, 0, 2)
        
        # Source image folder (for local file copying)
        source_img_label = QLabel("Source Image Folder:")
        source_img_label.setFont(QFont("", 10, QFont.Weight.Bold))
        self.source_img_folder_edit = QLineEdit()
        self.source_img_folder_edit.setReadOnly(True)
        self.source_img_folder_edit.setPlaceholderText("Optional: Select folder containing source images")
        source_img_browse_btn = QPushButton("Browse")
        source_img_browse_btn.clicked.connect(self.browse_source_image_folder)

        folder_layout.addWidget(source_img_label, 1, 0)
        folder_layout.addWidget(self.source_img_folder_edit, 1, 1)
        folder_layout.addWidget(source_img_browse_btn, 1, 2)
        
        # Change image filename pattern field to File Path
        img_filename_label = QLabel("File Path:")
        img_filename_label.setFont(QFont("", 10, QFont.Weight.Bold))
        self.img_filename_pattern = QLineEdit()
        self.img_filename_pattern.setPlaceholderText("Enter full network path (e.g., 'U:\\old_g\\IMAGES\\ABM Product Images')")
        img_filename_help = QLabel("Part number and .jpg extension will be added automatically")
        img_filename_help.setStyleSheet("color: gray; font-size: 9pt;")
        
        folder_layout.addWidget(img_filename_label, 2, 0)
        folder_layout.addWidget(self.img_filename_pattern, 2, 1)
        folder_layout.addWidget(img_filename_help, 2, 2)
        
        # PDF folder
        pdf_label = QLabel("PDF Download Folder:")
        pdf_label.setFont(QFont("", 10, QFont.Weight.Bold))
        self.pdf_folder_edit = QLineEdit()
        self.pdf_folder_edit.setReadOnly(True)
        pdf_browse_btn = QPushButton("Browse")
        pdf_browse_btn.clicked.connect(self.browse_pdf_folder)
        
        folder_layout.addWidget(pdf_label, 3, 0)
        folder_layout.addWidget(self.pdf_folder_edit, 3, 1)
        folder_layout.addWidget(pdf_browse_btn, 3, 2)
        
        # Change PDF filename pattern field to File Path
        pdf_filename_label = QLabel("File Path:")
        pdf_filename_label.setFont(QFont("", 10, QFont.Weight.Bold))
        self.pdf_filename_pattern = QLineEdit()
        self.pdf_filename_pattern.setPlaceholderText("Enter full network path (e.g., 'U:\\old_g\\IMAGES\\Product pdf\\'s')")
        pdf_filename_help = QLabel("Part number and .pdf extension will be added automatically")
        pdf_filename_help.setStyleSheet("color: gray; font-size: 9pt;")
        
        folder_layout.addWidget(pdf_filename_label, 4, 0)
        folder_layout.addWidget(self.pdf_filename_pattern, 4, 1)
        folder_layout.addWidget(pdf_filename_help, 4, 2)
        
        process_layout.addWidget(folder_group)
        
        # Download options group
        options_group = QGroupBox("Download Options")
        options_layout = QVBoxLayout()
        options_group.setLayout(options_layout)
        
        # Thread count slider
        thread_layout = QHBoxLayout()
        thread_label = QLabel("Concurrent Downloads:")
        thread_label.setMinimumWidth(150)
        
        self.thread_slider = QSlider(Qt.Orientation.Horizontal)
        self.thread_slider.setMinimum(1)
        self.thread_slider.setMaximum(20)
        self.thread_slider.setValue(5)
        self.thread_slider.setTickPosition(QSlider.TickPosition.TicksBelow)
        self.thread_slider.setTickInterval(1)
        
        self.thread_value_label = QLabel("5")
        self.thread_value_label.setMinimumWidth(30)
        self.thread_slider.valueChanged.connect(self.update_thread_value)
        
        thread_layout.addWidget(thread_label)
        thread_layout.addWidget(self.thread_slider)
        thread_layout.addWidget(self.thread_value_label)
        
        options_layout.addLayout(thread_layout)
        
        # Enhanced background processing options
        bg_process_layout = QHBoxLayout()
        self.auto_process_bg = QCheckBox("Enable Background Processing")
        self.auto_process_bg.setChecked(False)
        self.auto_process_bg.setToolTip("Automatically detect and convert colored backgrounds to white")
        self.auto_process_bg.toggled.connect(self.on_background_processing_toggled)
        
        self.config_bg_btn = QPushButton("Configure")
        self.config_bg_btn.setStyleSheet(
            "background-color: #6f42c1; color: white; padding: 5px 15px; border-radius: 3px;"
        )
        self.config_bg_btn.setEnabled(False)
        self.config_bg_btn.clicked.connect(self.configure_background_processing)
        
        bg_process_layout.addWidget(self.auto_process_bg)
        bg_process_layout.addWidget(self.config_bg_btn)
        bg_process_layout.addStretch()
        options_layout.addLayout(bg_process_layout)
        
        # Background processing status
        self.bg_status_label = QLabel("Background Processing: Disabled")
        self.bg_status_label.setStyleSheet("color: #6c757d; font-style: italic;")
        options_layout.addWidget(self.bg_status_label)
        
        # Statistics frame
        stats_frame = QFrame()
        stats_layout = QHBoxLayout()
        stats_frame.setLayout(stats_layout)
        stats_frame.setFrameShape(QFrame.Shape.StyledPanel)
        stats_frame.setStyleSheet("background-color: #f8f9fa; border-radius: 5px;")
        
        # Current file
        self.current_file_label = QLabel("Current: None")
        self.current_file_label.setMinimumWidth(200)
        
        # Success counter
        success_layout = QHBoxLayout()
        success_icon = QLabel("✓")
        success_icon.setStyleSheet("color: #28a745;")  # Green
        self.success_counter = QLabel("Successful: 0")
        success_layout.addWidget(success_icon)
        success_layout.addWidget(self.success_counter)
        
        # Failed counter
        failed_layout = QHBoxLayout()
        failed_icon = QLabel("✗")
        failed_icon.setStyleSheet("color: #dc3545;")  # Red
        self.fail_counter = QLabel("Failed: 0")
        failed_layout.addWidget(failed_icon)
        failed_layout.addWidget(self.fail_counter)
        
        # Elapsed time
        self.elapsed_time_label = QLabel("Elapsed: 0:00")
        
        stats_layout.addWidget(self.current_file_label)
        stats_layout.addLayout(success_layout)
        stats_layout.addLayout(failed_layout)
        stats_layout.addStretch()
        stats_layout.addWidget(self.elapsed_time_label)
        
        options_layout.addWidget(stats_frame)
        
        process_layout.addWidget(options_group)
        
        # Summary section
        summary_group = QGroupBox("Download Summary")
        summary_layout = QVBoxLayout()
        summary_group.setLayout(summary_layout)
        
        # Initialize summary label
        self.summary_label = QLabel("Ready to start downloads.")
        summary_layout.addWidget(self.summary_label)
        
        self.summary_text = QTextEdit()
        self.summary_text.setReadOnly(True)
        self.summary_text.setPlainText(
            "Ready to start downloads.\n\n"
            "Configure your file and column selections in the previous tabs, "
            "then click 'Start Downloads' to begin the process."
        )
        
        summary_layout.addWidget(self.summary_text)
        process_layout.addWidget(summary_group)
        
        # Button layout
        button_layout = QHBoxLayout()
        
        back_btn = QPushButton("← Back")
        back_btn.setStyleSheet(
            "background-color: #6c757d; color: white; padding: 10px; border-radius: 4px;"
        )
        back_btn.setMinimumWidth(100)
        back_btn.clicked.connect(lambda: self.tab_widget.setCurrentIndex(1))
        
        self.cancel_btn = QPushButton("Cancel")
        self.cancel_btn.setStyleSheet(
            "background-color: #dc3545; color: white; padding: 10px; font-weight: bold; border-radius: 4px;"
        )
        self.cancel_btn.setMinimumWidth(120)
        self.cancel_btn.clicked.connect(self.cancel_downloads)
        self.cancel_btn.setEnabled(False)
        
        self.start_btn = QPushButton("Start Downloads")
        self.start_btn.setStyleSheet(
            "background-color: #28a745; color: white; padding: 10px; font-weight: bold; border-radius: 4px;"
        )
        self.start_btn.setMinimumWidth(150)
        self.start_btn.clicked.connect(self.start_downloads)
        
        button_layout.addWidget(back_btn)
        button_layout.addStretch()
        button_layout.addWidget(self.cancel_btn)
        button_layout.addWidget(self.start_btn)
        
        process_layout.addLayout(button_layout)
        
        # Add tab
        self.tab_widget.addTab(process_tab, "Process")
    
    def on_background_processing_toggled(self, checked):
        """Handle background processing checkbox toggle"""
        self.config_bg_btn.setEnabled(checked)
        self.config["background_processing"]["enabled"] = checked
        
        if checked:
            self.bg_status_label.setText("Background Processing: Enabled (Smart Detection)")
            self.bg_status_label.setStyleSheet("color: #28a745; font-style: italic;")
            # Create default processor
            self.bg_processor = BackgroundProcessor()
        else:
            self.bg_status_label.setText("Background Processing: Disabled")
            self.bg_status_label.setStyleSheet("color: #6c757d; font-style: italic;")
            self.bg_processor = None
    
    def configure_background_processing(self):
        """Open background processing configuration dialog"""
        dialog = BackgroundProcessingDialog(self)
        
        # Load current settings
        bg_config = self.config["background_processing"]
        method_map = {
            "smart_detect": 0,
            "ai_removal": 1,
            "color_replace": 2,
            "edge_detection": 3
        }
        
        dialog.method_group.button(method_map.get(bg_config["method"], 0)).setChecked(True)
        dialog.quality_spin.setValue(bg_config["quality"])
        dialog.threshold_spin.setValue(bg_config["edge_threshold"])
        
        if dialog.exec() == QDialog.DialogCode.Accepted:
            # Update configuration
            processor = dialog.get_processor()
            self.bg_processor = processor
            
            # Update config
            self.config["background_processing"]["method"] = processor.method
            self.config["background_processing"]["quality"] = processor.quality
            self.config["background_processing"]["edge_threshold"] = processor.edge_threshold
            
            # Update status label
            method_names = {
                "smart_detect": "Smart Detection",
                "ai_removal": "AI Removal",
                "color_replace": "Color Replacement",
                "edge_detection": "Edge Detection"
            }
            method_name = method_names.get(processor.method, "Smart Detection")
            self.bg_status_label.setText(f"Background Processing: Enabled ({method_name})")
    
    def create_status_bar(self):
        """Create application status bar"""
        status_bar = self.statusBar()
        self.status_label = QLabel("Ready")
        status_bar.addPermanentWidget(self.status_label, 1)
        
        # Set default status message
        self.update_status("Ready", "info")
    
    def update_status(self, message, status_type="info"):
        """Update status bar with message and appropriate styling"""
        self.status_label.setText(message)
        
        if status_type == "error":
            self.status_label.setStyleSheet("color: #dc3545;")  # Red
        elif status_type == "warning":
            self.status_label.setStyleSheet("color: #ffc107;")  # Yellow
        elif status_type == "success":
            self.status_label.setStyleSheet("color: #28a745;")  # Green
        else:
            self.status_label.setStyleSheet("")  # Default
    
    def browse_excel_file(self):
        """Browse for and select Excel file"""
        file_path, _ = QFileDialog.getOpenFileName(
            self,
            "Select Excel File",
            "",
            "Excel Files (*.xlsx *.xls *.xlsm);;All Files (*.*)"
        )
        
        if file_path:
            self.excel_path_edit.setText(file_path)
            self.config["excel_file"] = file_path
            self.load_excel_file(file_path)
    
    def load_excel_file(self, file_path):
        """Load Excel file and populate sheet names"""
        try:
            # Determine engine based on file extension
            if file_path.endswith('.xls'):
                engine = 'xlrd'
            else:  # xlsx or xlsm
                engine = 'openpyxl'
            
            # Get sheet names from the Excel file
            xls = pd.ExcelFile(file_path, engine=engine)
            self.available_sheets = xls.sheet_names
            
            # Update sheet dropdown
            self.sheet_combo.clear()
            self.sheet_combo.addItems(self.available_sheets)
            self.sheet_combo.setEnabled(True)
            
            # Auto-select first sheet
            if self.available_sheets:
                self.sheet_combo.setCurrentIndex(0)
            
            self.update_status(f"Loaded Excel file with {len(self.available_sheets)} sheet(s)", "success")
            
            return True
        except Exception as e:
            QMessageBox.critical(
                self,
                "Error",
                f"Error loading Excel file: {str(e)}"
            )
            self.update_status(f"Error loading Excel file: {str(e)}", "error")
            return False
    
    def update_sheet_controls(self):
        """Update sheet selection controls based on Excel file path"""
        if self.excel_path_edit.text():
            self.sheet_combo.setEnabled(True)
        else:
            self.sheet_combo.setEnabled(False)
            self.sheet_combo.clear()
    
    def update_load_sheet_button(self):
        """Update Load Sheet button state based on sheet selection"""
        sheet_name = self.sheet_combo.currentText()
        if sheet_name and self.excel_path_edit.text():
            # Enable the Load Sheet button - find it by searching all children
            for child in self.findChildren(QPushButton):
                if child.text() == "Load Sheet":
                    child.setEnabled(True)
                    return
    
    def load_sheet(self):
        """Load the selected sheet from Excel file"""
        sheet_name = self.sheet_combo.currentText()
        file_path = self.excel_path_edit.text()
        
        if not sheet_name or not file_path:
            self.update_status("Please select an Excel file and sheet first", "warning")
            return False
        
        try:
            # Determine engine based on file extension
            if file_path.endswith('.xls'):
                engine = 'xlrd'
            else:  # xlsx or xlsm
                engine = 'openpyxl'
            
            # Load the data
            self.df = pd.read_excel(
                file_path,
                sheet_name=sheet_name,
                engine=engine
            )
            
            # Get column names and store them
            self.available_columns = list(self.df.columns)
            
            # Update the configuration
            self.config["sheet_name"] = sheet_name
            
            # Force clear any previous column selections to avoid conflicts
            self.config["image_columns"] = []
            self.config["pdf_column"] = ""
            self.config["part_no_column"] = ""
            
            # Update column selection UI
            self.update_column_selection_ui()
            
            # Update status
            self.update_status(f"Loaded sheet '{sheet_name}' with {len(self.available_columns)} columns", "success")
            
            # Auto-switch to column selection tab
            self.tab_widget.setCurrentIndex(1)
            
            return True
        
        except Exception as e:
            QMessageBox.critical(
                self,
                "Error",
                f"Error loading sheet: {str(e)}"
            )
            self.update_status(f"Error loading sheet: {str(e)}", "error")
            return False
    
    def update_column_selection_ui(self):
        """Update the column selection UI with available columns"""
        # Clear existing widgets from column container
        while self.column_layout.count():
            item = self.column_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        
        if not self.available_columns:
            # Show placeholder if no columns are available
            self.column_placeholder = QLabel(
                "Please load an Excel file and sheet first.\n"
                "Then columns will appear here for selection."
            )
            self.column_placeholder.setAlignment(Qt.AlignmentFlag.AlignCenter)
            self.column_placeholder.setStyleSheet("color: #6c757d; margin: 40px;")
            self.column_layout.addWidget(self.column_placeholder)
            return
        
        # Part Number Column Section
        part_group = QGroupBox("Part Number Column (required)")
        part_group.setStyleSheet("QGroupBox { font-weight: bold; }")
        part_layout = QVBoxLayout()
        part_group.setLayout(part_layout)
        
        part_description = QLabel("Select the column containing your product identifiers:")
        part_layout.addWidget(part_description)
        
        # Create radio buttons in a grid layout
        part_grid = QGridLayout()
        self.part_no_radios = {}
        
        for i, col in enumerate(self.available_columns):
            row = i // 3
            column = i % 3
            
            radio = QRadioButton(col)
            if col == self.config["part_no_column"]:
                radio.setChecked(True)
            
            # Connect radio button
            radio.toggled.connect(lambda checked, c=col: self.on_part_column_selected(c) if checked else None)
            self.part_no_radios[col] = radio
            
            part_grid.addWidget(radio, row, column)
        
        part_layout.addLayout(part_grid)
        self.column_layout.addWidget(part_group)
        
        # Image URLs Section
        img_group = QGroupBox("Image URL Columns (optional)")
        img_group.setStyleSheet("QGroupBox { font-weight: bold; }")
        img_layout = QVBoxLayout()
        img_group.setLayout(img_layout)
        
        img_description = QLabel("Select columns containing image URLs to download:")
        img_layout.addWidget(img_description)
        
        # Create checkboxes in a grid layout
        img_grid = QGridLayout()
        self.image_column_checks = {}
        
        for i, col in enumerate(self.available_columns):
            row = i // 3
            column = i % 3
            
            checkbox = QCheckBox(col)
            if col in self.config["image_columns"]:
                checkbox.setChecked(True)
            
            # Connect checkbox
            checkbox.toggled.connect(lambda checked, c=col: self.on_image_column_toggled(c, checked))
            self.image_column_checks[col] = checkbox
            
            img_grid.addWidget(checkbox, row, column)
        
        img_layout.addLayout(img_grid)
        self.column_layout.addWidget(img_group)
        
        # PDF URL Section
        pdf_group = QGroupBox("PDF URL Column (optional)")
        pdf_group.setStyleSheet("QGroupBox { font-weight: bold; }")
        pdf_layout = QVBoxLayout()
        pdf_group.setLayout(pdf_layout)
        
        pdf_description = QLabel("Select the column containing PDF URLs to download:")
        pdf_layout.addWidget(pdf_description)
        
        # Create "None" option for PDF
        none_radio = QRadioButton("(None)")
        if not self.config["pdf_column"]:
            none_radio.setChecked(True)
        none_radio.toggled.connect(lambda checked: self.on_pdf_column_selected("") if checked else None)
        pdf_layout.addWidget(none_radio)
        
        # Create radio buttons in a grid layout
        pdf_grid = QGridLayout()
        self.pdf_column_radios = {"": none_radio}
        
        for i, col in enumerate(self.available_columns):
            row = i // 3
            column = i % 3
            
            radio = QRadioButton(col)
            if col == self.config["pdf_column"]:
                radio.setChecked(True)
            
            # Connect radio button
            radio.toggled.connect(lambda checked, c=col: self.on_pdf_column_selected(c) if checked else None)
            self.pdf_column_radios[col] = radio
            
            pdf_grid.addWidget(radio, row, column)
        
        pdf_layout.addLayout(pdf_grid)
        self.column_layout.addWidget(pdf_group)
        
        # Image Filename Column Section
        filename_group = QGroupBox("Image Filename Column (optional)")
        filename_group.setStyleSheet("QGroupBox { font-weight: bold; }")
        filename_layout = QVBoxLayout()
        filename_group.setLayout(filename_layout)

        filename_description = QLabel("Select a column containing actual filenames to search for in the source folder:")
        filename_layout.addWidget(filename_description)

        # Create "None" option for filename
        none_radio = QRadioButton("(None - Use Part Number)")
        if not self.config.get("filename_column", ""):
            none_radio.setChecked(True)
        none_radio.toggled.connect(lambda checked: self.on_filename_column_selected("") if checked else None)
        filename_layout.addWidget(none_radio)

        # Create radio buttons in a grid layout
        filename_grid = QGridLayout()
        self.filename_column_radios = {"": none_radio}

        for i, col in enumerate(self.available_columns):
            row = i // 3
            column = i % 3

            radio = QRadioButton(col)
            if col == self.config.get("filename_column", ""):
                radio.setChecked(True)

            # Connect radio button
            radio.toggled.connect(lambda checked, c=col: self.on_filename_column_selected(c) if checked else None)
            self.filename_column_radios[col] = radio

            filename_grid.addWidget(radio, row, column)

        filename_layout.addLayout(filename_grid)
        self.column_layout.addWidget(filename_group)
        
        # Add a spacer to push everything to the top
        self.column_layout.addStretch()
    
    def on_part_column_selected(self, column):
        """Handle part number column selection"""
        self.config["part_no_column"] = column
        self.update_summary()
    
    def on_image_column_toggled(self, column, checked):
        """Handle image column checkbox toggled"""
        if checked and column not in self.config["image_columns"]:
            self.config["image_columns"].append(column)
        elif not checked and column in self.config["image_columns"]:
            self.config["image_columns"].remove(column)
        
        self.update_summary()
    
    def on_pdf_column_selected(self, column):
        """Handle PDF column selection"""
        self.config["pdf_column"] = column
        self.update_summary()
    
    def on_filename_column_selected(self, column):
        """Handle filename column selection"""
        self.config["filename_column"] = column
        self.update_summary()
    
    def refresh_columns(self):
        """Refresh the column selections by reloading sheet data"""
        if self.load_sheet():
            self.update_status("Columns refreshed", "success")
    
    def browse_image_folder(self):
        """Browse for and select image download folder"""
        folder_path = QFileDialog.getExistingDirectory(
            self,
            "Select Image Download Folder"
        )
        
        if folder_path:
            self.img_folder_edit.setText(folder_path)
            self.config["image_folder"] = folder_path
            self.update_summary()
    
    def browse_source_image_folder(self):
        """Browse for and select source image folder"""
        folder_path = QFileDialog.getExistingDirectory(
            self,
            "Select Source Image Folder"
        )
        
        if folder_path:
            self.source_img_folder_edit.setText(folder_path)
            self.config["source_image_folder"] = folder_path
    
    def browse_pdf_folder(self):
        """Browse for and select PDF download folder"""
        folder_path = QFileDialog.getExistingDirectory(
            self,
            "Select PDF Download Folder"
        )
        
        if folder_path:
            self.pdf_folder_edit.setText(folder_path)
            self.config["pdf_folder"] = folder_path
            self.update_summary()
    
    def update_thread_value(self, value):
        """Update thread count label when slider changes"""
        self.thread_value_label.setText(str(value))
        self.config["max_workers"] = value
        self.update_summary()
    
    def update_summary(self):
        """Update summary text based on current selections"""
        if not hasattr(self, 'df') or self.df is None:
            return
            
        potential_images = 0
        if hasattr(self, 'config') and self.config["image_columns"]:
            for col in self.config["image_columns"]:
                if col in self.df.columns:
                    potential_images += self.df[col].notna().sum()
        
        potential_pdfs = 0
        if self.config["pdf_column"] and self.config["pdf_column"] in self.df.columns:
            potential_pdfs = self.df[self.config["pdf_column"]].notna().sum()
        
        potential_parts = 0
        if self.config["part_no_column"] and self.config["part_no_column"] in self.df.columns:
            potential_parts = self.df[self.config["part_no_column"]].notna().sum()
        
        if hasattr(self, 'summary_label') and self.summary_label:
            summary_text = f"Selected configuration will attempt to download:\n"
            if potential_images > 0:
                summary_text += f"- {potential_images} images"
                if self.config["background_processing"]["enabled"]:
                    summary_text += " (with background processing)"
                summary_text += "\n"
            if potential_pdfs > 0:
                summary_text += f"- {potential_pdfs} PDFs\n"
            if potential_parts > 0:
                summary_text += f"- Data for {potential_parts} parts"
            
            self.summary_label.setText(summary_text)
    
    def update_elapsed_time(self):
        """Update elapsed time display during downloads"""
        if self.start_time:
            elapsed = time.time() - self.start_time
            mins = int(elapsed // 60)
            secs = int(elapsed % 60)
            self.elapsed_time_label.setText(f"Elapsed: {mins}:{secs:02d}")
    
    def start_downloads(self):
        """Start the download process based on current configuration"""
        # Validate configuration
        if not self.validate_download_config():
            return
        
        # Update config with current file paths
        self.config["image_file_path"] = self.img_filename_pattern.text()
        self.config["pdf_file_path"] = self.pdf_filename_pattern.text()
        
        # Change UI state
        self.toggle_ui_for_download(True)
        
        # Reset counters
        self.progress_bar.setValue(0)
        self.success_counter.setText("Successful: 0")
        self.fail_counter.setText("Failed: 0")
        self.current_file_label.setText("Current: None")
        
        # Start timer for elapsed time
        self.start_time = time.time()
        self.elapsed_timer.start(1000)  # Update every second
        
        # Clear summary and prepare for logs
        self.summary_text.clear()
        if self.config["background_processing"]["enabled"]:
            method_names = {
                "smart_detect": "Smart Detection",
                "ai_removal": "AI Background Removal",
                "color_replace": "Color Range Replacement", 
                "edge_detection": "Edge Detection"
            }
            method = method_names.get(self.config["background_processing"]["method"], "Smart Detection")
            self.summary_text.append(f"Starting download process with {method} background processing...")
        else:
            self.summary_text.append("Starting download process...")
        
        # Save configuration
        self.save_config()
        
        # Prepare download items
        download_items = self.prepare_download_items()
        
        if not download_items:
            self.update_status("No valid download items found", "warning")
            QMessageBox.warning(
                self,
                "Warning",
                "No valid download items found in the selected columns."
            )
            self.toggle_ui_for_download(False)
            self.elapsed_timer.stop()
            return
        
        # Set up log file
        log_folder = self.config["image_folder"] or self.config["pdf_folder"]
        self.log_file = os.path.join(log_folder, f'DownloadLog_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv')
        
        # Initialize CSV log file
        with open(self.log_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow([
                'Row', 'Product Code', 'URL', 'Status', 'HTTP Status',
                'Content-Type', 'File Size (Bytes)', 'Message',
                'Local File Path', 'Photo File Path', 'Background Processed'
            ])
        
        # Set up download in worker thread
        self.download_thread = QThread()
        bg_processor = self.bg_processor if self.config["background_processing"]["enabled"] else None
        self.download_worker = DownloadWorker(download_items, self.config["max_workers"], bg_processor)
        self.download_worker.moveToThread(self.download_thread)
        
        # Connect signals
        self.download_thread.started.connect(self.download_worker.process_downloads)
        self.download_worker.progress.connect(self.update_download_progress)
        self.download_worker.finished.connect(self.on_downloads_finished)
        self.download_worker.finished.connect(self.download_thread.quit)
        
        # Start the thread
        self.download_thread.start()
    
    def validate_download_config(self):
        """Validate the download configuration before starting"""
        if self.df is None:
            QMessageBox.critical(
                self,
                "Error",
                "Please load data first"
            )
            return False
            
        if not self.config["part_no_column"]:
            QMessageBox.critical(
                self,
                "Error",
                "Please select a Part Number column"
            )
            return False
            
        if not self.config["image_columns"] and not self.config["pdf_column"]:
            QMessageBox.critical(
                self,
                "Error",
                "Please select at least one image or PDF column"
            )
            return False
        
        # Check for image folder if image columns selected
        if self.config["image_columns"] and not self.config["image_folder"]:
            folder_path = QFileDialog.getExistingDirectory(
                self,
                "Select Image Download Folder"
            )
            
            if not folder_path:
                return False
                
            self.img_folder_edit.setText(folder_path)
            self.config["image_folder"] = folder_path
        
        # Check for PDF folder if PDF column selected
        if self.config["pdf_column"] and not self.config["pdf_folder"]:
            folder_path = QFileDialog.getExistingDirectory(
                self,
                "Select PDF Download Folder"
            )
            
            if not folder_path:
                return False
                
            self.pdf_folder_edit.setText(folder_path)
            self.config["pdf_folder"] = folder_path
        
        return True
    
    def prepare_download_items(self):
        """Prepare list of items to download based on configuration"""
        sanitize_filename = lambda name: re.sub(r'[^a-zA-Z0-9_]', '', re.sub(r'\s+', '_', str(name)))
        download_items = []
        processed_files = set()
        
        part_no_column = self.config["part_no_column"]
        image_columns = self.config["image_columns"]
        image_folder = self.config["image_folder"]
        pdf_column = self.config["pdf_column"]
        pdf_folder = self.config["pdf_folder"]
        image_file_path = self.img_filename_pattern.text().strip()
        pdf_file_path = self.pdf_filename_pattern.text().strip()
        source_image_folder = self.config.get("source_image_folder", "")
        filename_column = self.config.get("filename_column", "")
        
        # Process each row in the dataframe
        for index, row in self.df.iterrows():
            original_part_no = str(row[part_no_column])
            safe_part_no = sanitize_filename(original_part_no)
            
            # For searching in source folder - can be filename or part number
            search_term = ""
            if filename_column and pd.notna(row.get(filename_column)):
                search_term = str(row[filename_column]).strip()
            
            # Process image URLs
            if image_columns and image_folder:
                for img_col in image_columns:
                    if pd.notna(row[img_col]):
                        image_url = str(row[img_col]).strip()
                        if image_url:
                            # ALWAYS use the part number for the destination filename
                            filepath = os.path.join(image_folder, f"{safe_part_no}.jpg")
                            
                            # Store network path for logging purposes only
                            network_filepath = ""
                            if image_file_path:
                                network_filepath = os.path.join(image_file_path, f"{safe_part_no}.jpg")
                            
                            # Ensure directory exists
                            os.makedirs(os.path.dirname(filepath), exist_ok=True)
                            
                            if filepath not in processed_files:
                                processed_files.add(filepath)
                                download_items.append({
                                    'url': image_url,
                                    'filepath': filepath,  # Destination path with part number as filename
                                    'network_filepath': network_filepath,
                                    'row_index': index + 2,
                                    'part_no': original_part_no,
                                    'type': 'image',
                                    'column': img_col,
                                    'source_folder': source_image_folder,
                                    'specific_filename': search_term  # For searching in source folder
                                })
            
            # Process PDF URLs
            if pdf_column and pdf_folder and pd.notna(row[pdf_column]):
                pdf_url = str(row[pdf_column]).strip()
                if pdf_url:
                    # Always use the pdf_folder for actual downloads, not the file path
                    filepath = os.path.join(pdf_folder, f"{safe_part_no}.pdf")
                    
                    # Store network path for logging purposes only
                    network_filepath = ""
                    if pdf_file_path:
                        network_filepath = os.path.join(pdf_file_path, f"{safe_part_no}.pdf")
                    
                    # Ensure directory exists
                    os.makedirs(os.path.dirname(filepath), exist_ok=True)
                    
                    if filepath not in processed_files:
                        processed_files.add(filepath)
                        download_items.append({
                            'url': pdf_url,
                            'filepath': filepath,
                            'network_filepath': network_filepath,  # Add network filepath for logging
                            'row_index': index + 2,  # +2 for Excel row indexing
                            'part_no': original_part_no,
                            'type': 'pdf'
                        })
        
        return download_items
    
    def toggle_ui_for_download(self, downloading=False):
        """Update UI elements for download state"""
        if downloading:
            self.start_btn.setText("Downloading...")
            self.start_btn.setEnabled(False)
            self.start_btn.setStyleSheet(
                "background-color: #ffc107; color: black; padding: 10px; font-weight: bold; border-radius: 4px;"
            )
            self.cancel_btn.setEnabled(True)
            
            # Disable navigation to other tabs
            self.tab_widget.setTabEnabled(0, False)
            self.tab_widget.setTabEnabled(1, False)
        else:
            self.start_btn.setText("Start Downloads")
            self.start_btn.setEnabled(True)
            self.start_btn.setStyleSheet(
                "background-color: #28a745; color: white; padding: 10px; font-weight: bold; border-radius: 4px;"
            )
            self.cancel_btn.setEnabled(False)
            
            # Re-enable navigation to other tabs
            self.tab_widget.setTabEnabled(0, True)
            self.tab_widget.setTabEnabled(1, True)
    
    def update_download_progress(self, progress_info):
        """Update the UI with download progress information"""
        current = progress_info['current']
        total = progress_info['total']
        successful = progress_info['successful']
        failed = progress_info['failed']
        item = progress_info['item']
        result = progress_info['result']
        
        # Update progress bar
        percent = int((current / total) * 100)
        self.progress_bar.setValue(percent)
        self.progress_label.setText(f"Processing {current}/{total} ({percent}%)")
        
        # Update status counters
        self.success_counter.setText(f"Successful: {successful}")
        self.fail_counter.setText(f"Failed: {failed}")
        self.current_file_label.setText(f"Current: {item['part_no']}")
        
        # Color progress bar based on success rate
        if current > 0:
            success_ratio = successful / current
            if success_ratio > 0.9:
                self.progress_bar.setStyleSheet(
                    """
                    QProgressBar { border: 1px solid #bdbdbd; border-radius: 5px; }
                    QProgressBar::chunk { background-color: #28a745; border-radius: 5px; }
                    """
                )  # Green
            elif success_ratio > 0.7:
                self.progress_bar.setStyleSheet(
                    """
                    QProgressBar { border: 1px solid #bdbdbd; border-radius: 5px; }
                    QProgressBar::chunk { background-color: #ffc107; border-radius: 5px; }
                    """
                )  # Yellow
            else:
                self.progress_bar.setStyleSheet(
                    """
                    QProgressBar { border: 1px solid #bdbdbd; border-radius: 5px; }
                    QProgressBar::chunk { background-color: #dc3545; border-radius: 5px; }
                    """
                )  # Red
        
        # Add to summary text with background processing indicator
        status_icon = "✓" if result['success'] else "✗"
        bg_indicator = ""
        if (item['type'] == 'image' and 
            result.get('content_type', '').endswith('_processed') and 
            self.config["background_processing"]["enabled"]):
            bg_indicator = " 🎨"
        
        self.summary_text.append(f"• {item['part_no']} ({item['type']}): {status_icon}{bg_indicator}")
        
        # Scroll to the bottom of the summary text
        self.summary_text.verticalScrollBar().setValue(
            self.summary_text.verticalScrollBar().maximum()
        )
        
        # Update log file
        self.write_to_log(item, result)
    
    def write_to_log(self, item, result):
        """Write download result to CSV log file"""
        try:
            with open(self.log_file, 'a', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                
                # Get image paths for successful image downloads
                local_path = ''
                abm_path = ''
                bg_processed = 'No'
                
                if result['success'] and item['type'] == 'image':
                    local_path = item['filepath']
                    filename = os.path.basename(item['filepath'])
                    # Use the user's file path if provided, otherwise use default
                    image_file_path = self.img_filename_pattern.text().strip()
                    if image_file_path:
                        abm_path = os.path.join(image_file_path, f"{filename}")
                    else:
                        abm_path = f"Path\\To\\Network\\Images\\{filename}"
                    
                    # Check if background processing was applied
                    if (result.get('content_type', '').endswith('_processed') and 
                        self.config["background_processing"]["enabled"]):
                        bg_processed = 'Yes'
                
                writer.writerow([
                    item['row_index'],
                    item['part_no'],
                    item['url'],
                    'Success' if result['success'] else 'Failure',
                    result['status_code'],
                    result['content_type'],
                    result['size'],
                    result['message'],
                    local_path,
                    abm_path,
                    bg_processed
                ])
        except Exception as e:
            logger.error(f"Error writing to log file: {str(e)}")
    
    def cancel_downloads(self):
        """Cancel the download process"""
        if self.download_worker:
            self.download_worker.cancel()
            self.cancel_btn.setEnabled(False)
            self.update_status("Cancelling downloads...", "warning")
            self.summary_text.append("Download process cancelled by user.")
    
    def on_downloads_finished(self):
        """Handle completion of download process"""
        # Stop the elapsed timer
        self.elapsed_timer.stop()
        
        # Reset the UI
        self.toggle_ui_for_download(False)
        
        # Get final counts
        successful = int(self.success_counter.text().split(": ")[1])
        failed = int(self.fail_counter.text().split(": ")[1])
        
        # Update status
        self.update_status("Download process complete", "success")
        
        # Show completion dialog
        dialog = CompletionDialog(successful, failed, self.log_file, self)
        dialog.exec()
    
    def save_config(self):
        """Save current configuration to a JSON file"""
        config_to_save = self.config.copy()
        
        # Update config with current values from UI
        if hasattr(self, 'img_filename_pattern'):
            config_to_save["image_file_path"] = self.img_filename_pattern.text()
        if hasattr(self, 'pdf_filename_pattern'):
            config_to_save["pdf_file_path"] = self.pdf_filename_pattern.text()
        
        # Get save location
        config_dir = os.path.join(os.path.expanduser("~"), ".digital_asset_downloader")
        os.makedirs(config_dir, exist_ok=True)
        config_file = os.path.join(config_dir, "last_config.json")
        
        try:
            with open(config_file, 'w') as f:
                json.dump(config_to_save, f, indent=2)
            
            logger.info(f"Configuration saved to {config_file}")
            return True
        except Exception as e:
            logger.error(f"Failed to save configuration: {str(e)}")
            return False
    
    def load_config(self):
        """Load configuration from a JSON file"""
        config_dir = os.path.join(os.path.expanduser("~"), ".digital_asset_downloader")
        config_file = os.path.join(config_dir, "last_config.json")
        
        if not os.path.exists(config_file):
            return False
            
        try:
            with open(config_file, 'r') as f:
                loaded_config = json.load(f)
                
            # Update the config
            self.config.update(loaded_config)
            
            # Update UI elements
            self.excel_path_edit.setText(self.config["excel_file"])
            self.img_folder_edit.setText(self.config["image_folder"])
            self.pdf_folder_edit.setText(self.config["pdf_folder"])
            self.thread_slider.setValue(self.config["max_workers"])
            
            # Update filename pattern fields if they exist
            if hasattr(self, 'img_filename_pattern') and "image_file_path" in self.config:
                self.img_filename_pattern.setText(self.config["image_file_path"])
            if hasattr(self, 'pdf_filename_pattern') and "pdf_file_path" in self.config:
                self.pdf_filename_pattern.setText(self.config["pdf_file_path"])
            
            # Update background processing settings
            if hasattr(self, 'auto_process_bg'):
                bg_config = self.config.get("background_processing", {})
                self.auto_process_bg.setChecked(bg_config.get("enabled", False))
                if bg_config.get("enabled", False):
                    self.bg_processor = BackgroundProcessor(
                        method=bg_config.get("method", "smart_detect"),
                        quality=bg_config.get("quality", 95),
                        edge_threshold=bg_config.get("edge_threshold", 30)
                    )
                    self.on_background_processing_toggled(True)
            
            # Load the Excel file if it exists
            if self.config["excel_file"] and os.path.exists(self.config["excel_file"]):
                if self.load_excel_file(self.config["excel_file"]):
                    # Set the sheet combo box
                    sheet_index = self.sheet_combo.findText(self.config["sheet_name"])
                    if (sheet_index >= 0):
                        self.sheet_combo.setCurrentIndex(sheet_index)
                        
                        # Load the sheet
                        self.load_sheet()
            
            # Update the summary
            self.update_summary()
            
            logger.info(f"Configuration loaded from {config_file}")
            return True
        except Exception as e:
            logger.error(f"Failed to load configuration: {str(e)}")
            return False
    
    def check_previous_config(self):
        """Check for previous configuration and ask user if they want to load it"""
        config_dir = os.path.join(os.path.expanduser("~"), ".digital_asset_downloader")
        config_file = os.path.join(config_dir, "last_config.json")
        
        if os.path.exists(config_file):
            response = QMessageBox.question(
                self,
                "Previous Configuration",
                "Previous configuration found. Would you like to load it?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.Yes
            )
            
            if response == QMessageBox.StandardButton.Yes:
                self.load_config()
    
    def on_tab_changed(self, index):
        """Handle tab change events"""
        if index == 1:  # Column Selection tab
            self.update_column_selection_ui()
    
    def on_next_clicked(self):
        """Handle next button click in file selection tab"""
        if self.excel_path_edit.text():
            # If Excel file is selected but sheet is not loaded yet, try loading it
            if not isinstance(self.df, pd.DataFrame):
                sheet_name = self.sheet_combo.currentText()
                if sheet_name:
                    success = self.load_sheet()
                    if success:
                        # Sheet loaded successfully, will automatically navigate to column selection
                        return
                    else:
                        # Failed to load sheet
                        QMessageBox.warning(
                            self,
                            "Warning",
                            "Failed to load the selected sheet. Please check the file and try again."
                        )
                        return
            else:
                # DataFrame already exists, just navigate
                self.update_column_selection_ui()
                self.tab_widget.setCurrentIndex(1)
        else:
            QMessageBox.warning(
                self,
                "Warning",
                "Please select an Excel file first."
            )


if __name__ == "__main__":
    # Suppress Qt font warnings
    import os
    os.environ["QT_LOGGING_RULES"] = "qt.qpa.fonts=false"
    
    app = QApplication(sys.argv)
    app.setStyle("Fusion")
    
    # Set a font that's more likely to be available on all systems
    default_font = app.font()
    default_font.setFamily("Arial")  # Widely available on Windows
    app.setFont(default_font)
    
    window = DigitalAssetDownloader()
    window.show()
    
    # Check for previous configuration after window is shown
    window.check_previous_config()
    
    # Add progress bar and label to status bar
    window.progress_bar = QProgressBar()
    window.progress_bar.setRange(0, 100)
    window.progress_bar.setValue(0)
    window.progress_bar.setTextVisible(True)
    window.progress_bar.setFixedWidth(200)
    window.progress_bar.setStyleSheet(
        """
        QProgressBar {
            border: 1px solid #bdbdbd;
            border-radius: 5px;
            text-align: center;
        }
        QProgressBar::chunk {
            background-color: #007bff;
            border-radius: 5px;
        }
        """
    )
    
    window.progress_label = QLabel("Ready")
    window.statusBar().addPermanentWidget(window.progress_label)
    window.statusBar().addPermanentWidget(window.progress_bar)
    
    sys.exit(app.exec())
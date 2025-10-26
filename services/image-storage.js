const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ImageStorage {
  constructor() {
    this.tempDir = path.join(__dirname, '..', 'temp-images');
    this.ensureTempDirExists();
  }

  /**
   * Ensure temp-images directory exists
   */
  ensureTempDirExists() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      console.log(`✅ Created temp-images directory: ${this.tempDir}`);
    }
  }

  /**
   * Generate unique filename for image
   * @param {string} prefix - Prefix for filename (e.g., 'makeup', 'edited')
   * @param {string} extension - File extension (e.g., 'png', 'jpg')
   * @returns {string} Unique filename
   */
  generateFilename(prefix = 'image', extension = 'png') {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    return `${prefix}_${timestamp}_${randomString}.${extension}`;
  }

  /**
   * Save base64 image to disk
   * @param {string} base64Data - Base64 encoded image data
   * @param {string} mimeType - MIME type of the image (e.g., 'image/png')
   * @param {string} prefix - Prefix for filename
   * @returns {Promise<string>} Path to saved file (relative to temp-images directory)
   */
  async saveBase64Image(base64Data, mimeType = 'image/png', prefix = 'makeup') {
    try {
      // Extract extension from MIME type
      const extension = mimeType.split('/')[1] || 'png';
      
      // Generate unique filename
      const filename = this.generateFilename(prefix, extension);
      const filepath = path.join(this.tempDir, filename);

      // Convert base64 to buffer and save
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filepath, buffer);

      console.log(`✅ Saved image: ${filename} (${buffer.length} bytes)`);
      
      // Return filename (not full path) for URL generation
      return filename;
    } catch (error) {
      console.error('❌ Error saving image:', error);
      throw error;
    }
  }

  /**
   * Generate public URL for saved image
   * @param {string} filename - Filename of the saved image
   * @param {string} baseUrl - Base URL of the server (from config or request)
   * @returns {string} Public URL to access the image
   */
  generatePublicUrl(filename, baseUrl) {
    // Remove trailing slash from baseUrl if present
    const cleanBaseUrl = baseUrl.replace(/\/$/, '');
    return `${cleanBaseUrl}/temp-images/${filename}`;
  }

  /**
   * Delete old images (cleanup utility)
   * @param {number} maxAgeHours - Maximum age in hours (default: 24)
   */
  cleanupOldImages(maxAgeHours = 24) {
    try {
      const now = Date.now();
      const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
      
      const files = fs.readdirSync(this.tempDir);
      let deletedCount = 0;

      for (const file of files) {
        const filepath = path.join(this.tempDir, file);
        const stats = fs.statSync(filepath);
        const age = now - stats.mtimeMs;

        if (age > maxAgeMs) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old image(s)`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up old images:', error);
    }
  }

  /**
   * Get full path to temp directory
   * @returns {string} Absolute path to temp-images directory
   */
  getTempDirPath() {
    return this.tempDir;
  }

  /**
   * Get image dimensions from file
   * @param {string} filename - Filename in temp-images directory
   * @returns {Object|null} { width, height } or null if unable to read
   */
  getImageDimensions(filename) {
    try {
      const filepath = path.join(this.tempDir, filename);
      const buffer = fs.readFileSync(filepath);

      // Read PNG dimensions
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        // PNG format: width and height are at bytes 16-23
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height };
      }

      // Read JPEG dimensions
      if (buffer[0] === 0xFF && buffer[1] === 0xD8) {
        let offset = 2;
        while (offset < buffer.length) {
          // Read marker
          if (buffer[offset] !== 0xFF) break;
          const marker = buffer[offset + 1];
          offset += 2;

          // SOF0, SOF1, SOF2 markers contain image dimensions
          if ((marker >= 0xC0 && marker <= 0xC3) || marker === 0xC9) {
            const height = buffer.readUInt16BE(offset + 3);
            const width = buffer.readUInt16BE(offset + 5);
            return { width, height };
          }

          // Skip to next marker
          const length = buffer.readUInt16BE(offset);
          offset += length;
        }
      }

      console.warn(`⚠️  Unable to read dimensions for ${filename} (unknown format)`);
      return null;
    } catch (error) {
      console.error(`❌ Error reading image dimensions for ${filename}:`, error.message);
      return null;
    }
  }
}

module.exports = new ImageStorage();


import { google } from 'googleapis';
import { Readable } from 'stream';

class GoogleDriveService {
  constructor() {
    this.drive = null;
    this.initialized = false;
  }

  /**
   * Initialize Google Drive client using service account
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Google Drive client...');

      // Create auth client using service account
      const auth = new google.auth.GoogleAuth({
        credentials: {
          type: 'service_account',
          project_id: process.env.GOOGLE_PROJECT_ID,
          private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          client_id: process.env.GOOGLE_CLIENT_ID,
        },
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });

      this.drive = google.drive({ version: 'v3', auth });
      this.initialized = true;

      console.log('✅ Google Drive client initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Google Drive:', error);
      throw error;
    }
  }

  /**
   * List all files in a specific Google Drive folder
   */
  async listFilesInFolder(folderId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`📂 Listing files in folder: ${folderId}`);

      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType, size, modifiedTime)',
        pageSize: 100,
      });

      const files = response.data.files || [];
      console.log(`✅ Found ${files.length} files in folder`);

      return files;
    } catch (error) {
      console.error('❌ Error listing files:', error);
      throw error;
    }
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(fileId, fileName) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      console.log(`⬇️ Downloading file: ${fileName}`);

      const response = await this.drive.files.get(
        { fileId: fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      const buffer = Buffer.from(response.data);
      console.log(`✅ Downloaded ${fileName} (${buffer.length} bytes)`);

      return buffer;
    } catch (error) {
      console.error(`❌ Error downloading file ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const response = await this.drive.files.get({
        fileId: fileId,
        fields: 'id, name, mimeType, size, modifiedTime, createdTime',
      });

      return response.data;
    } catch (error) {
      console.error('❌ Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Check if file type is supported
   */
  isSupportedFileType(mimeType) {
    const supportedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
      'image/png',
      'image/jpeg',
      'video/mp4',
      'video/quicktime', // MOV
      'video/x-msvideo', // AVI
    ];

    return supportedTypes.includes(mimeType);
  }

  /**
   * Get file extension from MIME type
   */
  getFileExtension(mimeType) {
    const mimeToExt = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
      'video/x-msvideo': 'avi',
    };

    return mimeToExt[mimeType] || 'bin';
  }

  /**
   * Sync all files from Google Drive folder
   * Returns list of files that need processing
   */
  async syncFolder(folderId) {
    try {
      console.log('🔄 Starting Google Drive folder sync...');

      const files = await this.listFilesInFolder(folderId);

      // Filter supported file types
      const supportedFiles = files.filter(file => 
        this.isSupportedFileType(file.mimeType)
      );

      console.log(`✅ Found ${supportedFiles.length} supported files out of ${files.length} total`);

      // Log unsupported files
      const unsupportedFiles = files.filter(file => 
        !this.isSupportedFileType(file.mimeType)
      );
      if (unsupportedFiles.length > 0) {
        console.log(`⚠️ Skipping ${unsupportedFiles.length} unsupported files:`);
        unsupportedFiles.forEach(file => {
          console.log(`   - ${file.name} (${file.mimeType})`);
        });
      }

      return supportedFiles;
    } catch (error) {
      console.error('❌ Error syncing folder:', error);
      throw error;
    }
  }
}

export const googleDriveService = new GoogleDriveService();
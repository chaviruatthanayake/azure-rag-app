import { googleDriveService } from './googleDriveService.js';
import { documentProcessor } from './documentProcessor.js';
import { embeddingService } from './embeddingService.js';
import { searchService } from './searchService.js';
import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.join(process.cwd(), '.sync-cache.json');

class DriveSyncService {
  constructor() {
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.syncedFiles = new Map(); // fileId -> {name, modifiedTime, indexed}
    
    // Load cache from file on initialization
    this.loadCache();
  }

  /**
   * Load cache from file
   */
  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const data = fs.readFileSync(CACHE_FILE, 'utf8');
        const cache = JSON.parse(data);
        
        // Restore Map from JSON
        if (cache.syncedFiles) {
          this.syncedFiles = new Map(Object.entries(cache.syncedFiles));
        }
        if (cache.lastSyncTime) {
          this.lastSyncTime = new Date(cache.lastSyncTime);
        }
        
        console.log(`📋 Loaded sync cache: ${this.syncedFiles.size} files tracked`);
      }
    } catch (error) {
      console.log('⚠️ Could not load sync cache, starting fresh');
    }
  }

  /**
   * Save cache to file
   */
  saveCache() {
    try {
      const cache = {
        syncedFiles: Object.fromEntries(this.syncedFiles),
        lastSyncTime: this.lastSyncTime
      };
      
      fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
      console.log(`💾 Sync cache saved: ${this.syncedFiles.size} files tracked`);
    } catch (error) {
      console.log('⚠️ Could not save sync cache:', error.message);
    }
  }

  /**
   * Sync all files from Google Drive folder
   * Processes new or modified files
   */
  async syncFromDrive(folderId) {
    if (this.syncInProgress) {
      console.log('⚠️ Sync already in progress, skipping...');
      return {
        success: false,
        message: 'Sync already in progress'
      };
    }

    try {
      this.syncInProgress = true;
      console.log('🔄 Starting Google Drive sync...');
      console.log(`📂 Folder ID: ${folderId}`);

      const startTime = Date.now();
      const results = {
        total: 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        files: []
      };

      // 1. Get already indexed documents from Azure Search
      console.log('📊 Checking already indexed documents in Azure Search...');
      const indexedDocs = await searchService.getAllDocuments();
      const indexedFileNames = new Set(indexedDocs.map(doc => doc.fileName));
      console.log(`✅ Found ${indexedFileNames.size} documents already in Azure Search`);
      
      // Build a map of fileName -> uploadDate for Azure documents
      const azureFileMap = new Map();
      indexedDocs.forEach(doc => {
        if (!azureFileMap.has(doc.fileName)) {
          azureFileMap.set(doc.fileName, {
            uploadDate: doc.uploadDate,
            indexed: true
          });
        }
      });

      // 2. Get list of files from Google Drive
      const driveFiles = await googleDriveService.syncFolder(folderId);
      results.total = driveFiles.length;

      console.log(`📊 Processing ${driveFiles.length} files...`);

      // 3. Process each file
      for (const driveFile of driveFiles) {
        try {
          const cachedFile = this.syncedFiles.get(driveFile.id);
          const alreadyIndexed = indexedFileNames.has(driveFile.name);
          
          // SMART SKIP LOGIC:
          // Skip if file is in Azure AND (in cache with same modified time OR cache is empty but file is in Azure)
          if (alreadyIndexed) {
            // If in cache with same modified time -> definitely skip
            if (cachedFile && cachedFile.modifiedTime === driveFile.modifiedTime) {
              console.log(`⏭️ Skipping ${driveFile.name} (already in Azure, not modified)`);
              results.skipped++;
              results.files.push({
                fileName: driveFile.name,
                success: true,
                skipped: true,
                message: 'Already indexed'
              });
              continue;
            }
            
            // If NOT in cache but IS in Azure -> add to cache and skip (first run after restart)
            if (!cachedFile) {
              console.log(`⏭️ Skipping ${driveFile.name} (found in Azure, adding to cache)`);
              this.syncedFiles.set(driveFile.id, {
                name: driveFile.name,
                modifiedTime: driveFile.modifiedTime,
                indexed: azureFileMap.get(driveFile.name).uploadDate
              });
              results.skipped++;
              results.files.push({
                fileName: driveFile.name,
                success: true,
                skipped: true,
                message: 'Already indexed (cache rebuilt)'
              });
              continue;
            }
            
            // If in cache but modified time different -> re-process
            console.log(`🔄 Re-processing ${driveFile.name} (file was modified)`);
          }
          
          const fileResult = await this.processFile(driveFile, folderId);
          
          if (fileResult.skipped) {
            results.skipped++;
          } else {
            results.processed++;
          }

          results.files.push(fileResult);

        } catch (error) {
          console.error(`❌ Error processing ${driveFile.name}:`, error);
          results.errors++;
          results.files.push({
            fileName: driveFile.name,
            success: false,
            error: error.message,
            skipped: false
          });
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      this.lastSyncTime = new Date();

      // Save cache to file for persistence across restarts
      this.saveCache();

      console.log('\n📊 Sync Summary:');
      console.log(`   Total files: ${results.total}`);
      console.log(`   Processed: ${results.processed}`);
      console.log(`   Skipped: ${results.skipped}`);
      console.log(`   Errors: ${results.errors}`);
      console.log(`   Duration: ${duration}s`);
      console.log(`✅ Sync completed successfully`);

      return {
        success: true,
        ...results,
        duration: `${duration}s`,
        syncTime: this.lastSyncTime.toISOString()
      };

    } catch (error) {
      console.error('❌ Sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Process a single file from Google Drive
   */
  async processFile(driveFile, folderId) {
    const { id: fileId, name: fileName, mimeType, modifiedTime } = driveFile;

    console.log(`\n📄 Processing: ${fileName}`);

    // Check if file was already processed and hasn't changed
    const cachedFile = this.syncedFiles.get(fileId);
    if (cachedFile && cachedFile.modifiedTime === modifiedTime) {
      console.log(`⏭️ Skipping ${fileName} (already processed, not modified)`);
      return {
        fileName,
        success: true,
        skipped: true,
        message: 'Already processed'
      };
    }

    try {
      // 1. Download file from Google Drive
      const fileBuffer = await googleDriveService.downloadFile(fileId, fileName);

      // 2. Create file object compatible with document processor
      const file = {
        buffer: fileBuffer,
        originalname: fileName,
        mimetype: mimeType,
        size: fileBuffer.length
      };

      // 3. Extract text/content
      console.log(`📝 Extracting content from ${fileName}...`);
      const extractedData = await documentProcessor.extractText(fileBuffer, mimeType);
      
      if (!extractedData.text || extractedData.text.trim().length === 0) {
        console.log(`⚠️ No content extracted from ${fileName}`);
        return {
          fileName,
          success: false,
          skipped: false,
          error: 'No content extracted'
        };
      }

      console.log(`✅ Extracted ${extractedData.text.length} characters`);

      // 4. Chunk text
      const chunks = documentProcessor.chunkText(extractedData.text);
      console.log(`✅ Created ${chunks.length} chunks`);

      // 5. Detect language
      const language = documentProcessor.detectLanguage(extractedData.text);

      // 6. Generate embeddings
      console.log(`🧠 Generating embeddings for ${chunks.length} chunks...`);
      // chunks is already an array of strings from chunkText()
      const embeddings = await embeddingService.generateEmbeddings(chunks);

      // 7. Prepare document for indexing
      const document = {
        id: fileId,
        fileName: fileName,
        fileType: mimeType,
        language: language,
        blobName: `gdrive-${fileId}`,
        pageCount: extractedData.pageCount || null,
        uploadDate: new Date().toISOString(),
        chunks: chunks.map((chunkText, index) => ({
          text: chunkText,  // chunk is a string, use it directly
          embedding: embeddings[index]
        }))
      };

      // 8. Delete old chunks if file was previously indexed (prevents duplicates)
      if (cachedFile) {
        console.log(`🗑️ Removing old chunks for ${fileName}...`);
        try {
          await searchService.deleteDocumentsByFileName(fileName);
          console.log(`✅ Old chunks removed`);
        } catch (error) {
          console.log(`⚠️ Could not delete old chunks (may not exist): ${error.message}`);
        }
      }

      // 9. Index in Azure Search
      console.log(`🔍 Indexing ${fileName} in Azure AI Search...`);
      await searchService.indexDocument(document);

      // 10. Update cache
      this.syncedFiles.set(fileId, {
        name: fileName,
        modifiedTime: modifiedTime,
        indexed: new Date().toISOString()
      });

      console.log(`✅ Successfully processed and indexed: ${fileName}`);

      return {
        fileName,
        success: true,
        skipped: false,
        chunks: chunks.length,
        language,
        fileId
      };

    } catch (error) {
      console.error(`❌ Error processing ${fileName}:`, error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    return {
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      totalFilesSynced: this.syncedFiles.size,
      syncedFiles: Array.from(this.syncedFiles.values())
    };
  }

  /**
   * Clear sync cache (force re-sync of all files)
   */
  clearCache() {
    this.syncedFiles.clear();
    this.lastSyncTime = null;
    
    // Delete cache file
    try {
      if (fs.existsSync(CACHE_FILE)) {
        fs.unlinkSync(CACHE_FILE);
      }
    } catch (error) {
      console.log('⚠️ Could not delete cache file:', error.message);
    }
    
    console.log('🗑️ Sync cache cleared');
  }
}

export const driveSyncService = new DriveSyncService();
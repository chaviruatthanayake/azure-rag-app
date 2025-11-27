import express from 'express';
import { driveSyncService } from '../services/driveSyncService.js';

const router = express.Router();

/**
 * POST /api/drive/sync
 * Trigger sync from Google Drive folder
 */
router.post('/sync', async (req, res) => {
  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
      return res.status(400).json({
        success: false,
        error: 'Google Drive folder ID not configured'
      });
    }

    console.log('📥 Received sync request');

    const result = await driveSyncService.syncFromDrive(folderId);

    res.json(result);

  } catch (error) {
    console.error('Error in sync endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync from Google Drive',
      message: error.message
    });
  }
});

/**
 * GET /api/drive/status
 * Get current sync status
 */
router.get('/status', async (req, res) => {
  try {
    const status = driveSyncService.getSyncStatus();

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      message: error.message
    });
  }
});

/**
 * POST /api/drive/clear-cache
 * Clear sync cache (forces re-sync of all files)
 */
router.post('/clear-cache', async (req, res) => {
  try {
    driveSyncService.clearCache();

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });

  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

export default router;
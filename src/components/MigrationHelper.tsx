import React, { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { toast } from 'sonner';

interface MigrationInfo {
  total: number;
  oldSystemCount: number;
  newSystemCount: number;
  needsCleanupCount: number;
  message: string;
}

export default function MigrationHelper() {
  const [migrationInfo, setMigrationInfo] = useState<MigrationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const getMigrationInfo = useMutation(api.migration.getDualTranscriptMigrationInfo);
  const cleanupOldTranscripts = useMutation(api.migration.cleanupOldDualTranscripts);

  const checkMigrationStatus = async () => {
    setIsLoading(true);
    try {
      const info = await getMigrationInfo();
      setMigrationInfo(info);
    } catch (error) {
      console.error('Failed to get migration info:', error);
      toast.error('Failed to check migration status');
    } finally {
      setIsLoading(false);
    }
  };

  const runCleanup = async () => {
    setIsLoading(true);
    try {
      const result = await cleanupOldTranscripts();
      toast.success(result.message);
      // Refresh migration info
      await checkMigrationStatus();
    } catch (error) {
      console.error('Failed to cleanup transcripts:', error);
      toast.error('Failed to cleanup old transcripts');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">🔧 Migration Helper</h2>
        <p className="text-gray-600 mb-4">
          This tool helps migrate your dual PDF transcripts from the old verification system to the new 
          course matching system that properly handles OCR errors and description enhancement.
        </p>
        
        <div className="flex gap-4">
          <button
            onClick={checkMigrationStatus}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            {isLoading ? 'Checking...' : 'Check Migration Status'}
          </button>
          
          {migrationInfo && migrationInfo.needsCleanupCount > 0 && (
            <button
              onClick={runCleanup}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              {isLoading ? 'Cleaning...' : 'Cleanup Old Transcripts'}
            </button>
          )}
        </div>
      </div>

      {migrationInfo && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">📊 Migration Status</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{migrationInfo.total}</div>
              <div className="text-sm text-blue-800">Total Transcripts</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{migrationInfo.oldSystemCount}</div>
              <div className="text-sm text-red-800">Old System</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{migrationInfo.newSystemCount}</div>
              <div className="text-sm text-green-800">New System</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-orange-600">{migrationInfo.needsCleanupCount}</div>
              <div className="text-sm text-orange-800">Need Cleanup</div>
            </div>
          </div>

          <div className={`p-4 rounded-lg ${
            migrationInfo.needsCleanupCount > 0 
              ? 'bg-orange-50 border border-orange-200' 
              : 'bg-green-50 border border-green-200'
          }`}>
            <p className={`text-sm ${
              migrationInfo.needsCleanupCount > 0 ? 'text-orange-800' : 'text-green-800'
            }`}>
              {migrationInfo.message}
            </p>
          </div>

          {migrationInfo.needsCleanupCount > 0 && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 mb-2">What happens during cleanup:</h4>
              <ul className="text-sm text-yellow-700 space-y-1 ml-4">
                <li>• Removes old verification data from your transcripts</li>
                <li>• Resets transcripts to "uploaded" status</li>
                <li>• They will be reprocessed with the new course matching system</li>
                <li>• OCR error handling and description enhancement will be applied</li>
                <li>• Your original PDF files are not affected</li>
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🔄 New System Benefits</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">OCR Error Handling</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• "Computer Sci" → "Computer Science"</li>
              <li>• "Data Structure" → "Data Structures"</li>
              <li>• "Math for Engineers" → "Mathematics for Engineers"</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-gray-800 mb-2">Description Enhancement</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Basic transcript descriptions replaced</li>
              <li>• Rich course of study descriptions used</li>
              <li>• Better Plaksha course matching</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

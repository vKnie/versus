import { saveGameHistory } from '../game-utils';
import { query } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('@/lib/db');
jest.mock('fs/promises');

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockFsMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
const mockFsWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;

describe('game-utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveGameHistory', () => {
    it('should save game history with correct data structure', async () => {
      const mockGameSessionId = 1;
      const mockRoomId = 10;
      const mockTournamentData = {
        roomName: 'Test Room',
        winners: ['Item A'],
        totalRounds: 2,
        allItems: ['Item A', 'Item B', 'Item C', 'Item D'],
        duels: [
          {
            item1: { name: 'Item A', imageUrl: '/a.jpg' },
            item2: { name: 'Item B', imageUrl: '/b.jpg' },
            round: 1
          },
          {
            item1: { name: 'Item C', imageUrl: '/c.jpg' },
            item2: { name: 'Item D', imageUrl: '/d.jpg' },
            round: 1
          }
        ],
        tieBreakers: []
      };

      // Mock database responses
      mockQuery
        .mockResolvedValueOnce([
          { id: 1, status: 'completed', created_at: '2024-01-01T00:00:00Z' }
        ])
        .mockResolvedValueOnce([
          {
            duel_index: 0,
            item_voted: 'Item A',
            voter_name: 'User1',
            profile_picture_url: '/user1.jpg',
            created_at: '2024-01-01T00:01:00Z'
          }
        ])
        .mockResolvedValueOnce([
          { name: 'User1', joined_at: '2024-01-01T00:00:00Z' }
        ])
        .mockResolvedValueOnce([]); // INSERT INTO game_results

      mockFsMkdir.mockResolvedValue(undefined);
      mockFsWriteFile.mockResolvedValue(undefined);

      await saveGameHistory(mockGameSessionId, mockTournamentData as any, mockRoomId);

      // Verify fs operations were called
      expect(mockFsMkdir).toHaveBeenCalledWith(
        expect.stringContaining('game_history'),
        { recursive: true }
      );
      expect(mockFsWriteFile).toHaveBeenCalled();

      // Verify game_results insert
      expect(mockQuery).toHaveBeenCalledWith(
        'INSERT INTO game_results (game_session_id, history_file, winner) VALUES (?, ?, ?)',
        expect.arrayContaining([mockGameSessionId, expect.any(String), 'Item A'])
      );
    });

    it('should throw error when database query fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        saveGameHistory(1, {} as any, 1)
      ).rejects.toThrow('Database error');
    });
  });
});

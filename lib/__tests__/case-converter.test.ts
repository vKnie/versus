import {
  snakeToCamel,
  camelToSnake,
  convertDbRows,
  convertDbRow,
} from '../case-converter';

describe('case-converter', () => {
  describe('snakeToCamel', () => {
    it('should convert simple snake_case keys to camelCase', () => {
      const input = {
        profile_picture_url: 'https://example.com/pic.jpg',
        created_at: '2024-01-01',
        user_id: 123,
      };

      const result = snakeToCamel(input);

      expect(result).toEqual({
        profilePictureUrl: 'https://example.com/pic.jpg',
        createdAt: '2024-01-01',
        userId: 123,
      });
    });

    it('should handle nested objects', () => {
      const input = {
        user_data: {
          first_name: 'John',
          last_name: 'Doe',
        },
        created_at: '2024-01-01',
      };

      const result = snakeToCamel(input);

      expect(result).toEqual({
        userData: {
          firstName: 'John',
          lastName: 'Doe',
        },
        createdAt: '2024-01-01',
      });
    });

    it('should handle arrays', () => {
      const input = [
        { user_id: 1, profile_picture_url: 'url1' },
        { user_id: 2, profile_picture_url: 'url2' },
      ];

      const result = snakeToCamel(input);

      expect(result).toEqual([
        { userId: 1, profilePictureUrl: 'url1' },
        { userId: 2, profilePictureUrl: 'url2' },
      ]);
    });

    it('should handle arrays within objects', () => {
      const input = {
        users_list: [
          { user_id: 1 },
          { user_id: 2 },
        ],
      };

      const result = snakeToCamel(input);

      expect(result).toEqual({
        usersList: [
          { userId: 1 },
          { userId: 2 },
        ],
      });
    });

    it('should handle null and undefined', () => {
      expect(snakeToCamel(null)).toBeNull();
      expect(snakeToCamel(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(snakeToCamel('string')).toBe('string');
      expect(snakeToCamel(123)).toBe(123);
      expect(snakeToCamel(true)).toBe(true);
    });

    it('should handle Date objects without modification', () => {
      const date = new Date('2024-01-01');
      const input = {
        created_at: date,
      };

      const result = snakeToCamel(input);

      expect(result.createdAt).toBe(date);
      expect(result.createdAt instanceof Date).toBe(true);
    });

    it('should handle complex nested structures', () => {
      const input = {
        game_session_id: 1,
        duel_data: {
          item_one: {
            proposed_by: [
              { user_id: 1, profile_picture_url: 'url' },
            ],
          },
        },
      };

      const result = snakeToCamel(input);

      expect(result).toEqual({
        gameSessionId: 1,
        duelData: {
          itemOne: {
            proposedBy: [
              { userId: 1, profilePictureUrl: 'url' },
            ],
          },
        },
      });
    });
  });

  describe('camelToSnake', () => {
    it('should convert simple camelCase keys to snake_case', () => {
      const input = {
        profilePictureUrl: 'https://example.com/pic.jpg',
        createdAt: '2024-01-01',
        userId: 123,
      };

      const result = camelToSnake(input);

      expect(result).toEqual({
        profile_picture_url: 'https://example.com/pic.jpg',
        created_at: '2024-01-01',
        user_id: 123,
      });
    });

    it('should handle nested objects', () => {
      const input = {
        userData: {
          firstName: 'John',
          lastName: 'Doe',
        },
        createdAt: '2024-01-01',
      };

      const result = camelToSnake(input);

      expect(result).toEqual({
        user_data: {
          first_name: 'John',
          last_name: 'Doe',
        },
        created_at: '2024-01-01',
      });
    });

    it('should handle arrays', () => {
      const input = [
        { userId: 1, profilePictureUrl: 'url1' },
        { userId: 2, profilePictureUrl: 'url2' },
      ];

      const result = camelToSnake(input);

      expect(result).toEqual([
        { user_id: 1, profile_picture_url: 'url1' },
        { user_id: 2, profile_picture_url: 'url2' },
      ]);
    });

    it('should handle null and undefined', () => {
      expect(camelToSnake(null)).toBeNull();
      expect(camelToSnake(undefined)).toBeUndefined();
    });

    it('should handle primitive values', () => {
      expect(camelToSnake('string')).toBe('string');
      expect(camelToSnake(123)).toBe(123);
      expect(camelToSnake(true)).toBe(true);
    });

    it('should handle Date objects without modification', () => {
      const date = new Date('2024-01-01');
      const input = {
        createdAt: date,
      };

      const result = camelToSnake(input);

      expect(result.created_at).toBe(date);
      expect(result.created_at instanceof Date).toBe(true);
    });
  });

  describe('convertDbRows', () => {
    it('should convert array of database rows', () => {
      const dbRows = [
        { user_id: 1, profile_picture_url: 'url1', created_at: '2024-01-01' },
        { user_id: 2, profile_picture_url: 'url2', created_at: '2024-01-02' },
      ];

      const result = convertDbRows(dbRows);

      expect(result).toEqual([
        { userId: 1, profilePictureUrl: 'url1', createdAt: '2024-01-01' },
        { userId: 2, profilePictureUrl: 'url2', createdAt: '2024-01-02' },
      ]);
    });

    it('should handle empty array', () => {
      const result = convertDbRows([]);
      expect(result).toEqual([]);
    });
  });

  describe('convertDbRow', () => {
    it('should convert single database row', () => {
      const dbRow = {
        user_id: 1,
        profile_picture_url: 'url',
        created_at: '2024-01-01',
      };

      const result = convertDbRow(dbRow);

      expect(result).toEqual({
        userId: 1,
        profilePictureUrl: 'url',
        createdAt: '2024-01-01',
      });
    });
  });

  describe('round-trip conversions', () => {
    it('should convert from snake to camel and back', () => {
      const original = {
        user_id: 1,
        profile_picture_url: 'url',
        game_session_id: 123,
      };

      const camelCase = snakeToCamel(original);
      const backToSnake = camelToSnake(camelCase);

      expect(backToSnake).toEqual(original);
    });

    it('should convert from camel to snake and back', () => {
      const original = {
        userId: 1,
        profilePictureUrl: 'url',
        gameSessionId: 123,
      };

      const snakeCase = camelToSnake(original);
      const backToCamel = snakeToCamel(snakeCase);

      expect(backToCamel).toEqual(original);
    });
  });
});

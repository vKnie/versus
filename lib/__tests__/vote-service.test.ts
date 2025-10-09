import {
  validateVoteInput,
  determineWinner,
  VoteResults,
} from '../vote-service';

describe('vote-service', () => {
  describe('validateVoteInput', () => {
    it('should pass validation for valid input', () => {
      expect(() => {
        validateVoteInput(1, 0, 'Item A');
      }).not.toThrow();
    });

    it('should throw error for missing gameSessionId', () => {
      expect(() => {
        validateVoteInput(null, 0, 'Item A');
      }).toThrow('Invalid game session ID');
    });

    it('should throw error for undefined duelIndex', () => {
      expect(() => {
        validateVoteInput(1, undefined, 'Item A');
      }).toThrow('Invalid duel index');
    });

    it('should throw error for missing itemVoted', () => {
      expect(() => {
        validateVoteInput(1, 0, null);
      }).toThrow('Invalid item voted');
    });

    it('should throw error for invalid gameSessionId type', () => {
      expect(() => {
        validateVoteInput('invalid', 0, 'Item A');
      }).toThrow('Invalid game session ID');
    });

    it('should throw error for negative gameSessionId', () => {
      expect(() => {
        validateVoteInput(-1, 0, 'Item A');
      }).toThrow('Invalid game session ID');
    });

    it('should throw error for zero gameSessionId', () => {
      expect(() => {
        validateVoteInput(0, 0, 'Item A');
      }).toThrow('Invalid game session ID');
    });

    it('should throw error for invalid duelIndex type', () => {
      expect(() => {
        validateVoteInput(1, 'invalid', 'Item A');
      }).toThrow('Invalid duel index');
    });

    it('should throw error for negative duelIndex', () => {
      expect(() => {
        validateVoteInput(1, -1, 'Item A');
      }).toThrow('Invalid duel index');
    });

    it('should throw error for empty itemVoted', () => {
      expect(() => {
        validateVoteInput(1, 0, '');
      }).toThrow('Invalid item voted');
    });

    it('should throw error for itemVoted exceeding max length', () => {
      const longString = 'a'.repeat(501);
      expect(() => {
        validateVoteInput(1, 0, longString);
      }).toThrow('Invalid item voted');
    });

    it('should throw error for non-string itemVoted', () => {
      expect(() => {
        validateVoteInput(1, 0, 123 as any);
      }).toThrow('Invalid item voted');
    });
  });

  describe('determineWinner', () => {
    it('should return winner with most votes', () => {
      const voteResults: VoteResults[] = [
        { item_voted: 'Item A', votes: 5 },
        { item_voted: 'Item B', votes: 3 },
      ];

      const result = determineWinner(voteResults, 0);

      expect(result.winner).toBe('Item A');
      expect(result.tieBreaker).toBeNull();
    });

    it('should handle tie with coin flip', () => {
      const voteResults: VoteResults[] = [
        { item_voted: 'Item A', votes: 3 },
        { item_voted: 'Item B', votes: 3 },
      ];

      const result = determineWinner(voteResults, 0);

      // Winner should be either Item A or Item B
      expect(['Item A', 'Item B']).toContain(result.winner);

      // Tiebreaker should be present
      expect(result.tieBreaker).not.toBeNull();
      expect(result.tieBreaker?.duelIndex).toBe(0);
      expect(result.tieBreaker?.item1).toBe('Item A');
      expect(result.tieBreaker?.item2).toBe('Item B');
      expect(['heads', 'tails']).toContain(result.tieBreaker?.coinFlip);
      expect(result.tieBreaker?.votes).toBe(3);

      // Winner should match coin flip result
      if (result.tieBreaker?.coinFlip === 'heads') {
        expect(result.winner).toBe('Item A');
      } else {
        expect(result.winner).toBe('Item B');
      }
    });

    it('should throw error for empty vote results', () => {
      expect(() => {
        determineWinner([], 0);
      }).toThrow('No votes found');
    });

    it('should handle single vote result', () => {
      const voteResults: VoteResults[] = [
        { item_voted: 'Item A', votes: 5 },
      ];

      const result = determineWinner(voteResults, 0);

      expect(result.winner).toBe('Item A');
      expect(result.tieBreaker).toBeNull();
    });

    it('should handle three-way tie (only first two are compared)', () => {
      const voteResults: VoteResults[] = [
        { item_voted: 'Item A', votes: 2 },
        { item_voted: 'Item B', votes: 2 },
        { item_voted: 'Item C', votes: 2 },
      ];

      const result = determineWinner(voteResults, 0);

      // Should still trigger tiebreaker for first two
      expect(result.tieBreaker).not.toBeNull();
      expect(['Item A', 'Item B']).toContain(result.winner);
    });

    it('should not create tiebreaker when first and second have different votes', () => {
      const voteResults: VoteResults[] = [
        { item_voted: 'Item A', votes: 5 },
        { item_voted: 'Item B', votes: 4 },
        { item_voted: 'Item C', votes: 4 },
      ];

      const result = determineWinner(voteResults, 0);

      expect(result.winner).toBe('Item A');
      expect(result.tieBreaker).toBeNull();
    });

    it('should use correct duelIndex in tiebreaker', () => {
      const voteResults: VoteResults[] = [
        { item_voted: 'Item A', votes: 2 },
        { item_voted: 'Item B', votes: 2 },
      ];

      const result = determineWinner(voteResults, 5);

      expect(result.tieBreaker?.duelIndex).toBe(5);
    });

    it('should have consistent coin flip (heads -> item1, tails -> item2)', () => {
      // Run multiple times to verify consistency
      for (let i = 0; i < 10; i++) {
        const voteResults: VoteResults[] = [
          { item_voted: 'Item A', votes: 1 },
          { item_voted: 'Item B', votes: 1 },
        ];

        const result = determineWinner(voteResults, 0);

        if (result.tieBreaker?.coinFlip === 'heads') {
          expect(result.winner).toBe('Item A');
        } else {
          expect(result.winner).toBe('Item B');
        }
      }
    });
  });

  describe('integration scenarios', () => {
    it('should validate and determine winner for typical game flow', () => {
      // Validate vote inputs
      expect(() => validateVoteInput(1, 0, 'Item A')).not.toThrow();
      expect(() => validateVoteInput(1, 0, 'Item B')).not.toThrow();

      // Determine winner from votes
      const voteResults: VoteResults[] = [
        { item_voted: 'Item A', votes: 4 },
        { item_voted: 'Item B', votes: 2 },
      ];

      const result = determineWinner(voteResults, 0);
      expect(result.winner).toBe('Item A');
      expect(result.tieBreaker).toBeNull();
    });

    it('should handle tie scenario in game flow', () => {
      // Validate votes
      expect(() => validateVoteInput(1, 0, 'Item A')).not.toThrow();
      expect(() => validateVoteInput(1, 0, 'Item B')).not.toThrow();

      // Determine winner with tie
      const voteResults: VoteResults[] = [
        { item_voted: 'Item A', votes: 3 },
        { item_voted: 'Item B', votes: 3 },
      ];

      const result = determineWinner(voteResults, 0);

      // Should have winner determined by coin flip
      expect(['Item A', 'Item B']).toContain(result.winner);
      expect(result.tieBreaker).not.toBeNull();
    });
  });
});

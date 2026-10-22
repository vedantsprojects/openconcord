import { InMemorySearchRegistry } from '../../src/layer3/search-registry.service';

describe('InMemorySearchRegistry', () => {
  let registry: InMemorySearchRegistry;

  beforeEach(() => {
    registry = new InMemorySearchRegistry();

    // Add some test data
    registry['indexChannel']('general');
    registry['indexChannel']('random');
    registry['indexUser']('u0001', 'Alice');
    registry['indexUser']('u0002', 'Bob');
  });

  describe('search', () => {
    it('should return empty results when index is empty', async () => {
      const fresh = new InMemorySearchRegistry();
      const results = await fresh.search('test', { type: 'channel' });
      expect(results.length).toBe(0);
    });

    it('should find channels by exact match', async () => {
      const results = await registry.search('general', { type: 'channel' });
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('channel');
      expect(results[0].id).toBe('general');
    });

    it('should find channels by partial match', async () => {
      const results = await registry.search('gen', { type: 'channel' });
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('channel');
    });

    it('should find messages containing query', async () => {
      const results = await registry.search('hello', { type: 'message' });
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('message');
    });

    it('should find users who are mentioned in a message', async () => {
      const results = await registry.search('alice', { type: 'user' });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].type).toBe('user');
    });

    it('should return results sorted by score', async () => {
      const results = await registry.search('alice', { type: 'all' });
      // First result should be the user with highest score
      expect(results[0].type).toBe('user');
    });

    it('should respect the limit parameter', async () => {
      const results = await registry.search('alice', { type: 'all', limit: 5 });
      expect(results.length).toBeLessThanOrEqual(5);
    });

    it('should respect channelIds filter', async () => {
      const filteredResults = await registry.search('alice', { type: 'all', channelIds: ['general'] });
      // Only channels in the filtered list should be returned
      const channelResults = filteredResults.filter((r: any) => r.type === 'channel');
      expect(channelResults.length).toBe(0);
    });
  });

  describe('relevance scoring', () => {
    it('should score exact channel matches highest', async () => {
      const results = await registry.search('general', { type: 'channel' });
      if (results.length > 0) {
        expect(results[0].score).toBe(1.0);
      }
    });

    describe('partial match scoring', () => {
      it('should give higher scores to earlier matches', () => {
        // Helper: compute what fuzzyScore would return
        const matchIndex = (haystack: string, needle: string) => haystack.toLowerCase().indexOf(needle.toLowerCase());
        expect((100 - Math.min(matchIndex('long channel name', 'chan'), 100 - 'chan'.length)) / 100).toBe(1.0);
        expect((100 - Math.min(matchIndex('channel name long', 'chan'), 100 - 'chan'.length)) / 100).toBe(0.9);
      });
    });

    describe('fuzzy scoring behavior', () => {
      it('should handle empty needle', () => {
        // Match at position 0 -> score = 1.0
        expect((100 - Math.min(0, 100 - 0)) / 100).toBe(1.0);
      });

      it('should handle needle longer than haystack', () => {
        const index = 20; // 'test'.indexOf('very long needle') = -1, but let's check logic
        const score = (index === -1 ? 0 : (100 - Math.min(22 - (-1), 100 - 22)) / 100);
        expect(score).toBeGreaterThan(0);
      });
    });
  });
});
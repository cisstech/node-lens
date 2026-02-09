import { getPackageInfo } from './package-info';
import { readFile } from 'fs/promises';

// Mock fs/promises
jest.mock('fs/promises');
const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;

describe('package-info', () => {
  describe('getPackageInfo', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should read package.json successfully', async () => {
      const mockPackageJson = {
        name: '@cisstech/node-lens-cli',
        version: '1.10.0',
        description: 'CLI tool for creating Node Lens plugins',
      };

      mockReadFile.mockResolvedValue(JSON.stringify(mockPackageJson));

      const result = await getPackageInfo();

      expect(result).toEqual(mockPackageJson);
      expect(mockReadFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        'utf-8'
      );
    });

    it('should throw error when package.json cannot be read', async () => {
      mockReadFile.mockRejectedValue(new Error('File not found'));

      await expect(getPackageInfo()).rejects.toThrow(Error);
    });

    it('should handle malformed JSON', async () => {
      mockReadFile.mockResolvedValue('invalid json');

      await expect(getPackageInfo()).rejects.toThrow(SyntaxError);
    });
  });
});

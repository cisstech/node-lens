import { validatePluginName } from './validation';

describe('validation', () => {
  describe('validatePluginName', () => {
    it('should accept valid plugin names', () => {
      const validNames = [
        'my-plugin',
        'myPlugin',
        'my_plugin',
        'plugin123',
        'a1',
        'monitor-plugin',
      ];

      validNames.forEach((name) => {
        const result = validatePluginName(name);
        expect(result.valid).toBe(true);
        expect(result.message).toBeUndefined();
      });
    });

    it('should reject invalid plugin names', () => {
      const invalidCases = [
        { name: '', expectedMessage: 'Plugin name cannot be empty' },
        { name: 'a', expectedMessage: 'Plugin name must be at least 2 characters long' },
        { name: 'a'.repeat(51), expectedMessage: 'Plugin name cannot exceed 50 characters' },
        { name: '-invalid', expectedMessage: 'Plugin name can only contain letters, numbers, hyphens, and underscores, and must start with a letter or number' },
        { name: 'invalid-', expectedMessage: undefined }, // This should actually be valid
        { name: 'invalid@name', expectedMessage: 'Plugin name can only contain letters, numbers, hyphens, and underscores, and must start with a letter or number' },
        { name: 'node_modules', expectedMessage: '"node_modules" is a reserved name' },
        { name: 'src', expectedMessage: '"src" is a reserved name' },
      ];

      invalidCases.forEach(({ name, expectedMessage }) => {
        const result = validatePluginName(name);
        if (name === 'invalid-') {
          // This case should actually be valid
          expect(result.valid).toBe(true);
        } else {
          expect(result.valid).toBe(false);
          if (expectedMessage) {
            expect(result.message).toBe(expectedMessage);
          }
        }
      });
    });

    it('should handle reserved names case-insensitively', () => {
      const reservedVariations = ['NODE_MODULES', 'Node_Modules', 'SRC', 'Src'];

      reservedVariations.forEach((name) => {
        const result = validatePluginName(name);
        expect(result.valid).toBe(false);
        expect(result.message).toContain('is a reserved name');
      });
    });
  });
});

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validatePluginName(name: string): ValidationResult {
  if (!name) {
    return { valid: false, message: 'Plugin name cannot be empty' };
  }

  if (name.length < 2) {
    return { valid: false, message: 'Plugin name must be at least 2 characters long' };
  }

  if (name.length > 50) {
    return { valid: false, message: 'Plugin name cannot exceed 50 characters' };
  }

  // Check for valid characters (alphanumeric, hyphens, underscores)
  const validNameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_]*$/;
  if (!validNameRegex.test(name)) {
    return {
      valid: false,
      message: 'Plugin name can only contain letters, numbers, hyphens, and underscores, and must start with a letter or number',
    };
  }

  // Check for reserved names
  const reservedNames = ['node_modules', 'src', 'dist', 'build', 'test', 'tests', '.git', '.nx'];
  if (reservedNames.includes(name.toLowerCase())) {
    return { valid: false, message: `"${name}" is a reserved name` };
  }

  return { valid: true };
}

import { readFile } from 'fs/promises';
import { join } from 'path';

interface PackageInfo {
  name: string;
  version: string;
  description: string;
}

export async function getPackageInfo(): Promise<PackageInfo> {
  const packageJsonPath = join(__dirname, '../../../../package.json');
  const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
  return JSON.parse(packageJsonContent);
}

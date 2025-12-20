/**
 * CDN Downloader
 * Downloads framework dependencies from esm.sh CDN for production upload to R2
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface DownloadedDependency {
  name: string;
  version: string;
  files: {
    path: string;  // Relative path (e.g., 'index.js', 'internal/client.js')
    content: string;
  }[];
}

/**
 * Download a single file from esm.sh
 */
async function downloadFile(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      responseType: 'text',
      headers: {
        'User-Agent': 'oaysus-cli'
      }
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to download ${url}: ${error}`);
  }
}

/**
 * Download framework dependency from esm.sh CDN
 * Downloads main export and all sub-exports
 */
export async function downloadFrameworkDependency(
  packageName: string,
  version: string,
  subExports: string[] = []
): Promise<DownloadedDependency> {
  const baseUrl = `https://esm.sh/${packageName}@${version}`;
  const files: DownloadedDependency['files'] = [];

  // console.log(`Downloading ${packageName}@${version} from esm.sh...`);

  // Download main export
  try {
    const mainContent = await downloadFile(baseUrl);
    files.push({
      path: 'index.js',
      content: mainContent
    });
  } catch (error) {
    console.error(`Failed to download main export for ${packageName}:`, error);
    throw error;
  }

  // Download sub-exports
  for (const exportName of subExports) {
    try {
      const exportUrl = `${baseUrl}/${exportName}`;
      const exportContent = await downloadFile(exportUrl);

      // Convert slash paths to files with dashes for consistency
      const fileName = exportName.replace(/\//g, '-') + '.js';

      files.push({
        path: fileName,
        content: exportContent
      });
    } catch (error) {
      console.warn(`Could not download ${packageName}/${exportName}, skipping...`);
    }
  }

  return {
    name: packageName,
    version,
    files
  };
}

/**
 * Save downloaded dependency to disk
 */
export function saveDownloadedDependency(
  dependency: DownloadedDependency,
  outputDir: string
): void {
  const depDir = path.join(outputDir, `${dependency.name}@${dependency.version}`);

  // Create directory
  if (!fs.existsSync(depDir)) {
    fs.mkdirSync(depDir, { recursive: true });
  }

  // Save all files
  for (const file of dependency.files) {
    const filePath = path.join(depDir, file.path);

    // Create parent directory if needed (for nested paths)
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.content);
  }

  // console.log(`Saved ${dependency.name}@${dependency.version} (${dependency.files.length} files)`);
}

/**
 * Get list of framework dependencies to download based on framework type
 */
export function getFrameworkDependencies(
  framework: string,
  version: string
): Array<{ packageName: string; version: string; subExports: string[] }> {
  switch (framework) {
    case 'react':
      return [
        {
          packageName: 'react',
          version,
          subExports: ['jsx-runtime', 'jsx-dev-runtime']
        },
        {
          packageName: 'react-dom',
          version,
          subExports: ['client']
        }
      ];

    case 'svelte':
      return [
        {
          packageName: 'svelte',
          version,
          subExports: ['internal', 'store', 'motion', 'transition', 'animate', 'easing', 'legacy']
        }
      ];

    case 'vue':
      return [
        {
          packageName: 'vue',
          version,
          subExports: []
        }
      ];

    default:
      return [];
  }
}

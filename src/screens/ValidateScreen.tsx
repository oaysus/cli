import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { Logo } from '../components/Logo.js';
import { Spinner } from '../components/Spinner.js';
import { SuccessMessage } from '../components/SuccessMessage.js';
import { ValidationProgress } from '../components/ValidationProgress.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { validatePackage } from '../lib/validator.js';
import type { ValidationResult } from '../types/validation.js';
import { HistoryEntry } from '../components/App.js';

type ValidationState =
  | 'idle'
  | 'validating-structure'
  | 'validating-schemas'
  | 'discovering-components'
  | 'success';

interface ValidateScreenProps {
  projectPath?: string;
  dryRun?: boolean;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
}

export const ValidateScreen: React.FC<ValidateScreenProps> = ({
  projectPath = '.',
  onExit,
  sessionHistory = [],
  addToHistory
}) => {
  const [state, setState] = useState<ValidationState>('idle');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [appData, setAppData] = useState({
    version: '0.1.0',
    isLoaded: false
  });
  const [directory] = useState(path.resolve(projectPath));

  // Destructure for easier access
  const { version } = appData;

  // Load version on mount
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const pkgPath = path.join(__dirname, '../../package.json');
        const pkgData = await readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgData);
        setAppData({
          version: pkg.version,
          isLoaded: true
        });
      } catch {
        setAppData({
          version: '0.1.0',
          isLoaded: true
        });
      }
    };

    loadVersion();
  }, []);

  useEffect(() => {
    const runValidation = async () => {
      try {
        // Log the command being run
        if (addToHistory) {
          addToHistory({
            type: 'info',
            content: '❯ /validate',
            color: 'cyan',
            // Add spacing marker to indicate this should have top margin
            spinnerId: sessionHistory.length > 0 ? 'command-separator' : undefined
          });
        }

        // Add validation start to history
        if (addToHistory) {
          addToHistory({
            type: 'info',
            content: `Validating package in: ${directory}`
          });
        }

        // Step 1: Early check - is this even a theme/component directory?
        setState('validating-structure');
        setProgress(20);

        const hasPackageJson = await (async () => {
          try {
            const fs = await import('fs/promises');
            await fs.access(path.join(projectPath, 'package.json'));
            return true;
          } catch {
            return false;
          }
        })();

        const hasComponentsDir = await (async () => {
          try {
            const fs = await import('fs/promises');
            await fs.access(path.join(projectPath, 'components'));
            return true;
          } catch {
            return false;
          }
        })();

        if (!hasPackageJson && !hasComponentsDir) {
          if (addToHistory) {
            addToHistory({
              type: 'info',
              content: `Validation failed: Not a valid theme or component directory (checked ${directory})`
            });
          }

          onExit?.();
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 300));

        // Step 2: Validate schemas
        setState('validating-schemas');
        setProgress(40);
        const result = await validatePackage(projectPath);

        if (!result.valid) {
          if (addToHistory) {
            // Add all errors to history
            result.errors.forEach(error => {
              addToHistory({
                type: 'info',
                content: `Validation failed: ${error}`
              });
            });
          }

          onExit?.();
          return;
        }

        setValidationResult(result);

        // Step 3: Discover components
        setState('discovering-components');
        setProgress(80);
        await new Promise(resolve => setTimeout(resolve, 300));

        // Success
        setProgress(100);
        setState('success');

        if (addToHistory) {
          addToHistory({
            type: 'response',
            content: 'Package validation successful'
          });
        }

        onExit?.();

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Validation failed';

        if (addToHistory) {
          addToHistory({
            type: 'info',
            content: `Validation failed: ${errorMessage}`
          });
        }

        onExit?.();
      }
    };

    runValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectPath]);

  return (
    <Box flexDirection="column" padding={1}>
      {/* Logo Header */}
      {appData.isLoaded && (
        <Logo
          version={version}
          directory={directory}
        />
      )}

      {/* Session History */}
      {sessionHistory && sessionHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          {sessionHistory.slice(-5).map((entry, index) => (
            <Box key={index} marginBottom={0}>
              {entry.type === 'prompt' && (
                <Text color="cyan">
                  → {entry.content}
                </Text>
              )}
              {entry.type === 'response' && (
                <Text color="green">
                  ✓ {entry.content}
                </Text>
              )}
              {entry.type === 'info' && (
                <Text dimColor>
                  {entry.content}
                </Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Command Indicator */}
      <Box marginTop={1} marginBottom={1}>
        <Text color="cyan" bold>
          → /validate
        </Text>
      </Box>

      {/* Progress Indicator */}
      <Box marginTop={1} marginBottom={1}>
        <ProgressBar progress={progress} width={50} />
      </Box>

      {/* Validation States */}
      {state === 'validating-structure' && (
        <Spinner message="Validating package structure..." color="cyan" />
      )}

      {state === 'validating-schemas' && (
        <Spinner message="Validating schemas..." color="cyan" />
      )}

      {state === 'discovering-components' && validationResult && (
        <Box flexDirection="column">
          <Text color="green" bold>
            ✓ Validation passed
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              Framework: <Text color="white">{validationResult.inferredConfig.framework}</Text>
            </Text>
            <Text dimColor>
              Type: <Text color="white">{validationResult.inferredConfig.type}</Text>
            </Text>
            <Text dimColor>
              Version: <Text color="white">{validationResult.inferredConfig.version}</Text>
            </Text>
          </Box>
          <Box marginTop={1}>
            <Spinner message={`Discovering ${validationResult.components.length} component(s)...`} />
          </Box>
        </Box>
      )}

      {/* Success State */}
      {state === 'success' && validationResult && (
        <Box flexDirection="column">
          <ValidationProgress validationResult={validationResult} />

          <Box marginTop={2}>
            <SuccessMessage
              message="Validation passed!"
              details={[
                'Package structure is valid',
                'All schemas are correct',
                `${validationResult.components.length} component(s) found`,
                'Ready to push with /push'
              ]}
            />
          </Box>

          {validationResult.warnings.length > 0 && (
            <Box marginTop={1} flexDirection="column">
              <Text color="yellow" bold>
                Warnings:
              </Text>
              {validationResult.warnings.map((warn, i) => (
                <Text key={i} color="yellow">
                  ⚠ {warn}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ValidateScreen;

import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import path from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { Logo } from '../components/Logo.js';
import { Spinner } from '../components/Spinner.js';
import { SuccessMessage } from '../components/SuccessMessage.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { Framework, CreateComponentOptions } from '../types/templates.js';
import { createComponent } from '../lib/project-generator.js';
import { fileExists, directoryExists, readFile as readFileSync } from '../lib/shared/file-utils.js';
import { toPascalCase } from '../lib/shared/file-utils.js';
import { loadCredentials } from '../lib/shared/auth.js';
import { HistoryEntry } from '../components/App.js';

interface Props {
  componentName?: string;
  projectPath?: string;
  onExit?: () => void;
  sessionHistory?: HistoryEntry[];
  addToHistory?: (entry: HistoryEntry | HistoryEntry[]) => void;
}

type Screen =
  | 'component-name'
  | 'description'
  | 'category'
  | 'confirm'
  | 'creating'
  | 'success'
  | 'error';

export function CreateScreen({
  componentName: initialName,
  projectPath = '.',
  onExit,
  sessionHistory = [],
  addToHistory
}: Props) {
  const [screen, setScreen] = useState<Screen>('component-name');
  const [componentName, setComponentName] = useState(initialName || '');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [error, setError] = useState<string>('');
  const [framework, setFramework] = useState<Framework>('react');
  const [filesCreated, setFilesCreated] = useState<string[]>([]);
  const [appData, setAppData] = useState({
    version: '0.1.0',
    userEmail: null as string | null,
    isLoaded: false
  });
  const [directory] = useState(process.cwd());

  // Destructure for easier access
  const { version, userEmail, isLoaded } = appData;

  // Load version and credentials on mount
  useEffect(() => {
    const loadAllData = async () => {
      // Load all data in parallel
      const [versionData, credsData] = await Promise.all([
        // Load version
        (async () => {
          try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const pkgPath = path.join(__dirname, '../../package.json');
            const pkgData = await readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(pkgData);
            return pkg.version;
          } catch {
            return '0.1.0';
          }
        })(),
        // Load credentials
        loadCredentials()
      ]);

      // Single state update to prevent multiple renders
      setAppData({
        version: versionData,
        userEmail: credsData?.email || null,
        isLoaded: true
      });

    };

    loadAllData();
  }, []);

  // Detect framework from package.json on mount
  useEffect(() => {
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (!fileExists(packageJsonPath)) {
      setError('No package.json found. Are you in a valid Oaysus project?');
      setScreen('error');
      return;
    }

    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.react) {
        setFramework('react');
      } else if (deps.vue) {
        setFramework('vue');
      } else if (deps.svelte) {
        setFramework('svelte');
      } else {
        setError('Could not detect framework from package.json');
        setScreen('error');
      }
    } catch (err) {
      setError('Failed to read package.json');
      setScreen('error');
    }

    // Check if components directory exists (theme pack check)
    const componentsDir = path.join(projectPath, 'components');
    if (!directoryExists(componentsDir)) {
      setError('Not a theme pack project. Components directory not found.');
      setScreen('error');
    }
  }, [projectPath]);

  // Auto-exit after success
  useEffect(() => {
    if (screen === 'success') {
      const timer = setTimeout(() => {
        if (onExit) onExit();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [screen, onExit]);

  // Handle cancellation
  const handleCancel = () => {
    if (addToHistory) {
      addToHistory({
        type: 'info',
        content: 'Create command cancelled, returned to menu'
      });
    }
    if (onExit) onExit();
  };

  // Component Name Input
  const handleComponentNameSubmit = (value: string) => {
    const name = toPascalCase(value.trim());

    if (!name) {
      setError('Component name is required');
      return;
    }

    setComponentName(name);
    if (addToHistory) {
      // Add command name and first input
      const entries: HistoryEntry[] = [];

      entries.push({
        type: 'info',
        content: '❯ /create',
        color: 'cyan',
        // Add spacing marker to indicate this should have top margin
        spinnerId: sessionHistory.length > 0 ? 'command-separator' : undefined
      });

      entries.push({ type: 'prompt', content: 'What should we call this component?' });
      entries.push({ type: 'response', content: name });

      addToHistory(entries);
    }
    setError('');
    setScreen('description');
  };

  // Description Input
  const handleDescriptionSubmit = (value: string) => {
    const desc = value.trim() || `${componentName} component`;
    setDescription(desc);
    if (addToHistory) {
      addToHistory([
        { type: 'prompt', content: 'Add a brief description' },
        { type: 'response', content: desc }
      ]);
    }
    setScreen('category');
  };

  // Category Input
  const handleCategorySubmit = (value: string) => {
    const cat = value.trim() || 'marketing';
    setCategory(cat);
    if (addToHistory) {
      addToHistory([
        { type: 'prompt', content: 'What category is this component?' },
        { type: 'response', content: cat }
      ]);
    }
    setScreen('confirm');
  };

  // Confirmation
  useInput((input, key) => {
    if (screen === 'confirm') {
      if (input === 'y' || input === 'Y') {
        handleCreate();
      } else if (input === 'n' || input === 'N' || key.escape) {
        handleCancel();
      }
    } else if (key.escape && screen !== 'creating' && screen !== 'success' && screen !== 'error') {
      handleCancel();
    }
  });

  // Create Component
  const handleCreate = async () => {
    setScreen('creating');

    const options: CreateComponentOptions = {
      name: componentName,
      displayName: componentName,
      description,
      category
    };

    const result = await createComponent(options, projectPath, framework);

    if (result.success) {
      setFilesCreated(result.filesCreated);
      setScreen('success');
    } else {
      setError(result.error || 'Unknown error occurred');
      setScreen('error');
    }
  };

  // Don't render until data is loaded to prevent double rendering
  if (!isLoaded) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {/* Logo with version, directory, and login status */}
      <Logo version={version} directory={directory} userEmail={userEmail} />

      {/* Session History - Shows accumulated selections */}
      {sessionHistory.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          {sessionHistory.map((entry, index) => {
            const isLastEntry = index === sessionHistory.length - 1;
            const uniqueKey = `history-${index}-${entry.type}-${entry.spinnerId || ''}`;

            if (entry.type === 'prompt') {
              return (
                <Box key={uniqueKey}>
                  <Text>{entry.content}</Text>
                </Box>
              );
            } else if (entry.type === 'response') {
              return (
                <Box key={uniqueKey} marginBottom={isLastEntry ? 0 : 1}>
                  <Text dimColor>❯ </Text>
                  <Text>{entry.content}</Text>
                </Box>
              );
            } else {
              // info type
              const needsTopMargin = entry.spinnerId === 'command-separator';
              return (
                <Box key={uniqueKey} marginBottom={isLastEntry ? 0 : 1} marginTop={needsTopMargin ? 1 : 0}>
                  <Text dimColor>{entry.content}</Text>
                </Box>
              );
            }
          })}
        </Box>
      )}

      {/* Command indicator showing active command */}
      <Box flexDirection="column">
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
        <Box>
          <Text dimColor>❯ </Text>
          <Text dimColor>/create</Text>
        </Box>
        <Text dimColor>{'─'.repeat(process.stdout.columns || 80)}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={2}>
        {screen === 'component-name' && (
          <Box flexDirection="column">
            <Box>
              <Text>What should we call this component? </Text>
              <Text dimColor>(Step 1 of 3)</Text>
            </Box>
            <Text dimColor>Enter a component name (e.g., "Pricing" or "FeatureGrid")</Text>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <Text color="cyan">
                <TextInput
                  value={componentName}
                  onChange={setComponentName}
                  onSubmit={handleComponentNameSubmit}
                  placeholder="MyComponent"
                />
              </Text>
            </Box>
            {error && (
              <Box marginTop={1}>
                <Text color="red">✗ {error}</Text>
              </Box>
            )}
            <Box marginTop={1}>
              <Text dimColor>Press Esc to return to main menu</Text>
            </Box>
          </Box>
        )}

        {screen === 'description' && (
          <Box flexDirection="column">
            <Box>
              <Text>Add a brief description </Text>
              <Text dimColor>(Step 2 of 3)</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <Text color="cyan">
                <TextInput
                  value={description}
                  onChange={setDescription}
                  onSubmit={handleDescriptionSubmit}
                  placeholder={`${componentName} component`}
                />
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press Esc to return to main menu</Text>
            </Box>
          </Box>
        )}

        {screen === 'category' && (
          <Box flexDirection="column">
            <Box>
              <Text>What category is this component? </Text>
              <Text dimColor>(Step 3 of 3)</Text>
            </Box>
            <Text dimColor>e.g., marketing, content, layout</Text>
            <Box marginTop={1}>
              <Text color="cyan">❯ </Text>
              <Text color="cyan">
                <TextInput
                  value={category}
                  onChange={setCategory}
                  onSubmit={handleCategorySubmit}
                  placeholder="marketing"
                />
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Press Esc to return to main menu</Text>
            </Box>
          </Box>
        )}

        {screen === 'confirm' && (
          <Box flexDirection="column">
            <Text>Ready to create your component?</Text>
            <Box marginTop={1} flexDirection="column" paddingLeft={2}>
              <Text><Text color="gray">Component:</Text> {componentName}</Text>
              <Text><Text color="gray">Framework:</Text> {framework}</Text>
              <Text><Text color="gray">Description:</Text> {description}</Text>
              <Text><Text color="gray">Category:</Text> {category}</Text>
            </Box>
            <Box marginTop={1}>
              <Text>
                <Text color="cyan">Create component?</Text>
                {' '}
                <Text dimColor>(y/n)</Text>
              </Text>
            </Box>
          </Box>
        )}

        {screen === 'creating' && (
          <Box flexDirection="column">
            <Spinner type="dots" color="cyan" message="Creating component..." />
          </Box>
        )}

        {screen === 'success' && (
          <SuccessMessage
            message={`Component "${componentName}" created successfully!`}
            details={[
              `📁 Location: components/${componentName}/`,
              `📦 Framework: ${framework}`,
              `🏷️  Category: ${category}`,
              '',
              'Files created:',
              ...filesCreated.map(f => `  ✓ ${f}`)
            ]}
          />
        )}

        {screen === 'error' && (
          <ErrorMessage
            message="Failed to create component"
            details={[error]}
            suggestion="Ensure you are in a theme pack project directory with a components folder"
          />
        )}
      </Box>
    </Box>
  );
}

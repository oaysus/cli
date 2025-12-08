import React from 'react';
import { Box, Text } from 'ink';
import type { ValidationResult } from '../types/validation.js';

interface ValidationProgressProps {
  validationResult: ValidationResult;
}

/**
 * ValidationProgress Component
 * Displays validation results with component list
 */
export const ValidationProgress: React.FC<ValidationProgressProps> = ({
  validationResult
}) => {
  return (
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

      {validationResult.inferredConfig.theme && (
        <Box marginTop={1} flexDirection="column">
          <Text color="cyan" bold>
            Theme: {validationResult.inferredConfig.theme.displayName}
          </Text>
          {validationResult.inferredConfig.theme.description && (
            <Text dimColor>
              {validationResult.inferredConfig.theme.description}
            </Text>
          )}
          {validationResult.inferredConfig.theme.category && (
            <Text dimColor>
              Category: <Text color="white">{validationResult.inferredConfig.theme.category}</Text>
            </Text>
          )}
          {validationResult.inferredConfig.theme.tags && validationResult.inferredConfig.theme.tags.length > 0 && (
            <Text dimColor>
              Tags: <Text color="white">{validationResult.inferredConfig.theme.tags.join(', ')}</Text>
            </Text>
          )}
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color="green">
          ✓ Found {validationResult.components.length} component(s):
        </Text>
        {validationResult.components.map((comp, i) => (
          <Text key={i} dimColor>
            • {comp.displayName} ({comp.name})
          </Text>
        ))}
      </Box>
    </Box>
  );
};

export default ValidationProgress;

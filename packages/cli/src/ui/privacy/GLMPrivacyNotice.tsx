/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Newline, Text, useInput } from 'ink';
import { Colors } from '../colors.js';

interface GLMPrivacyNoticeProps {
  onExit: () => void;
}

export const GLMPrivacyNotice = ({ onExit }: GLMPrivacyNoticeProps) => {
  useInput((input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={Colors.AccentPurple}>
        GLM-4.5 API Notice
      </Text>
      <Newline />
      <Text>
        By using the GLM-4.5 API<Text color={Colors.AccentBlue}>[1]</Text>,
        you are agreeing to the Zhipu AI Terms of Service
        <Text color={Colors.AccentRed}>[2]</Text> and the API Usage Agreement
        <Text color={Colors.AccentGreen}>[3]</Text>.
      </Text>
      <Newline />
      <Text>
        GLM-4.5 is a powerful AI model with 90.6% tool calling success rate,
        supporting both standard (355B) and Air (106B) variants. You can obtain
        API keys from either Z.ai Platform (International) or Zhipu AI Platform
        (China Mainland).
      </Text>
      <Newline />
      <Text>
        <Text color={Colors.AccentBlue}>[1]</Text>{' '}
        https://open.bigmodel.cn
      </Text>
      <Text>
        <Text color={Colors.AccentRed}>[2]</Text> https://platform.z.ai/terms
      </Text>
      <Text>
        <Text color={Colors.AccentGreen}>[3]</Text>{' '}
        https://open.bigmodel.cn/dev/howuse/agreement
      </Text>
      <Newline />
      <Text color={Colors.Gray}>Press Esc to exit.</Text>
    </Box>
  );
};
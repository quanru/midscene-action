import { describe, expect, it } from '@rstest/core';
import { parseDotenv } from '../src/util/env.js';

describe('parseDotenv', () => {
  it('parses simple keys and strips an optional export prefix', () => {
    const env = parseDotenv(`
# comment line
MIDSCENE_MODEL_NAME=qwen-test
export MIDSCENE_MODEL_API_KEY="sk-secret"
MIDSCENE_MODEL_FAMILY='qwen'
`);
    expect(env.MIDSCENE_MODEL_NAME).toBe('qwen-test');
    expect(env.MIDSCENE_MODEL_API_KEY).toBe('sk-secret');
    expect(env.MIDSCENE_MODEL_FAMILY).toBe('qwen');
  });

  it('removes trailing inline comments for unquoted values', () => {
    const env = parseDotenv('MIDSCENE_MODEL_NAME=qwen # which model\n');
    expect(env.MIDSCENE_MODEL_NAME).toBe('qwen');
  });

  it('ignores blank lines and comments', () => {
    const env = parseDotenv('\n  \n# only a comment\n');
    expect(Object.keys(env)).toHaveLength(0);
  });
});

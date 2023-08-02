import fs from 'fs-extra';
import * as path from 'node:path';
import { jest } from '@jest/globals';
import { prepare } from '../lib/prepare.js';
import { PluginConfig } from '../lib/classes/plugin-config.class.js';
import * as contexts from './get-context.js';
import { replaceVersions } from '../lib/utils/replace-versions.js';
import { success } from '../lib/success.js';
import SemanticReleaseError from '@semantic-release/error';
import { publish } from '../lib/publish.js';

const pluginConfig: PluginConfig = {
  type: 'plugin',
  slug: 'dist-test',
  path: './test/fixtures/dist-test',
  withAssets: true,
  withReadme: true,
  include: ['dist-test.php', './*.php', 'vendor'],
  exclude: [],
  withVersionFile: true,
  workDir: 'publish',
};

let releasePath: string;
const env = process.env;

beforeAll(async () => {
  releasePath = fs.mkdtempSync('/tmp/wp-release-');
  pluginConfig.releasePath = releasePath;
});

beforeEach(() => {
  jest.resetModules();
  process.env = { ...env };
});

afterEach(async () => {
  await replaceVersions(
    path.resolve('./test/fixtures/dist-test'),
    ['dist-test.php'],
    '0.0.0',
    '1.0.0',
  );
  await replaceVersions(
    path.resolve('./test/fixtures/dist-test'),
    ['.wordpress-org/readme.txt'],
    '0.0.0',
    '1.0.0',
  );
  await fs.remove('/tmp/workDir-publish-test');
});

afterAll(async () => {
  fs.removeSync(releasePath);
});

describe('Publish step', () => {
  it('Should package a complete plugin', async () => {
    await prepare(pluginConfig, contexts.publishContext);
    await publish(pluginConfig, contexts.publishContext);

    const distFolder = fs
      .readdirSync(path.join(releasePath, 'dist-test'))
      .join(' ');

    expect(distFolder).not.toContain('node_modules');
    expect(distFolder).toContain('vendor');
    expect(distFolder).toContain('dist-test.php');
    expect(distFolder).toContain('test1.php');
  });

  it('Should should remove folders on success', async () => {
    await success(pluginConfig, contexts.publishContext);

    const files = fs.readdirSync(releasePath).join(' ');

    expect(files).toContain('package.zip');
    expect(files).toContain('assets.zip');
    expect(files).toContain('VERSION');
    expect(files).not.toContain('dist-test');
    expect(files).not.toContain('assets ');
  });

  it('Should fail when no assets exist', async () => {
    try {
      await prepare(pluginConfig, contexts.publishContext);

      await fs.remove(path.join(releasePath, 'assets'));
      await publish(pluginConfig, contexts.publishContext);
    } catch (err) {
      expect((err as SemanticReleaseError).code).toBe('EZIP');
    }
  }, 10000);

  it('Should fail on invalid zip command env override', async () => {
    process.env.ZIP_COMMAND = 'zipr';

    try {
      await prepare(pluginConfig, contexts.publishContext);
      await publish(pluginConfig, contexts.publishContext);
    } catch (err) {
      expect((err as SemanticReleaseError).code).toBe('EZIP');
    }
  }, 5000);
});

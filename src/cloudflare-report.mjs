import {
  appendFile,
  cp,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

async function prepare() {
  const results = path.resolve('.midscene/test-results');
  const entries = await readdir(results, { withFileTypes: true }).catch(
    (error) => {
      if (error.code === 'ENOENT') return [];
      throw error;
    },
  );
  const summaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(results, entry.name, 'summary.json');
    try {
      await stat(file);
      summaries.push(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (summaries.length !== 1) {
    throw new Error(
      'Expected one Midscene test result. Run midscene-test in working-directory with a clean output directory before publishing.',
    );
  }
  let report;
  let reportRoot;
  try {
    const summary = JSON.parse(await readFile(summaries[0], 'utf8'));
    if (typeof summary.report !== 'string' || !summary.report)
      throw new Error('Missing report');
    report = await realpath(
      path.resolve(path.dirname(summaries[0]), summary.report),
    );
    reportRoot = await realpath('midscene_run/report');
  } catch {
    throw new Error(
      'Midscene HTML report not found. Run midscene-test in working-directory before publishing.',
    );
  }
  const relative = path.relative(reportRoot, report);
  if (
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative) ||
    path.basename(report) !== 'index.html' ||
    !(await stat(report)).isFile()
  ) {
    throw new Error(
      'Midscene HTML report must be an index.html file under midscene_run/report.',
    );
  }
  let fileCount = 0;
  async function checkAssets(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await checkAssets(file);
      } else if (entry.isFile()) {
        if (
          ++fileCount > 20_000 ||
          (await stat(file)).size > 25 * 1024 * 1024
        ) {
          throw new Error(
            'Cloudflare Workers supports up to 20,000 files per deployment and 25 MiB per file. This report exceeds those limits.',
          );
        }
      } else {
        throw new Error(
          'The published report must contain only regular files and directories, without symbolic links.',
        );
      }
    }
  }
  await checkAssets(path.dirname(report));
  const directory = await mkdtemp(
    path.join(process.env.RUNNER_TEMP, 'midscene-report.'),
  );
  await cp(path.dirname(report), path.join(directory, 'site'), {
    recursive: true,
  });
  await writeFile(
    path.join(directory, 'wrangler.json'),
    JSON.stringify({
      name: process.env.CLOUDFLARE_WORKER_NAME,
      compatibility_date: '2026-10-14',
      assets: { directory: './site', not_found_handling: 'none' },
      previews: {},
    }),
  );
  await appendFile(process.env.GITHUB_OUTPUT, `directory=${directory}\n`);
}

try {
  await prepare();
} catch (error) {
  const message = error.message
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
  process.stderr.write(`::error::${message}\n`);
  process.exitCode = 1;
}

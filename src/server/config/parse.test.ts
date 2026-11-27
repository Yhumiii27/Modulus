// The configuration schema — defaults, invalid values, production requirements, secrets kept out of messages (copied from
// Keystone, R-007, and adapted: PostgreSQL only, Modulus's variables).
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CONFIG_VARIABLES, formatIssues, parseConfig, redactUrl } from './parse';

const cwd = '/srv/modulus';
const DB = 'postgres://modulus_app:s3cret-pw@db:5432/atrium';
const parse = (env: Record<string, string | undefined>) => parseConfig({ DATABASE_URL: DB, ...env }, { cwd });
const vars = (issues: { variable: string }[]) => issues.map((i) => i.variable);

describe('parseConfig', () => {
  it('defaults: development, demo seed, info logs, pretty format, real clock', () => {
    const r = parse({});
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.config).toMatchObject({
      env: 'development', production: false, dataDir: path.join(cwd, '.data'), database: { url: DB, poolMax: 10 },
      seed: 'demo', seedExplicit: false, clock: null, log: { level: 'info', format: 'pretty' },
    });
    // The database password is a secret the logger masks.
    expect(r.config.secrets).toEqual(['s3cret-pw']);
  });

  it('PostgreSQL only: DATABASE_URL is required, in every environment', () => {
    const r = parseConfig({}, { cwd });
    expect(vars(r.errors)).toEqual(['DATABASE_URL']);
    expect(r.config.database).toBeNull();
    expect(vars(parseConfig({ DATABASE_URL: 'mysql://db/modulus' }, { cwd }).errors)).toEqual(['DATABASE_URL']);
    expect(parse({ DATABASE_POOL_MAX: '25' }).config.database).toEqual({ url: DB, poolMax: 25 });
    expect(vars(parse({ DATABASE_POOL_MAX: '0' }).errors)).toEqual(['DATABASE_POOL_MAX']);
  });

  it('blank values count as unset', () => {
    const r = parse({ MODULUS_SEED: ' ', LOG_LEVEL: '', MODULUS_CLOCK: '' });
    expect(r.errors).toEqual([]);
    expect(r.config.seedExplicit).toBe(false);
    expect(r.config.clock).toBeNull();
  });

  it('invalid values are errors naming the variable, never its value; defaults are kept', () => {
    const r = parse({ MODULUS_SEED: 'sample', LOG_LEVEL: 'chatty', MODULUS_CLOCK: 'tomorrow', NEXT_PUBLIC_CODEX_URL: 'ftp://codex', MODULUS_SESSION_SECRET: 'short-secret' });
    expect(vars(r.errors).sort()).toEqual(['LOG_LEVEL', 'MODULUS_CLOCK', 'MODULUS_SEED', 'MODULUS_SESSION_SECRET', 'NEXT_PUBLIC_CODEX_URL']);
    expect(formatIssues(r.errors).join(' ')).not.toContain('short-secret');
    expect(r.config.seed).toBe('demo');
    expect(r.config.log.level).toBe('info');
  });

  it('a pinned clock, URLs without trailing slash', () => {
    expect(parse({ MODULUS_CLOCK: '2026-10-22' }).config.clock).toEqual({ kind: 'fixed', iso: '2026-10-22' });
    expect(parse({ MODULUS_CLOCK: 'real' }).config.clock).toEqual({ kind: 'real' });
    expect(parse({ NEXT_PUBLIC_KEYSTONE_URL: 'https://keystone.example/' }).errors).toEqual([]);
  });

  it('production: JSON logs, warnings for the sibling links and the implicit demo mode; a pinned clock is a warning', () => {
    const r = parse({ NODE_ENV: 'production', MODULUS_CLOCK: '2026-10-22' });
    expect(r.errors).toEqual([]);
    expect(r.config.log.format).toBe('json');
    expect(vars(r.warnings)).toEqual(['NEXT_PUBLIC_KEYSTONE_URL', 'NEXT_PUBLIC_CODEX_URL', 'NEXT_PUBLIC_VIGIE_URL', 'MODULUS_AUTH', 'MODULUS_CLOCK']);
  });

  it('production with the production data set refuses the demo mode', () => {
    expect(vars(parse({ NODE_ENV: 'production', MODULUS_SEED: 'production' }).errors)).toEqual(['MODULUS_AUTH']);
    expect(vars(parse({ NODE_ENV: 'production', MODULUS_SEED: 'production', MODULUS_AUTH: 'demo' }).errors)).toEqual(['MODULUS_AUTH']);
  });

  it('sign-in through Clavis needs its secret, the client and the rights read in Clavis', () => {
    expect(vars(parse({ MODULUS_AUTH: 'entra' }).errors)).toEqual([
      'MODULUS_SESSION_SECRET', 'ENTRA_CLIENT_ID', 'ENTRA_CLIENT_SECRET', 'ENTRA_REDIRECT_URI', 'ENTRA_ISSUER', 'MODULUS_ACCESS_FROM_CLAVIS',
    ]);
    const ok = parse({
      MODULUS_AUTH: 'entra', MODULUS_SESSION_SECRET: 'x'.repeat(40), ENTRA_ISSUER: 'https://clavis.example', ENTRA_CLIENT_ID: 'modulus',
      ENTRA_CLIENT_SECRET: 'secret-value', ENTRA_REDIRECT_URI: 'https://modulus.example/api/auth/callback', MODULUS_ACCESS_FROM_CLAVIS: 'on',
    });
    expect(ok.errors).toEqual([]);
    expect(ok.config.secrets).toEqual(expect.arrayContaining(['x'.repeat(40), 'secret-value']));
  });

  it('e-mails: none by default, file needs its folder (Graph or SMTP not offered yet)', () => {
    expect(parse({}).config.mail).toEqual({ transport: 'none', dir: null, from: 'modulus@groupe.example' });
    expect(vars(parse({ MODULUS_MAIL_TRANSPORT: 'file' }).errors)).toEqual(['MODULUS_MAIL_DIR']);
    expect(parse({ MODULUS_MAIL_TRANSPORT: 'file' }).config.mail.transport).toBe('none');
    expect(vars(parse({ MODULUS_MAIL_TRANSPORT: 'smtp' }).errors)).toEqual(['MODULUS_MAIL_TRANSPORT']);
    expect(vars(parse({ MODULUS_MAIL_FROM: 'nope' }).errors)).toEqual(['MODULUS_MAIL_FROM']);
    const file = parse({ MODULUS_MAIL_TRANSPORT: 'File', MODULUS_MAIL_DIR: 'mail', MODULUS_MAIL_FROM: 'it@demo.example' });
    expect(file.errors).toEqual([]);
    expect(file.config.mail).toEqual({ transport: 'file', dir: path.join(cwd, 'mail'), from: 'it@demo.example' });
    expect(vars(parse({ NODE_ENV: 'production', MODULUS_AUTH: 'demo', MODULUS_MAIL_TRANSPORT: 'file', MODULUS_MAIL_DIR: 'm' }).warnings)).toContain('MODULUS_MAIL_TRANSPORT');
  });

  it('redactUrl hides the password; every variable is known', () => {
    expect(redactUrl(DB)).toBe('postgres://modulus_app:***@db:5432/atrium');
    expect(redactUrl('nope')).toBe('[invalid URL]');
    expect(CONFIG_VARIABLES).toContain('DATABASE_URL');
    expect(CONFIG_VARIABLES.some((v) => v.startsWith('KEYSTONE_'))).toBe(false);
  });
});

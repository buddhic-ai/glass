/*
 Prepares a bundled whisper-cpp binary for packaging.
 - On macOS: builds whisper.cpp (universal if possible) and places binary in project `bin/`.
 - Skips work if a suitable binary already exists in `bin/`.
*/

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0) return resolve();
            reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function fileExists(p) {
    try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; }
}

async function buildForArch(repoDir, arch, outPath) {
    const cpus = String(Math.max(2, require('os').cpus().length - 1));
    const buildDir = `build-${arch}`;
    const cmakeArch = arch === 'x64' ? 'x86_64' : 'arm64';

    console.log(`[prepare-whisper] Building whisper-cli for ${arch}...`);
    await run('cmake', [
        '-S', '.',
        '-B', buildDir,
        '-DCMAKE_BUILD_TYPE=Release',
        `-DCMAKE_OSX_ARCHITECTURES=${cmakeArch}`,
        '-DGGML_METAL=1',
        '-DGGML_NATIVE=OFF'
    ], { cwd: repoDir });
    await run('cmake', ['--build', buildDir, '--config', 'Release', '--target', 'whisper-cli', '-j', cpus], { cwd: repoDir });

    const built = path.join(repoDir, buildDir, 'bin', 'whisper-cli');
    ensureDir(path.dirname(outPath));
    fs.copyFileSync(built, outPath);
    fs.chmodSync(outPath, 0o755);
    console.log(`[prepare-whisper] ${arch} whisper-cli ready: ${outPath}`);
}

async function prepareMacOS(targetRoot) {
    const root = path.resolve(__dirname, '..');
    const cacheDir = path.join(root, '.cache');
    const repoDir = path.join(cacheDir, 'whisper.cpp');

    ensureDir(cacheDir);

    if (!fs.existsSync(repoDir)) {
        console.log('[prepare-whisper] Cloning whisper.cpp...');
        await run('git', ['clone', '--depth', '1', 'https://github.com/ggml-org/whisper.cpp.git', repoDir]);
    } else {
        console.log('[prepare-whisper] Updating whisper.cpp...');
        await run('git', ['fetch', '--depth', '1', 'origin'], { cwd: repoDir });
        await run('git', ['reset', '--hard', 'origin/master'], { cwd: repoDir });
    }

    // Build both architectures so universal packaging can lipo them
    await buildForArch(repoDir, 'arm64', path.join(targetRoot, 'arm64', 'whisper-cli'));
    await buildForArch(repoDir, 'x64', path.join(targetRoot, 'x64', 'whisper-cli'));
}

async function main() {
    const platform = process.platform;
    const root = path.resolve(__dirname, '..');
    const binDir = path.join(root, 'bin');
    ensureDir(binDir);

    if (platform === 'darwin') {
        const haveArm = fileExists(path.join(binDir, 'arm64', 'whisper-cli'));
        const haveX64 = fileExists(path.join(binDir, 'x64', 'whisper-cli'));
        if (haveArm && haveX64) {
            console.log('[prepare-whisper] Binaries already present for arm64 and x64.');
            return;
        }
        await prepareMacOS(binDir);
        return;
    }

    console.log(`[prepare-whisper] Skipping build for unsupported platform: ${platform}. Place the binary at ${targetPath} if needed.`);
}

main().catch(err => {
    console.error('[prepare-whisper] Error:', err);
    process.exit(1);
});



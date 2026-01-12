import * as chokidar from 'chokidar';
import * as Color from 'color';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import template from './template';

/**
 * Returns the platform-appropriate cache directory for wallflow.
 * Checks multiple paths in order of preference:
 * 1. Wallflow cache paths (XDG_CACHE_HOME, platform defaults)
 * 2. macOS Application Support (for macOS app users)
 * 3. Pywal cache path (fallback for free CLI users)
 */
function getWallflowCachePath(): string {
	const home = os.homedir();
	const platform = os.platform();

	// Build list of paths to try in order of preference
	const pathsToTry: string[] = [];

	// 1. XDG_CACHE_HOME if explicitly set (works cross-platform)
	if (process.env.XDG_CACHE_HOME) {
		pathsToTry.push(path.join(process.env.XDG_CACHE_HOME, 'mksg', 'wallflow'));
	}

	// 2. Platform-specific wallflow cache paths
	if (platform === 'darwin') {
		// macOS: Try Library/Caches first, then Application Support
		pathsToTry.push(path.join(home, 'Library', 'Caches', 'mksg', 'wallflow'));
		pathsToTry.push(path.join(home, 'Library', 'Application Support', 'wallflow'));
	} else if (platform === 'win32') {
		const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
		pathsToTry.push(path.join(localAppData, 'mksg', 'wallflow'));
	} else {
		// Linux and others: XDG default
		pathsToTry.push(path.join(home, '.cache', 'mksg', 'wallflow'));
	}

	// 3. Pywal fallback path (for users of free wallflow CLI with pywal)
	const pywalPath = path.join(home, '.cache', 'wal');
	pathsToTry.push(pywalPath);

	// Find the first path that exists
	for (const cachePath of pathsToTry) {
		if (fs.existsSync(cachePath)) {
			return cachePath;
		}
	}

	// If none exist, return the first wallflow path (will be created when wallflow runs)
	// This prefers wallflow over pywal for new installations
	return pathsToTry[0];
}

// Wallflow cache path (platform-appropriate)
const wallflowCachePath = getWallflowCachePath();
const wallflowColorsPath = path.join(wallflowCachePath, 'colors');
const wallflowColorsJsonPath = path.join(wallflowCachePath, 'colors.json');
let autoUpdateWatcher: chokidar.FSWatcher | null = null;


export function activate(context: vscode.ExtensionContext) {

	// Register the update command
	let disposable = vscode.commands.registerCommand('wallflowTheme.update', generateColorThemes);
	context.subscriptions.push(disposable);

	// Start the auto update if enabled
	if(vscode.workspace.getConfiguration().get('wallflowTheme.autoUpdate')) {
		/*
		 * Update theme at startup
		 * Needed for when wallflow palette updates while vscode isn't running.
		 * The timeout is required to overcome a limitation of vscode which
		 * breaks the theme auto-update if updated too early at startup.
		 */
		setTimeout(generateColorThemes, 10000);

		autoUpdateWatcher = autoUpdate();
	}

	// Toggle the auto update in real time when changing the extension configuration
	vscode.workspace.onDidChangeConfiguration(event => {
		if(event.affectsConfiguration('wallflowTheme.autoUpdate')) {
			if(vscode.workspace.getConfiguration().get('wallflowTheme.autoUpdate')) {
				if(autoUpdateWatcher === null) {
					autoUpdateWatcher = autoUpdate();
				}
			}
			else if(autoUpdateWatcher !== null) {
				autoUpdateWatcher.close();
				autoUpdateWatcher = null;
			}
		}
	});

}

export function deactivate() {

	// Close the watcher if active
	if(autoUpdateWatcher !== null) {
		autoUpdateWatcher.close();
	}

}


/**
 * Generates the theme from the current color palette and overwrites the last one
 */
function generateColorThemes() {
	// Import colors from wallflow cache
	let colors: Color[] | undefined;
	try {
		colors = fs.readFileSync(wallflowColorsPath)
										 .toString()
										 .split(/\s+/, 16)
			.map(hex => Color(hex));

		if (fs.existsSync(wallflowColorsJsonPath)) {
			type WallflowJson = {
				special: {
					background: string,
					foreground: string
				}
			};

			let colorsJson: WallflowJson;
			const colorsRaw = fs.readFileSync(wallflowColorsJsonPath).toString();

			try {
				colorsJson = JSON.parse(colorsRaw);
			} catch {
				// The wallpaper path on Windows can cause JSON.parse errors since the
				// path isn't properly escaped.
				colorsJson = JSON.parse(colorsRaw
					.split('\n')
					.filter((line) => !line.includes('wallpaper'))
					.join('\n'));
			}

			colors[0] = Color(colorsJson?.special?.background);
			colors[7] = Color(colorsJson?.special?.foreground);
		}
	} catch(error) {
		// Not a complete failure if we have colors from the colors file, but failed to load from colors.json
		if (colors === undefined || colors.length === 0) {
			vscode.window.showErrorMessage('Couldn\'t load colors from wallflow cache. Make sure wallflow is running.');
			return;
		}

		vscode.window.showWarningMessage('Couldn\'t load all colors from wallflow cache');
	}

	// Generate the normal theme
	const colorTheme = template(colors, false);
	fs.writeFileSync(path.join(__dirname,'..', 'themes', 'wallflow.json'), JSON.stringify(colorTheme, null, 4));

	// Generate the bordered theme
	const colorThemeBordered = template(colors, true);
	fs.writeFileSync(path.join(__dirname,'..', 'themes', 'wallflow-bordered.json'), JSON.stringify(colorThemeBordered, null, 4));
}

/**
 * Automatically updates the theme when the color palette changes
 * @returns The watcher for the color palette
 */
function autoUpdate(): chokidar.FSWatcher {
	// Watch for changes in the color palette from wallflow
	return chokidar
		.watch(wallflowCachePath)
		.on('change', generateColorThemes);
}

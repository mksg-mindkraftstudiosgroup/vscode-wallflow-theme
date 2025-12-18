import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as chokidar from 'chokidar';
import * as Color from 'color';
import template from './template';

// Wallflow cache path (changed from pywal's ~/.cache/wal)
const wallflowCachePath = path.join(os.homedir(), '.cache', 'wallflow');
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

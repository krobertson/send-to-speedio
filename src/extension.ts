import * as vscode from 'vscode';

import * as path from 'path';
import * as util from 'util';
import * as net from 'net';

export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.commands.registerCommand('send-to-speedio.send', () => {
		const editor = vscode.window.activeTextEditor;

		if (editor) {
			let document = editor.document;
			let [filename, validationError] = validateFilename(document.fileName);
			const documentText = document.getText();

			// Show error if filename validation failed.
			if (validationError !== undefined) {
				vscode.window.showErrorMessage(`Unable to send file: ${validationError}`);
				return;
			}

			// Generate header, footer, and checksums
			const crlf = getCrlf();
			let header = `CSAV    ${filename.padEnd(8, " ")}  ${crlf}`;
			let checksum = calcChecksum(header + documentText + crlf);
			let footer = crlf + checksum.toString(16).padStart(2, "0") + "%";

			// Add the leading % to the header. It is excluded from checksum calculations.
			header = "%" + header;

			// Show the progress report.
			vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					cancellable: true
				},
				async (progress, token) => {
					progress.report({ message: `Sending file ${filename} to your Speedio...` });

					// send and handle result
					let result = await sendFile(header + documentText + footer, token);
					switch (result) {
						case 0:
							// success, just return
							return;
						case 5:
							vscode.window.showErrorMessage("Failed to send file. Machine is in edit or operation mode. Error code: 05");
							break;
						case 9:
							vscode.window.showErrorMessage("Failed to send file. Error code: 09");
							break;
						case -1:
							vscode.window.showErrorMessage("Failed to send file. Failed to connect or networking issue.");
							break;
						case -2:
							vscode.window.showErrorMessage("Failed to send file. User cancelled.");
							break;
						default:
							vscode.window.showErrorMessage(`Failed to send file. Error code: ${result.toString().padStart(2, "0")}`);
					}
				}
			);
		}
	});

	context.subscriptions.push(disposable);
}

// sendFile wraps the networking calls to transmit the command and file to the
// machine.
async function sendFile(data: string, token: vscode.CancellationToken): Promise<number> {
	let configuration = vscode.workspace.getConfiguration();
	let address = configuration.get<string>('send-to-speedio.ipAddress');
	let port = configuration.get<number>('send-to-speedio.port') || 10000;

	return new Promise<number>((resolve) => {
		console.log(`Connecting to ${address}:${port}`);
		let socket = net.connect(port, address, () => {
			console.log('Sending data');
			socket.write(data);
		});
		socket.setTimeout(5000);

		token.onCancellationRequested(() => {
			socket.destroy();
			resolve(-2);
		});

		socket.on('data', (data) => {
			console.log(`Received: ${util.inspect(data.toString())}`);
			socket.destroy();
			resolve(parseResponse(data.toString()));
		});

		socket.on('timeout', () => {
			console.log('Connection timeout');
			resolve(-1);
		});

		socket.on("error", (error: Error) => {
			console.log(error);
			resolve(-1);
		});
	});
}

// parseResponse handles parsing the response from the machine and returning the
// result code. If it is unable to parse it, it will return -1.
function parseResponse(response: string): number {
	let m = response.match(/(\d\d)\r?\n/);
	if (m !== null && m[1] !== null) {
		return +m[1];
	}
	return -1;
}

// validateFilename performs various checks to ensure we're sending an NC
// program, the right format, right length, and scopes the full path down to
// just the base part of the filename.
function validateFilename(filename: string): [string, string?] {
	let p = path.parse(filename);

	if (p.ext.toUpperCase() !== ".NC") {
		return [p.name, "Invalid extension"];
	}

	if (p.name.match(/^O\d+/) === null) {
		return [p.name, "Filename does not match expected format"];
	}

	if (p.name.length > 8) {
		return [p.name, "Filename is too long"];
	}

	return [p.name, undefined];
}

// calcChecksum generates the checksum byte to be passed within the footer of
// the request. It sums up all of the bytes and then returns the remainder.
function calcChecksum(data: string): number {
	let sum = 0;

	for (var i = 0; i < data.length; i++) {
		sum += data.charCodeAt(i);
	}

	return sum & 0xff;
}

// getCrlf checks whether the configuration is set to an A00 controller, which
// simply uses LF, or B00/C00 which use CRLF.
function getCrlf(): string {
	switch (vscode.workspace.getConfiguration().get("send-to-speedio.controller")) {
		case "A00":
			return "\n";
		default:
			return "\r\n";
	}
}

export function deactivate() { }

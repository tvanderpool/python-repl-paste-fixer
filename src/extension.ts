'use strict';
import * as vscode from 'vscode';

const EndChar = [':', '(', '[', '{'];

const pasteFixed = () => {
    let editor = vscode.window.activeTextEditor;
    if (editor === undefined) return;
    let fixer = new Fixer(editor);
    
    vscode.env.clipboard.readText().then((s) => {
        let sep = (s.indexOf('\r\n') != -1) ? '\r\n' : '\n';

        let lines = s.split(sep); 
        if( lines.length == 0 ){
            doClipboardPaste();
            return;
        }
        lines = fixer.removePrefixes(lines);
        lines = fixer.fixIndent(lines);

        if( lines.length == 0 ) 
            doClipboardPaste();
        else
            vscode.env.clipboard.writeText(lines.join(sep)).then(doClipboardPaste);
    });
}
const doClipboardPaste = () => vscode.commands.executeCommand('editor.action.clipboardPasteAction');

const isNumPrefix = (prefix: string): boolean => {
    const num = Number(prefix.trim());
    return !isNaN(num) &&
            prefix === num.toString().padStart(3, ' ')+' ';
}

class Fixer{
    baseIndent: number;
    insertSpaces: boolean;
    tabSize: number;
    blank: string;

    constructor(editor: vscode.TextEditor){
        this.baseIndent = editor.selection.start.character;
        this.insertSpaces = Boolean(editor.options.insertSpaces);
        this.tabSize = Number(editor.options.tabSize);
        this.blank = this.insertSpaces ? ' '.repeat(this.tabSize) : '\t';
    }

    removePrefixes(lines: string[]): string[] {
        var lastWasNum = false;
        var lastIndent = -1;
        lines = lines.map(line => {
            // Check if the line has a prefix
            const prefix = line.slice(0, 4);
            const _isNumPrefix = isNumPrefix(prefix);
            const hasPromptPrefix = _isNumPrefix || prefix === '>>> ' || prefix === '... ';
            
            if (hasPromptPrefix) {
                // Remove the prefix
                line = line.slice(4);
            }
            
            // Detect wrapped lines for numbered prefixes
            if( lastWasNum && !_isNumPrefix ){
                line = '\r' + line;
            }
            
            // Detect wrapped lines for non-numbered '... ' prefixes
            // If previous line had '... ' with indentation, and current line has '... ' with much less indentation,
            // it's likely a wrapped line continuation
            if (!_isNumPrefix && prefix === '... ' && lastIndent >= 0) {
                const currentIndent = line.search(/\S/);
                // If current line has significantly less indentation (or is at column 0), it's a wrap
                if (currentIndent === 0 || (currentIndent >= 0 && currentIndent < lastIndent - 4)) {
                    line = '\r' + line;
                }
            }
            
            // Track indentation of '... ' lines for wrap detection
            if (prefix === '... ') {
                lastIndent = line.search(/\S/);
                if (lastIndent === -1) lastIndent = 0; // Empty line
            } else if (prefix === '>>> ' || _isNumPrefix) {
                lastIndent = -1; // Reset for new statements
            }
            
            lastWasNum = _isNumPrefix;
            return line;
        });
        const joined = lines.join('\n');
        return joined.includes('\n\r')
           ? joined.replace(/\n\r/g, '').split('\n')
           : lines;
    }

    fixIndent(lines: string[]): string[]{
        let nonEmptyCnt = 0,
            secondNotEmptyLine = -1,
            indentForSecondNotEmptyLine = -1;
        
        for (var i = 0; i < lines.length; ++i) {
            if (lines[i].trim() != '') {
                ++nonEmptyCnt;
                if (i != 0 && secondNotEmptyLine == -1 && indentForSecondNotEmptyLine == -1) {
                    secondNotEmptyLine = i;
                    indentForSecondNotEmptyLine = lines[i].search(/\S/);
                }
            }
            if (nonEmptyCnt > 1) break;
        }

        if (nonEmptyCnt <= 1)  return [];
        console.log('lines[0]:', lines[0]);
        console.log('EndChar:', EndChar);
        let blockIndent = !lines[0] || EndChar.find(ch => lines[0].endsWith(ch)) == undefined
            ? 0 : (this.insertSpaces) ? this.tabSize : 1;

        let diff = this.baseIndent + blockIndent - indentForSecondNotEmptyLine;
        if (diff != 0) {
            for (let i = secondNotEmptyLine; i < lines.length; ++i) {
                if (lines[i].trim() == '')
                    continue;
                if (diff < 0)
                    lines[i] = lines[i].substring(-diff);
                else if (diff > 0)
                    lines[i] = this.blank.repeat(diff) + lines[i];
            }
        }
        return lines;
    }

}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.commands.registerCommand(
        'pyReplPasteFixer.pasteFixed', pasteFixed));
}

export function deactivate() {
}

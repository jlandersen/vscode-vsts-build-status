import * as vscode from 'vscode';
import {VstsBuildStatus, VstsRestClientFactoryImplementation} from './vstsbuildstatus'

export function activate(context: vscode.ExtensionContext) {
    var buildServiceStatus = new VstsBuildStatus(new VstsRestClientFactoryImplementation(), context.workspaceState);
           
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildSelection', () => buildServiceStatus.openBuildDefinitionSelection()));
}   
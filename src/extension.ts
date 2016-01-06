import * as vscode from 'vscode';
import {VstsBuildStatus, VstsBuildRestClientFactoryImpl} from './vstsbuildstatus'

export function activate(context: vscode.ExtensionContext) {
    var buildServiceStatus = new VstsBuildStatus(new VstsBuildRestClientFactoryImpl(), context.workspaceState);
           
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildSelection', () => buildServiceStatus.openBuildDefinitionSelection()));
}   
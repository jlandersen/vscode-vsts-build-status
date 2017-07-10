"use strict";

import * as vscode from 'vscode';
import {WorkspaceVstsSettings} from './settings'
import {VstsBuildStatus} from './vstsbuildstatus'
import {VstsBuildRestClientImpl} from './vstsbuildrestclient'

export function activate(context: vscode.ExtensionContext) {
    let settings = new WorkspaceVstsSettings(context.workspaceState);
    let buildServiceStatus = new VstsBuildStatus(settings, new VstsBuildRestClientImpl(settings));
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildDefinitionSelection', () => buildServiceStatus.openBuildDefinitionSelection()));
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildWebSelection', () => buildServiceStatus.openBuildWebSelection()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildLogSelection', () => buildServiceStatus.openBuildLogSelection()));
        
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsQueueBuildSelection', () => buildServiceStatus.openQueueBuildSelection()));
}   
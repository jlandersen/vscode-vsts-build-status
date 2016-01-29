"use strict";

import * as vscode from 'vscode';
import {WorkspaceVstsSettings} from './settings'
import {VstsBuildStatus} from './vstsbuildstatus'
import {VstsBuildRestClientFactoryImpl} from './vstsbuildrestclient'

export function activate(context: vscode.ExtensionContext) {
    var buildServiceStatus = new VstsBuildStatus(new WorkspaceVstsSettings(context.workspaceState), new VstsBuildRestClientFactoryImpl());
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildDefinitionSelection', () => buildServiceStatus.openBuildDefinitionSelection()));
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildLogSelection', () => buildServiceStatus.openBuildLogSelection()));
        
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsQueueBuildSelection', () => buildServiceStatus.openQueueBuildSelection()));
}   
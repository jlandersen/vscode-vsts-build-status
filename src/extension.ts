"use strict";

import * as vscode from "vscode";
import {WorkspaceVstsSettings} from "./settings";
import {VstsBuildStatus} from "./vstsbuildstatus";
import {VstsBuildRestClientImpl} from "./vstsbuildrestclient";
import OpenBuildInBrowserCommand from "./commands/OpenBuildInBrowserCommand";
import OpenBuildLogCommand from "./commands/OpenBuildLogCommand";

export function activate(context: vscode.ExtensionContext) {
    let settings = new WorkspaceVstsSettings(context.workspaceState);
    let restClient = new VstsBuildRestClientImpl(settings);
    let buildServiceStatus = new VstsBuildStatus(settings, restClient);

    let openBuildInBrowserCommand = new OpenBuildInBrowserCommand(settings, restClient);
    let openBuildLogCommand = new OpenBuildLogCommand(settings, restClient);
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildDefinitionSelection', () => buildServiceStatus.openBuildDefinitionSelection()));
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildWebSelection', () => openBuildInBrowserCommand.execute()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildLogSelection', () => openBuildLogCommand.execute()));
        
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsQueueBuildSelection', () => buildServiceStatus.openQueueBuildSelection()));
}   
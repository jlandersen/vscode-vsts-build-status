"use strict";

import * as vscode from "vscode";
import {createDefaultSettings} from "./settings";
import {VstsBuildStatus} from "./vstsbuildstatus";
import {VstsBuildRestClientImpl} from "./vstsbuildrestclient";
import OpenBuildInBrowserCommand from "./commands/OpenBuildInBrowserCommand";
import OpenBuildLogCommand from "./commands/OpenBuildLogCommand";
import QueueBuildCommand from "./commands/QueueBuildCommand";
import SelectBuildDefinitionCommand from "./commands/SelectBuildDefinitionCommand";

export function activate(context: vscode.ExtensionContext) {
    let settings = createDefaultSettings(context.workspaceState);
    let restClient = new VstsBuildRestClientImpl(settings);
    let buildServiceStatus = new VstsBuildStatus(settings, restClient);

    let openBuildInBrowserCommand = new OpenBuildInBrowserCommand(settings, restClient);
    let openBuildLogCommand = new OpenBuildLogCommand(settings, restClient);
    let queueBuildCommand = new QueueBuildCommand(settings, restClient);
    let selectBuildDefinitionCommand = new SelectBuildDefinitionCommand(settings, restClient);
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildDefinitionSelection', () => selectBuildDefinitionCommand.execute()));
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildWebSelection', () => openBuildInBrowserCommand.execute()));

    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildLogSelection', () => openBuildLogCommand.execute()));
        
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsQueueBuildSelection', () => queueBuildCommand.execute()));
}   
"use strict";

import * as vscode from 'vscode';
import {WorkspaceVstsSettings} from './settings'
import {VstsBuildStatus} from './vstsbuildstatus'
import {VstsBuildRestClientFactoryImpl} from './vstsbuildrestclient'

export function activate(context: vscode.ExtensionContext) {
    var buildServiceStatus = new VstsBuildStatus(new WorkspaceVstsSettings(context.workspaceState), new VstsBuildRestClientFactoryImpl());
    
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.openVstsBuildSelection', () => buildServiceStatus.openBuildDefinitionSelection()));
}   
"use strict";

import {window, StatusBarItem, StatusBarAlignment, Disposable} from "vscode"

export class VstsBuildStatusBar {
    private statusBarItem: StatusBarItem;

    public displaySuccess(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-check", "extension.openVstsBuildDefinitionSelection");
    }

    public displayLoading(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-sync", "extension.openVstsBuildDefinitionSelection");
    }

    public displayError(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-alert", "extension.openVstsBuildDefinitionSelection");
    }

    public displayInformation(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "", "extension.openVstsBuildSelection");
    }

    public displayNoBuilds(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-clock", "extension.openVstsBuildDefinitionSelection");
    }

    public displayConnectivityError(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-zap", "extension.openVstsBuildDefinitionSelection");
    }

    public hideStatusBarItem() {
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
    }

    private displayStatusBarItem(text: string, tooltip: string, icon: string, command: string) {
        if (!this.statusBarItem) {
            this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        }

        if (icon) {
            this.statusBarItem.text = `VSTS Build: ${text} $(icon ${icon})`;
        } else {
            this.statusBarItem.text = `VSTS Build: ${text}`;
        }

        this.statusBarItem.tooltip = tooltip;
        this.statusBarItem.command = command;
        this.statusBarItem.show();
    }
}

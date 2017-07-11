"use strict";

import {window, StatusBarItem, StatusBarAlignment, Disposable} from "vscode"

export class StatusBar {
    private statusBarItem: StatusBarItem;

    public displaySuccess(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-check");
    }

    public displayLoading(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-sync");
    }

    public displayError(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-alert");
    }

    public displayInformation(text: string, tooltip?: string): void {
        this.displayStatusBarItem(text, tooltip);
    }

    public displayNoBuilds(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-clock");
    }

    public displayConnectivityError(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, "octicon-zap");
    }

    public hideStatusBarItem() {
        if (this.statusBarItem) {
            this.statusBarItem.hide();
        }
    }

    public dispose() {
        this.statusBarItem.dispose();
    }

    private displayStatusBarItem(text: string, tooltip: string, icon?: string) {
        if (!this.statusBarItem) {
            this.statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left);
        }

        if (icon) {
            this.statusBarItem.text = `VSTS Build: ${text} $(icon ${icon})`;
        } else {
            this.statusBarItem.text = `VSTS Build: ${text}`;
        }

        if (tooltip) {
            this.statusBarItem.tooltip = tooltip;
        }
        this.statusBarItem.command = 'extension.openVstsBuildDefinitionSelection';
        this.statusBarItem.show();
    }
}

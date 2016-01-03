import {window, StatusBarItem, StatusBarAlignment} from 'vscode'

export class VstsBuildStatusBar {
    private statusBarItem: StatusBarItem;
    
    public displaySuccess(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-check', 'extension.openVstsBuildStatus');
    }

    public displayLoading(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-sync', 'extension.openVstsBuildStatus');
    }

    public displayError(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-alert', 'extension.openVstsBuildStatus');
    }

    public displayInformation(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, '', 'extension.openVstsBuildStatus');
    }

    public displayNoBuilds(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-clock', 'extension.openVstsBuildStatus');
    }

    public displayConnectivityError(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-zap', 'extension.openVstsBuildStatus');
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
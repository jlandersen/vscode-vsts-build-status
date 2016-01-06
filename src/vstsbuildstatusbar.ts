import {window, StatusBarItem, StatusBarAlignment} from 'vscode'

export class VstsBuildStatusBar {
    private statusBarItem: StatusBarItem;
    
    public displaySuccess(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-check', 'extension.openVstsBuildSelection');
    }

    public displayLoading(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-sync', 'extension.openVstsBuildSelection');
    }

    public displayError(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-alert', 'extension.openVstsBuildSelection');
    }

    public displayInformation(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, '', 'extension.openVstsBuildSelection');
    }

    public displayNoBuilds(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-clock', 'extension.openVstsBuildSelection');
    }

    public displayConnectivityError(text: string, tooltip: string): void {
        this.displayStatusBarItem(text, tooltip, 'octicon-zap', 'extension.openVstsBuildSelection');
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

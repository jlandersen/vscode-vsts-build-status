
import {window, commands, Memento, workspace, extensions, WorkspaceConfiguration, WorkspaceEdit, QuickPickItem, StatusBarAlignment, StatusBarItem} from 'vscode';
import {Settings} from './settings';
import * as rest from 'node-rest-client';
import fs = require('fs')

interface BuildDefinition {
    id: number;
    name: string;
    revision: number;
}

interface BuildResult {
    result: string;
    reason: string;
    startTime: string;
}

interface BuildDefinitionQuickPickItem {
    id: number;
    label: string;
    description: string;
    definition: BuildDefinition;
}

interface VstsRestClientFactory {
    createBuildRestClient(settings: Settings): VstsBuildRestClient;
}

export class VstsRestClientFactoryImplementation implements VstsRestClientFactory {
    public createBuildRestClient(settings: Settings): VstsBuildRestClient {
        return new VstsBuildRestClientImplementation(settings);
    }
}

interface VstsBuildRestClient {
    getLatestBuild(definition: BuildDefinition, callback: ((response: BuildResult, statusCode: number) => any)): void;
    getBuildDefinitions(callback: ((response: BuildDefinition[], statusCode) => any)): void;
    onError(handler: (error: any) => any): void;
}

export class VstsBuildRestClientImplementation implements VstsBuildRestClient {
    private client: any;
    private settings: Settings;
    private errorHandler: (error: any) => any;
    
    constructor(settings: Settings) {
        this.settings = settings;
        this.client = new rest.Client();
    }

    public getLatestBuild(definition: BuildDefinition, success: ((response: BuildResult, statusCode: number) => any)): void {
        this.client.get(
            `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds?definitions=${definition.id}&$top=1&api-version=2.0`,
            this.getRequestArgs(),
            (data, response) => {
                var result: BuildResult;

                try {
                    result = JSON.parse(data).value[0];
                } catch (e) {
                    result = null;
                }

                success(result, response.statusCode);
            }).on("error", error => {
                this.errorHandler(error);
            });
    }

    public getBuildDefinitions(success: ((response: BuildDefinition[], statusCode) => any)): void {
        this.client.get(
            `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/definitions?api-version=2.0`,
            this.getRequestArgs(),
            (data, response) => {
                var result: BuildDefinition[];

                try {
                    result = JSON.parse(data).value;
                } catch (e) {
                    result = null;
                }

                success(result, response.statusCode);
            }).on("error", error => {
                this.errorHandler(error);
            });
    }

     public onError(handler: (error: any) => any): void {
        this.errorHandler = handler;
     }
   
    private getRequestArgs(): { headers: { Authorization: string} } {
        var authHeader = `Basic ${new Buffer(`${this.settings.username}:${this.settings.password}`).toString("base64")}`;

        return {
            headers: { Authorization: authHeader }
        }
    }
}

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

export class VstsBuildStatus {
    private statusBar: VstsBuildStatusBar;
    private activeDefinition: BuildDefinition;
    private settings: Settings;
    private intervalId: number;
    private restClient: VstsBuildRestClient;
    private restClientFactory: VstsRestClientFactory;
    private state: Memento;

    constructor(restClientFactory: VstsRestClientFactory, state: Memento) {
        this.statusBar = new VstsBuildStatusBar();
        this.restClientFactory = restClientFactory;
        this.state = state;
        
        var definition = state.get<BuildDefinition>("vsts.active.definition");
        if (definition) {
            this.activeDefinition = definition;
        }
        
        // If settings change, build status is start over again 
        // resulting in new settings being loaded.
        workspace.onDidChangeConfiguration(e => {
            this.beginBuildStatusUpdates();
        });

        this.beginBuildStatusUpdates();
    }

    private beginBuildStatusUpdates() {
        this.tryCancelPeriodicStatusUpdate();
        this.settings = Settings.createFromWorkspaceConfiguration(workspace.getConfiguration("vsts"));
        this.restClient = this.restClientFactory.createBuildRestClient(this.settings);
        this.restClient.onError(error => {
             this.showConnectionErrorMessage();
             this.tryCancelPeriodicStatusUpdate();
        });
        
        this.updateStatus();
    }

    public updateStatus(): void {
        // Updates the status bar item depending on the state. 
        // If everything goes well, the method is called periodically.
        
        if (!this.settings.isValid()) {
            this.tryCancelPeriodicStatusUpdate();
            this.statusBar.hideStatusBarItem();

            return;
        }

        if (!this.activeDefinition) {
            this.statusBar.displayInformation('Select build definition', '');
            
            return;
        }
        
        this.restClient.getLatestBuild(this.activeDefinition, (response, statusCode) => {
            if (statusCode != 200) {
                this.showConnectionErrorMessage();
                this.tryCancelPeriodicStatusUpdate();

                return;
            }

            if (response == null) {
                this.statusBar.displayNoBuilds(this.activeDefinition.name, "No builds found");

                return;
            }

            if (response.result) {
                if (response.result == "succeeded") {
                    this.statusBar.displaySuccess(this.activeDefinition.name, 'Last build was completed successfully');
                } else {
                    this.statusBar.displayError(this.activeDefinition.name, 'Last build failed');
                }
            } else {
                this.statusBar.displayLoading(this.activeDefinition.name, 'Build in progress...');
            }
            
            this.tryStartPeriodicStatusUpdate();
        });
    }

    public openBuildDefinitionSelection(): void {
        this.restClient.getBuildDefinitions((response, statusCode) => {
            if (statusCode != 200) {
                this.showConnectionErrorMessage();
                
                return;
            }

            var buildDefinitions: BuildDefinitionQuickPickItem[] = response.map(function(definition) {
                return {
                    label: definition.name,
                    description: `Revision ${definition.revision}`,
                    id: definition.id,
                    definition: definition
                }
            });

            var options = {
                placeHolder: "Select a build definition to monitor"
            }

            window.showQuickPick(buildDefinitions, options).then(result => {
                if (result) {
                    this.activeDefinition = result.definition;
                    this.state.update("vsts.active.definition", this.activeDefinition);

                    console.log('selected ' + this.activeDefinition);

                    this.updateStatus();
                }

            });
        });
    }
    
    public dispose() {
        this.statusBar.dispose();
    }
    
    private showConnectionErrorMessage() {
        this.statusBar.displayConnectivityError("Unable to connect", "There was a problem trying to connect to your VSTS account");
        window.showErrorMessage(`Unable to connect to the VSTS account ${this.settings.account}`);
    }

    private tryStartPeriodicStatusUpdate() {
        if (!this.intervalId) {
            this.intervalId = setInterval(() => this.updateStatus(), 15000);
        }
    }

    private tryCancelPeriodicStatusUpdate() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}
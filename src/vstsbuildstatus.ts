
import {window, commands, Memento, workspace, extensions, WorkspaceConfiguration, WorkspaceEdit, QuickPickItem} from 'vscode';
import {Settings} from './settings';
import {VstsBuildStatusBar} from './vstsbuildstatusbar'
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
   
    private getRequestArgs(): any {
        var authHeader = `Basic ${new Buffer(`${this.settings.username}:${this.settings.password}`).toString("base64")}`;

        return {
            headers: { "Authorization": authHeader }
        }
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
        
        workspace.onDidChangeConfiguration(e => {
            this.startBuildService();
        });

        this.startBuildService();
    }

    private startBuildService() {
        this.tryCancelPeriodicStatusUpdate();
        this.settings = Settings.createFromWorkspaceConfiguration(workspace.getConfiguration("vsts"));
        this.restClient = this.restClientFactory.createBuildRestClient(this.settings);
        this.restClient.onError(error => {
             window.showErrorMessage(`Unable to connect to the VSTS account ${this.settings.account}`);
             this.statusBar.displayConnectivityError("Unable to connect", "There was a problem trying to connect to your VSTS account");
             
             this.tryCancelPeriodicStatusUpdate();
        });
        
        this.updateStatus();
    }

    public updateStatus(): void {
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
                this.statusBar.displayConnectivityError("Unable to connect", "There was a problem trying to connect to your VSTS account");
                window.showErrorMessage(`Unable to connect to the VSTS account ${this.settings.account}`);
                
                this.tryCancelPeriodicStatusUpdate

                return;
            }

            if (response == null) {
                this.statusBar.displayNoBuilds(this.activeDefinition.name, "No builds queued");

                return;
            }

            if (response) {
                if (response.result == "succeeded") {
                    this.statusBar.displaySuccess(this.activeDefinition.name, 'Last build was completed successfully');
                } else {
                    this.statusBar.displayError(this.activeDefinition.name, 'Last build failed');
                }
            } else {
                this.statusBar.displayLoading(this.activeDefinition.name, 'Build in progress...');
            }

        });

        this.tryStartPeriodicStatusUpdate();
    }

    public openBuildDefinitionSelection(): void {
        this.restClient.getBuildDefinitions((response, statusCode) => {
            if (statusCode != 200) {
                this.statusBar.displayConnectivityError("Unable to connect", "There was a problem trying to connect to your VSTS account");
                window.showErrorMessage(`Unable to connect to the VSTS account ${this.settings.account}`);

                return;
            }

            var items: BuildDefinitionQuickPickItem[] = response.map(function(definition) {
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

            window.showQuickPick(items, options).then(result => {
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
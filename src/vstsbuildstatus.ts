
import {window, commands, Memento, workspace, extensions, WorkspaceConfiguration, WorkspaceEdit, QuickPickItem } from 'vscode';
import {Settings} from './settings';
import {VstsBuildStatusBar} from './vstsbuildstatusbar'
import * as rest from 'node-rest-client';
import fs = require('fs')

interface BuildDefinition {
    id: number;
    name: string;
    revision: number;
}

interface Build {
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

interface VstsBuildRestClientFactory {
    createClient(settings: Settings): VstsBuildRestClient;
}

export class VstsBuildRestClientFactoryImpl implements VstsBuildRestClientFactory {
    public createClient(settings: Settings): VstsBuildRestClient {
        return new VstsBuildRestClientImplementation(settings);
    }
}

interface VstsBuildRestClient {
    getLatest(definition: BuildDefinition, callback: ((response: Build, statusCode: number) => any)): void;
    getDefinitions(callback: ((response: BuildDefinition[], statusCode) => any)): void;
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

    public getLatest(definition: BuildDefinition, success: ((response: Build, statusCode: number) => any)): void {
        this.client.get(
            `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds?definitions=${definition.id}&$top=1&api-version=2.0`,
            this.getRequestArgs(),
            (data, response) => {
                var result: Build;

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

    public getDefinitions(success: ((response: BuildDefinition[], statusCode) => any)): void {
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

export class VstsBuildStatus {
    private statusBar: VstsBuildStatusBar;
    private activeDefinition: BuildDefinition;
    private settings: Settings;
    private intervalId: number;
    private restClient: VstsBuildRestClient;
    private restClientFactory: VstsBuildRestClientFactory;
    private state: Memento;

    constructor(restClientFactory: VstsBuildRestClientFactory, state: Memento) {
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
        this.restClient = this.restClientFactory.createClient(this.settings);
        this.restClient.onError(error => {
             this.showConnectionErrorMessage();
             this.tryCancelPeriodicStatusUpdate();
        });
        
        this.updateStatus();
    }

    public updateStatus(): void {
        // Updates the status bar depending on the state. 
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
        
        this.restClient.getLatest(this.activeDefinition, (response, statusCode) => {
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
        this.restClient.getDefinitions((response, statusCode) => {
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
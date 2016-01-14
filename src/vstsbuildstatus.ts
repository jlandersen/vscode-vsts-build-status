"use strict";

import {window, QuickPickItem } from "vscode";
import fs = require("fs");
import {Settings} from "./settings";
import {VstsBuildStatusBar} from "./vstsbuildstatusbar";
import {Build, BuildDefinition, VstsBuildRestClient, VstsBuildRestClientFactory} from "./vstsbuildrestclient";

interface BuildDefinitionQuickPickItem {
    id: number;
    label: string;
    description: string;
    definition: BuildDefinition;
}

export class VstsBuildStatus {
    private updateIntervalInSeconds = 15;
    private statusBar: VstsBuildStatusBar;
    private activeDefinition: BuildDefinition;
    private settings: Settings;
    private intervalId: number;
    private restClient: VstsBuildRestClient;

    constructor(settings: Settings, restClientFactory: VstsBuildRestClientFactory) {
        this.settings = settings;
        this.statusBar = new VstsBuildStatusBar();
        this.restClient = restClientFactory.createClient(settings);
        this.activeDefinition = settings.activeBuildDefinition;

        this.settings.onDidChangeSettings = () => {
            this.beginBuildStatusUpdates();
        };

        this.beginBuildStatusUpdates();
    }

    private beginBuildStatusUpdates() {
        this.tryCancelPeriodicStatusUpdate();
        this.updateStatus();
    }

    public updateStatus() {
        // Updates the status bar depending on the state. 
        // If everything goes well, the method is set up to be called periodically.

        if (!this.settings.isValid()) {
            this.tryCancelPeriodicStatusUpdate();
            this.statusBar.hideStatusBarItem();

            return;
        }

        if (!this.activeDefinition) {
            this.statusBar.displayInformation("Select build definition", "");

            return;
        }

        this.restClient.getLatest(this.activeDefinition).then(
            response => {
                if (!response.value) {
                    this.statusBar.displayNoBuilds(this.activeDefinition.name, "No builds found");
                }

                if (response.value && response.value.result) {
                    if (response.value.result === "succeeded") {
                        this.statusBar.displaySuccess(this.activeDefinition.name, "Last build was completed successfully");
                    } else {
                        this.statusBar.displayError(this.activeDefinition.name, "Last build failed");
                    }
                } else if (response.value) {
                    this.statusBar.displayLoading(this.activeDefinition.name, "Build in progress...");
                }

                this.tryStartPeriodicStatusUpdate();
            }, error => {
                this.handleError();
            });
    }

    public openBuildDefinitionSelection(): void {
        this.getBuildDefinitionByQuickPick("Select a build definition to monitor").then(result => {
            if (result) {
                this.activeDefinition = result;
                this.settings.activeBuildDefinition = this.activeDefinition;
                this.updateStatus();
            }
        }, error => {
            this.handleError();
        });
    }

    public openBuildLogSelection(): void {
        this.getBuildDefinitionByQuickPick("Select a build definition").then(result => {
            if (!result) {
                return;
            }
        });
    }

    private getBuildDefinitionByQuickPick(placeHolder: string): Thenable<BuildDefinition> {
        return new Promise((resolve, reject) => {
            this.restClient.getDefinitions().then(response => {
                let buildDefinitions: BuildDefinitionQuickPickItem[] = response.value.map(function(definition) {
                    return {
                        label: definition.name,
                        description: `Revision ${definition.revision}`,
                        id: definition.id,
                        definition: definition
                    }
                });

                let options = {
                    placeHolder: placeHolder
                };

                window.showQuickPick(buildDefinitions, options).then(result => {
                    if (result) {
                        resolve(result.definition);
                    } else {
                        resolve(null);
                    }
                });
            }, error => {
                reject(error);
            });
        });
    }

    private handleError(): void {
        this.showConnectionErrorMessage();
        this.tryCancelPeriodicStatusUpdate();
    }

    private showConnectionErrorMessage(): void {
        this.statusBar.displayConnectivityError("Unable to connect", "There was a problem trying to connect to your VSTS account");
        window.showErrorMessage(`Unable to connect to the VSTS account ${this.settings.account}`);
    }

    private tryStartPeriodicStatusUpdate(): void {
        if (!this.intervalId) {
            this.intervalId = setInterval(() => this.updateStatus(), this.updateIntervalInSeconds * 1000);
        }
    }

    private tryCancelPeriodicStatusUpdate(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    public dispose() {
        this.statusBar.dispose();
        this.settings.dispose();
    }

}
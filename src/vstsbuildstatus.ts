"use strict";

import { window, OutputChannel, QuickPickItem } from "vscode";
import { Settings } from "./settings";
import { VstsBuildStatusBar } from "./vstsbuildstatusbar";
import { Build, BuildDefinition, VstsBuildRestClient, VstsBuildRestClientFactory } from "./vstsbuildrestclient";
import { VstsBuildLogStreamHandler } from "./vstsbuildlog";
import fs = require("fs");
import openurl = require("openurl");

interface BuildDefinitionQuickPickItem {
    id: number;
    label: string;
    description: string;
    definition: BuildDefinition;
}

interface BuildQuickPickItem {
    id: number;
    label: string;
    description: string;
    build: Build;
}

export class VstsBuildStatus {
    private updateIntervalInSeconds = 15;
    private statusBar: VstsBuildStatusBar;

    private activeDefinition: BuildDefinition;
    private settings: Settings;
    private intervalTimer: NodeJS.Timer;
    private restClient: VstsBuildRestClient;
    private logStreamHandler: VstsBuildLogStreamHandler;


    constructor(settings: Settings, restClientFactory: VstsBuildRestClientFactory) {
        this.settings = settings;
        this.statusBar = new VstsBuildStatusBar();
        this.restClient = restClientFactory.createClient(settings);
        this.activeDefinition = settings.activeBuildDefinition;
        this.logStreamHandler = new VstsBuildLogStreamHandler(this.restClient);

        this.settings.onDidChangeSettings(() => {
            this.beginBuildStatusUpdates();
        });

        this.beginBuildStatusUpdates();
    }

    private beginBuildStatusUpdates() {
        this.tryCancelPeriodicStatusUpdate();
        this.updateStatus();
    }

    public updateStatus(): void {
        // Updates the status bar depending on the state. 
        // If everything goes well, the method ißs set up to be called periodically.

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

    public openBuildWebSelection(): void {
        this.getBuildDefinitionByQuickPick("Select a build definition").then(result => {
            if (!result) {
                return;
            }

            return this.getBuildByQuickPick(result, "Select a build to open");
        }).then(build => {
            if (!build) {
                return;
            }

            openurl.open(build._links.web.href);
        });
    }

    public openBuildLogSelection(): void {
        this.getBuildDefinitionByQuickPick("Select a build definition").then(result => {
            if (!result) {
                return;
            }

            return this.getBuildByQuickPick(result, "Select a build to view");
        }).then(build => {
            if (!build) {
                return;
            }

            this.logStreamHandler.streamLogs(build);
        }, error => {
            this.handleError();
        });
    }

    public openQueueBuildSelection(): void {
        this.getBuildDefinitionByQuickPick("Select a build definition").then(result => {
            if (!result) {
                return Promise.reject(null);
            }

            return this.restClient.queueBuild(result);
        }).then(result => {
            window.showInformationMessage(`Build has been queued for ${result.value.definition.name}`);
        }, error => {
            if(error) {
                this.handleError();
            }
            // Otherwise has been cancelled by the user
        });
    }

    private getBuildDefinitionByQuickPick(placeHolder: string): Thenable<BuildDefinition> {
        if (!this.settings.isValid()) {
            this.showSettingsMissingMessage();

            return Promise.resolve(null);
        }

        return new Promise((resolve, reject) => {
            this.restClient.getDefinitions().then(response => {
                let buildDefinitions: BuildDefinitionQuickPickItem[] = response.value.map(function (definition) {
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

    private getBuildByQuickPick(definition: BuildDefinition, placeHolder: string): Thenable<Build> {
        return this.restClient.getBuilds(definition, 10).then(builds => {
            let buildQuickPickItems: BuildQuickPickItem[] = builds.value.map(build => {
                return {
                    label: new Date(build.queueTime).toLocaleString(),
                    description: build.result,
                    id: build.id,
                    build: build
                };
            });

            let options = {
                placeHolder: placeHolder
            };

            return window.showQuickPick(buildQuickPickItems, options).then(result => {
                if (result) {
                    return result.build;
                } else {
                    return null;
                }
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

    private showSettingsMissingMessage() {
        window.showInformationMessage("Account, project and password/Personal Access Token must be provided in user or workspace settings.")
    }

    private tryStartPeriodicStatusUpdate(): void {
        if (!this.intervalTimer) {
            this.intervalTimer = setInterval(() => this.updateStatus(), this.updateIntervalInSeconds * 1000);
        }
    }

    private tryCancelPeriodicStatusUpdate(): void {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
        }
    }

    public dispose() {
        this.statusBar.dispose();
        this.settings.dispose();

        if (this.logStreamHandler) {
            this.logStreamHandler.dispose();
        }
    }
}
"use strict";

import { window, OutputChannel, QuickPickItem } from "vscode";
import { Settings } from "./settings";
import { VstsBuildStatusBar } from "./vstsbuildstatusbar";
import { Build, BuildDefinition, VstsBuildRestClient, VstsBuildRestClientFactory } from "./vstsbuildrestclient";
import { VstsBuildLogStreamHandler } from "./vstsbuildlog";
import fs = require("fs");
import openurl = require("openurl");

interface BuildDefinitionQuickPickItem {
    ids: number[];
    label: string;
    description: string;
    definitions: BuildDefinition[];
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

    private activeDefinitions: BuildDefinition[];
    private settings: Settings;
    private intervalTimer: NodeJS.Timer;
    private restClient: VstsBuildRestClient;
    private logStreamHandler: VstsBuildLogStreamHandler;

    constructor(settings: Settings, restClientFactory: VstsBuildRestClientFactory) {
        this.settings = settings;
        this.statusBar = new VstsBuildStatusBar();
        this.restClient = restClientFactory.createClient(settings);
        this.activeDefinitions = settings.activeBuildDefinitions;
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
        // If everything goes well, the method is set up to be called periodically.

        if (!this.settings.isValid()) {
            this.tryCancelPeriodicStatusUpdate();
            this.statusBar.hideStatusBarItem();

            return;
        }

        if (!this.activeDefinitions || this.activeDefinitions.length < 1) {
            this.statusBar.displayInformation("Select a single build definition or set an aggregated list of IDs in settings");
            return;
        }

        this.restClient.getBuilds(this.activeDefinitions, this.activeDefinitions.length).then(
            response => {
                const definitionName = this.settings.definitionsGroupName && this.activeDefinitions.length > 1 ? this.settings.definitionsGroupName : this.activeDefinitions[0].name;

                if (!response.value) {
                    this.statusBar.displayNoBuilds(definitionName, "No builds found");
                    return;
                }

                let succeeded = true;
                for (let build of response.value) {
                    if (build.result) {
                        if (build.result !== "succeeded") {
                            this.statusBar.displayError(definitionName, "Last build failed");
                            succeeded = false;
                            break;
                        }
                    } else if (response.value) {
                        this.statusBar.displayLoading(definitionName, "Build in progress...");
                        succeeded = false;
                        break;
                    }
                }

                if (succeeded) {
                    this.statusBar.displaySuccess(definitionName, "Last build was completed successfully");
                }

                this.tryStartPeriodicStatusUpdate();
            }, error => {
                this.handleError();
            });
    }

    public openBuildDefinitionSelection(): void {
        this.getBuildDefinitionByQuickPick("Select a build definition to monitor").then(result => {
            if (result) {
                this.activeDefinitions = result;
                this.settings.activeBuildDefinitions = this.activeDefinitions;
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
            if (result.length > 1) {
                window.showInformationMessage(`Group build definition cannot be opened, please select single one instead.`);
                return;
            }

            return this.getBuildByQuickPick(result[0], "Select a build to open").then(build => build);
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
            if (result.length > 1) {
                window.showInformationMessage(`Viewing group build is not possible, please select single build instead.`);
                return;
            }

            return this.getBuildByQuickPick(result[0], "Select a build to view").then(build => build);
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
        let getBuildDefinition = this.getBuildDefinitionByQuickPick("Select a build definition");
        let getBranch = getBuildDefinition.then(_ => {
                return window.showInputBox({ prompt: "Branch (leave empty to use default) ?" });
        });

        Promise.all([getBuildDefinition, getBranch])
            .then((result: [BuildDefinition[], string]) => {
                let selectedBuildDefinition = result[0];
                let selectedBranch = result[1];

                if (!selectedBuildDefinition) {
                    return Promise.reject(null);
                }

                if (selectedBuildDefinition.length > 1) {
                    window.showInformationMessage(`Queueing group build is not possible, please queue single builds one-by-one instead.`);
                    return Promise.reject(null);
                }

                if (selectedBranch === undefined) {
                    return Promise.reject(null);
                }

                return this.restClient.queueBuild(selectedBuildDefinition[0].id, selectedBranch);
            })
            .then(result => {
                window.showInformationMessage(`Build has been queued for ${result.value.definition.name}`);
            })
            .catch(error => {
                if (error) {
                    this.handleError();
                }
                // Otherwise has been cancelled by the user
            });
    }

    private getBuildDefinitionByQuickPick(placeHolder: string): Promise<BuildDefinition[]> {
        if (!this.settings.isValid()) {
            this.showSettingsMissingMessage();

            return Promise.resolve<BuildDefinition[]>(null);
        }

        return new Promise((resolve, reject) => {
            this.restClient.getDefinitions().then(response => {
                let buildDefinitions: BuildDefinitionQuickPickItem[] = response.value.map(function (definition) {
                    return {
                        label: definition.name,
                        description: `Revision ${definition.revision}`,
                        ids: [definition.id],
                        definitions: [definition]
                    }
                });

                if (this.settings.definitionsGroup) {
                    buildDefinitions.push({
                            label: this.settings.definitionsGroupName ? this.settings.definitionsGroupName : this.settings.definitionsGroup.map(b => b.id.toString()).join(','),
                            description: 'Grouped Build Definition',
                            ids: this.settings.definitionsGroup.map(b => b.id),
                            definitions: this.settings.definitionsGroup
                    });
                }

                let options = {
                    placeHolder: placeHolder
                };

                window.showQuickPick(buildDefinitions, options).then(result => {
                    if (result) {
                        resolve(result.definitions);
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
        return this.restClient.getBuilds([definition], 10).then(builds => {
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
"use strict";

import {window, OutputChannel, QuickPickItem} from "vscode";
import {Settings} from "./settings";
import {VstsBuildStatusBar} from "./vstsbuildstatusbar";
import {Build, BuildDefinition, VstsBuildRestClient} from "./vstsbuildrestclient";
import {VstsBuildLogStreamHandler} from "./vstsbuildlog";
import {BuildQuickPicker} from "./components/BuildQuickPicker";

export class VstsBuildStatus {
    private updateIntervalInSeconds = 15;
    private statusBar: VstsBuildStatusBar;
    private buildQuickPicker: BuildQuickPicker;

    private activeDefinitions: BuildDefinition[];
    private settings: Settings;
    private intervalTimer: NodeJS.Timer;
    private restClient: VstsBuildRestClient;
    private logStreamHandler: VstsBuildLogStreamHandler;

    constructor(settings: Settings, restClient: VstsBuildRestClient) {
        this.settings = settings;
        this.statusBar = new VstsBuildStatusBar();
        this.buildQuickPicker = new BuildQuickPicker(settings, restClient);
        this.restClient = restClient;
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

        this.restClient.getBuilds(this.activeDefinitions.map(d => d.id), this.activeDefinitions.length).then(
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
        if (!this.settings.isValid()) {
            this.showSettingsMissingMessage();
        }

        this.buildQuickPicker.showBuildDefinitionQuickPick("Select a build definition to monitor")
            .then(result => {
                if (result) {
                    this.activeDefinitions = result;
                    this.settings.activeBuildDefinitions = this.activeDefinitions;
                    this.updateStatus();
                }
            })
            .catch(error => {
              this.handleError();
            });
    }

    public openBuildLogSelection(): void {
        this.buildQuickPicker.showBuildDefinitionQuickPick("Select a build definition")
            .then(result => {
                if (!result) {
                    return;
                }

                if (result.length > 1) {
                    window.showInformationMessage(`Viewing group build is not possible, please select single build instead.`);
                    return;
                }

                return this.buildQuickPicker.showBuildQuickPick(result[0].id, "Select a build to view");
            })
            .then(build => {
                if (!build) {
                    return;
                }

                this.logStreamHandler.streamLogs(build);
            })
            .catch(error => {
                this.handleError();
            });
    }

    public openQueueBuildSelection(): void {
        if (!this.settings.isValid()) {
            this.showSettingsMissingMessage();
            return;
        }

        let getBuildDefinition = this.buildQuickPicker.showBuildDefinitionQuickPick("Select a build definition");
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
"use strict";

import {window, OutputChannel, QuickPickItem} from "vscode";
import {Settings} from "./settings";
import {StatusBar} from "./components/StatusBar";
import {Build, BuildDefinition, VstsBuildRestClient} from "./vstsbuildrestclient";
import {BuildQuickPicker} from "./components/BuildQuickPicker";

export class VstsBuildStatus {
    private updateIntervalInSeconds = 15;
    private statusBar: StatusBar;
    private buildQuickPicker: BuildQuickPicker;

    private activeDefinitions: BuildDefinition[];
    private settings: Settings;
    private intervalTimer: NodeJS.Timer;
    private restClient: VstsBuildRestClient;

    constructor(settings: Settings, restClient: VstsBuildRestClient) {
        this.settings = settings;
        this.statusBar = new StatusBar();
        this.buildQuickPicker = new BuildQuickPicker(settings, restClient);
        this.restClient = restClient;
        this.activeDefinitions = settings.activeBuildDefinitions;

        this.settings.onDidChangeSettings(() => {
            this.activeDefinitions = this.settings.activeBuildDefinitions;    
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

    private handleError(): void {
        this.showConnectionErrorMessage();
        this.tryCancelPeriodicStatusUpdate();
    }

    private showConnectionErrorMessage(): void {
        this.statusBar.displayConnectivityError("Unable to connect", "There was a problem trying to connect to your VSTS account");
        window.showErrorMessage(`Unable to connect to the VSTS account ${this.settings.account}`);
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
    }
}
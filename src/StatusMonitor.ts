import {window, OutputChannel, QuickPickItem} from "vscode";
import {Settings} from "./Settings";
import {StatusBar} from "./components/StatusBar";
import {Build, BuildDefinition, VstsRestClient} from "./VstsRestClient";
import {BuildQuickPicker} from "./components/BuildQuickPicker";

enum MonitorState {
    Initial,
    Connected,
    Retrying
}

export class StatusMonitor {
    private updateIntervalInSeconds = 15;
    private statusBar: StatusBar;
    private buildQuickPicker: BuildQuickPicker;
    private connectionState: MonitorState;

    private activeDefinitions: BuildDefinition[];
    private settings: Settings;
    private intervalTimer: NodeJS.Timer;
    private restClient: VstsRestClient;

    constructor(settings: Settings, restClient: VstsRestClient) {
        this.settings = settings;
        this.statusBar = new StatusBar();
        this.buildQuickPicker = new BuildQuickPicker(settings, restClient);
        this.restClient = restClient;
        this.activeDefinitions = settings.activeBuildDefinitions;

        this.settings.onDidChangeSettings(() => {
            this.activeDefinitions = this.settings.activeBuildDefinitions;
            this.begin();
        });
    }

    public begin() {
        this.tryCancelPeriodicStatusUpdate();
        this.connectionState = MonitorState.Initial;
        this.updateStatus();
    }

    public stop() {
        this.tryCancelPeriodicStatusUpdate();
    }

    public updateStatus(): Promise<void> {
        // Updates the status bar depending on the state. 
        // If everything goes well, the method is set up to be called periodically.

        if (!this.connectionState) {
            this.connectionState = MonitorState.Initial;
        }

        if (!this.settings.isValid()) {
            this.tryCancelPeriodicStatusUpdate();
            this.statusBar.hideStatusBarItem();

            return;
        }

        if (!this.activeDefinitions || this.activeDefinitions.length < 1) {
            this.statusBar.displayInformation("Select a single build definition or set an aggregated list of IDs in settings");
            return;
        }

        return this.restClient.getBuilds(this.activeDefinitions.map(d => d.id), this.activeDefinitions.length)
            .then(
                response => {
                    this.connectionState = MonitorState.Connected;
                    const definitionName = this.settings.definitionsGroupName && this.activeDefinitions.length > 1 ? this.settings.definitionsGroupName : this.activeDefinitions[0].name;

                    if (!response.value) {
                        this.statusBar.displayNoBuilds(definitionName, "No builds found");
                        return;
                    }
                    
                    this.handleResult(definitionName, response.value);
                    this.tryStartPeriodicStatusUpdate();
                })
            .catch(err => this.handleError(err));
    }

    private handleResult(definitionName: string, result: Build[]) {
        let succeeded = true;
        for (let build of result) {
            if (build.result) {
                if (build.result !== "succeeded") {
                    this.statusBar.displayError(definitionName, "Last build failed");
                    succeeded = false;
                    break;
                }
            } else if (result) {
                this.statusBar.displayLoading(definitionName, "Build in progress...");
                succeeded = false;
                break;
            }
        }

        if (succeeded) {
            this.statusBar.displaySuccess(definitionName, "Last build was completed successfully");
        }
    }

    private handleError(error: any) {
        // TODO handle account errors better

        // For initial attempt, we show an error message
        if (this.connectionState === MonitorState.Initial) {
            this.showConnectionRetryingMessage();
        }

        // Subsequent requests after having connected will continue to retry
        this.connectionState = MonitorState.Retrying;
        this.statusBar.displayConnecting("Connecting...", "Attempting to connect to VSTS after having lost connection.");
        this.tryStartPeriodicStatusUpdate();
    }

    private showConnectionRetryingMessage() {
        window.showErrorMessage(`Unable to connect to the VSTS account ${this.settings.account}. Attempting to reconnect in the background.`)
    }

    private showConnectionErrorMessage() {
        this.statusBar.displayConnectivityError("Unable to connect", "There was a problem trying to connect to your VSTS account.");
        window.showErrorMessage(`Unable to connect to the VSTS account ${this.settings.account}`);
    }

    private tryStartPeriodicStatusUpdate() {
        if (!this.intervalTimer) {
            this.intervalTimer = setInterval(() => this.updateStatus(), this.updateIntervalInSeconds * 1000);
        }
    }

    private tryCancelPeriodicStatusUpdate() {
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
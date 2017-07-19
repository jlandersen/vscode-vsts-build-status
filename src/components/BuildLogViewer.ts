import {window, OutputChannel} from "vscode";
import {VstsRestClient} from "../VstsRestClient";

export class BuildLogViewer {
    private outputChannel: OutputChannel;
    private intervalTimer: NodeJS.Timer;
    private updateIntervalInSeconds: number = 5;
    private currentLogIndex: number = 0;

    constructor(private restClient: VstsRestClient) {
    }

    public viewLog(buildId: number) {
        if (!this.outputChannel) {
            this.outputChannel = window.createOutputChannel("VSTS Build Log");
        }

        this.outputChannel.clear();
        this.outputChannel.show();

        this.getNext(buildId);
    }

    private getNext(buildId: number) {
        if (this.currentLogIndex === 0) {
            this.outputChannel.appendLine("(VSTS Build Agent Status extension) Waiting for first logs...");
        }

        let getBuild = this.restClient.getBuild(buildId);
        let getLog = getBuild.then(build => this.restClient.getLog(build.value));

        Promise.all([getBuild, getLog]).then(value => {
            let build = value[0];
            let log = value[1];

            if (!log) {
                return;
            }

            var newLogEntries = log.value.messages.splice(this.currentLogIndex);
            newLogEntries.forEach(element => {
                this.outputChannel.appendLine(element);
            });

            this.currentLogIndex = this.currentLogIndex + newLogEntries.length;

            if (build.value.status === "completed") {
                clearInterval(this.intervalTimer);
                this.intervalTimer = null;
                this.currentLogIndex = 0;

                this.outputChannel.appendLine("(VSTS Build Agent Status extension) End of build log")
            } else if (build.value.status !== "completed" && !this.intervalTimer) {
                this.intervalTimer = setInterval(
                    () => this.getNext(buildId), 
                    this.updateIntervalInSeconds * 1000);
            }
        });
    }

    public dispose() {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
}
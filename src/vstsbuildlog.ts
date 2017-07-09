"use strict";

import {window, OutputChannel} from "vscode";
import {Build, BuildDefinition, VstsBuildRestClient} from "./vstsbuildrestclient"

export class VstsBuildLogStreamHandler {
    private restClient: VstsBuildRestClient;
    private outputChannel: OutputChannel;
    private intervalTimer: NodeJS.Timer;
    private updateIntervalInSeconds: number = 5;
    private currentLogIndex: number = 0;

    constructor(restClient: VstsBuildRestClient) {
        this.restClient = restClient;
    }

    public streamLogs(build: Build): void {
        if (!this.outputChannel) {
            this.outputChannel = window.createOutputChannel("VSTS Build Log");
        }

        this.outputChannel.clear();
        this.outputChannel.show();

        this.getNext(build.id);
    }

    private getNext(buildId: number): void {
        if (this.currentLogIndex === 0) {
            this.outputChannel.appendLine("(VSTS Build Agent Status extension) Waiting for first logs...")
        }

        this.restClient.getBuild(buildId).then(build => {
            // Right now all logs are continuously fetched.
            // This can be changed to only retrieve new logs from the API itself.
            this.restClient.getLog(build.value).then(log => {
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
                    this.intervalTimer = setInterval(() => this.getNext(buildId), this.updateIntervalInSeconds * 1000);
                }
            });
        });
    }

    public dispose() {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }
}
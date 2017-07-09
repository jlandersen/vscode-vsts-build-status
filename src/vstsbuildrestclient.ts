"use strict";

import { Settings } from "./settings";
import * as rest from "node-rest-client";

export interface Build {
    id: number;
    result: string;
    reason: string;
    status: string;
    startTime: string;
    queueTime: string;
    _links: {
        web: {
            href: string;
        };
    }
}

export interface BuildDefinition {
    id: number;
    name: string;
    revision: number;
    sourceBranch?: string;
}

export interface BuildLog {
    buildId: number;
    messages: string[];
}

interface BuildLogContainer {
    id: number;
    lineCount: number;
}

interface QueueBuildResult {
    id: number;
    definition: BuildDefinition;
}

export class HttpResponse<T> {
    statusCode: number;
    value: T;

    constructor(statusCode: number, value: T) {
        this.statusCode = statusCode;
        this.value = value;
    }
}

export interface VstsBuildRestClientFactory {
    createClient(settings: Settings): VstsBuildRestClient;
}

export class VstsBuildRestClientFactoryImpl implements VstsBuildRestClientFactory {
    public createClient(settings: Settings): VstsBuildRestClient {
        return new VstsBuildRestClientImpl(settings);
    }
}

export interface VstsBuildRestClient {
    getBuilds(definitions: BuildDefinition[], take: number): Promise<HttpResponse<Build[]>>;
    getBuild(buildId: number): Promise<HttpResponse<Build>>;
    getLog(build: Build): Promise<HttpResponse<BuildLog>>;
    getDefinitions(): Promise<HttpResponse<BuildDefinition[]>>;
    queueBuild(definitionId: number, sourceBranch?: string): Promise<HttpResponse<QueueBuildResult>>;
}

class VstsBuildRestClientImpl implements VstsBuildRestClient {
    private static emptyHttpResponse = new HttpResponse(200, null);
    private client: any;
    private settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
        this.client = new rest.Client();
    }

    public getBuilds(definitions: BuildDefinition[], take: number = 5): Promise<HttpResponse<Build[]>> {
        let url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds?definitions=${definitions.map(d => d.id).join(',')}&$top=${take}&api-version=2.0`;
        if (definitions.length > 1) { // Return single build per definition, if grouped build definitions were queried
            url += `&maxBuildsPerDefinition=1`;
        }

        return this.getMany<Build[]>(url).then(response => {
            if (response.value && response.value.length > 0) {
                return new HttpResponse(response.statusCode, response.value);
            }

            return new HttpResponse(response.statusCode, []);
        });
    }

    public getBuild(buildId: number): Promise<HttpResponse<Build>> {
        let url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds/${buildId}?api-version=2.0`;

        return this.getSingle<Build>(url);
    }

    public getLog(build: Build): Promise<HttpResponse<BuildLog>> {
        let url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds/${build.id}/logs?api-version=2.0`;
        return this.getMany<BuildLogContainer[]>(url).then(result => {
            return <PromiseLike<HttpResponse<BuildLog>>>Promise.all(result.value.map(buildLogContainer => {
                let singleLogUrl = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds/${build.id}/logs/${buildLogContainer.id}?api-version=2.0`;
                return this.getMany<string[]>(singleLogUrl);
            })).then(logs => {
                let flattenedLogs: string[] = [];

                for (var logSection of logs) {
                    for (var logLine of logSection.value) {
                        flattenedLogs.push(logLine);
                    }
                }

                return new HttpResponse(200, {
                    buildId: build.id,
                    messages: flattenedLogs
                });
            });
        });
    }

    public getDefinitions(): Promise<HttpResponse<BuildDefinition[]>> {
        let url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/definitions?api-version=2.0`;

        return this.getMany<BuildDefinition[]>(url);
    }

    public queueBuild(definitionId: number, sourceBranch: string): Promise<HttpResponse<QueueBuildResult>> {
        let url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds?api-version=2.0`;

        let body = {
            definition: {
                id: definitionId
            }
        };

        if (sourceBranch) {
            body['sourceBranch'] = sourceBranch;
        }

        return this.post<QueueBuildResult>(url, body);
    }

    private getSingle<T>(url: string): Promise<HttpResponse<T>> {
        return this.get<T>(url, (data => JSON.parse(data)));
    }

    private getMany<T>(url: string): Promise<HttpResponse<T>> {
        return this.get<T>(url, (data => JSON.parse(data).value));
    }

    private get<T>(url: string, parser: (data: any) => T): Promise<HttpResponse<T>> {
        return new Promise((resolve, reject) => {
            this.client.get(
                url,
                { headers: { "Authorization": this.getAuthorizationHeaderValue() } },
                (data, response) => {
                    if (response.statusCode !== 200) {
                        reject("Status code indicated non-OK result " + response.statusCode);
                        return;
                    }

                    let result: T;

                    try {
                        result = parser(data);
                    } catch (e) {
                        result = null;
                    }

                    resolve(new HttpResponse(response.statusCode, result));
                }).on("error", error => {
                    reject(error);
                });
        });
    }

    private post<T>(url: string, body: any): Promise<HttpResponse<T>> {
        var args = {
            data: body,
            headers: {
                "Authorization": this.getAuthorizationHeaderValue(),
                "Content-Type": "application/json"
            }
        };

        return new Promise((resolve, reject) => {
            this.client.post(
                url,
                args,
                (data, response) => {
                    if (response.statusCode !== 200) {
                        reject("Status code indicated non-OK result " + response.statusCode);
                        return;
                    }

                    let result: T;

                    try {
                        result = JSON.parse(data);
                    } catch (e) {
                        result = null;
                    }

                    resolve(new HttpResponse(response.statusCode, result));
                }
            ).on("error", error => {
                reject(error);
            });
        });
    }

    private getAuthorizationHeaderValue(): string {
        return `Basic ${new Buffer(`${this.settings.username}:${this.settings.password}`).toString("base64")}`;
    }
}
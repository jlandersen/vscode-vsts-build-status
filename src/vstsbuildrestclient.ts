"use static";

import {Settings} from "./settings";
import * as rest from "node-rest-client";

export interface Build {
    result: string;
    reason: string;
    startTime: string;
}

export interface BuildDefinition {
    id: number;
    name: string;
    revision: number;
}

export interface BuildLog {
    buildId: number;
    messages: string[];
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
    getLatest(definition: BuildDefinition): Thenable<HttpResponse<Build>>;
    getBuilds(definition: BuildDefinition, take: number): Thenable<HttpResponse<Build[]>>;
    getLog(build: Build): Thenable<HttpResponse<string>>;
    getDefinitions(): Thenable<HttpResponse<BuildDefinition[]>>;
}

class VstsBuildRestClientImpl implements VstsBuildRestClient {
    private static emptyHttpResponse = new HttpResponse(200, null);
    private client: any;
    private settings: Settings;

    constructor(settings: Settings) {
        this.settings = settings;
        this.client = new rest.Client();
    }

    public getLatest(definition: BuildDefinition): Thenable<HttpResponse<Build>> {
        return this.getBuilds(definition, 1).then(result => {
            if (result.value.length > 0) {
                return new HttpResponse(200, result.value[0]);
            }

            return VstsBuildRestClientImpl.emptyHttpResponse;
        });
    }

    public getBuilds(definition: BuildDefinition, take: number = 5): Thenable<HttpResponse<Build[]>> {
        let url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/builds?definitions=${definition.id}&$top=${take}&api-version=2.0`;

        return this.get<Build[]>(url).then(response => {
            if (response.value && response.value.length > 0) {
                return new HttpResponse(response.statusCode, response.value);
            }

            return new HttpResponse(response.statusCode, []);
        });
    }

    public getLog(build: Build): Thenable<HttpResponse<string>> {
        return null;
    }

    public getDefinitions(): Thenable<HttpResponse<BuildDefinition[]>> {
        let url = `https://${this.settings.account}.visualstudio.com/DefaultCollection/${this.settings.project}/_apis/build/definitions?api-version=2.0`;

        return this.get<BuildDefinition[]>(url);
    }

    private get<T>(url: string): Thenable<HttpResponse<T>> {
        return new Promise((resolve, reject) => {
            this.client.get(
                url,
                this.getRequestArgs(),
                (data, response) => {
                    if (response.statusCode !== 200) {
                        reject("Status code indicated non-OK result " + response.statusCode);
                        return;
                    }

                    let result: T;

                    try {
                        result = JSON.parse(data).value;
                    } catch (e) {
                        result = null;
                    }

                    return resolve(new HttpResponse(response.statusCode, result));
                }).on("error", error => {
                    return reject(error);
                });
        });
    }

    private getRequestArgs(): { headers: { Authorization: string } } {
        let authHeader = `Basic ${new Buffer(`${this.settings.username}:${this.settings.password}`).toString("base64")}`;

        return {
            headers: { Authorization: authHeader }
        }
    }
}